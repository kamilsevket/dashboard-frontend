import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { v4 as uuidv4 } from 'uuid';
import store from './store.js';

config();

const execAsync = promisify(exec);
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

app.use(cors({
  origin: ['http://localhost:5173', 'https://dashboard.kamilsevket.com'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ============================================================================
// AUTH
// ============================================================================
const authMiddleware = (req, res, next) => {
  if (req.path === '/api/auth/login' || req.path === '/api/health') {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', authMiddleware);

// ============================================================================
// STATIC FILES (Frontend)
// ============================================================================
const STATIC_DIR = path.join(__dirname, 'dist');
app.use(express.static(STATIC_DIR));

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// ============================================================================
// CONFIG
// ============================================================================
const WORKSPACE = process.env.HOME + '/clawd-main';
const PROJECTS_DIR = '/Users/kamil/Developer/clawProjects';
const AGENTS_DIR = process.env.HOME + '/clawd/agents';
const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp';
const GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'polar-reef-443122-i5';

// Get fresh OAuth token from gcloud
async function getGcloudToken() {
  const { stdout } = await execAsync('gcloud auth print-access-token');
  return stdout.trim();
}

app.use('/static/projects', express.static(PROJECTS_DIR));

// ============================================================================
// WEBSOCKET
// ============================================================================
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected');
  ws.on('close', () => clients.delete(ws));
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}

// ============================================================================
// STITCH MCP CLIENT
// ============================================================================
let stitchReqId = 1;

async function stitchCall(toolName, args = {}) {
  const accessToken = await getGcloudToken();
  
  const response = await fetch(STITCH_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Goog-User-Project': GCLOUD_PROJECT
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: stitchReqId++,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stitch error ${response.status}: ${text}`);
  }
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const result = data.result;
  if (result?.structuredContent) return result.structuredContent;
  if (result?.content?.[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return { text: result.content[0].text };
    }
  }
  return result;
}

const stitchClient = {
  async createProject(name) {
    const result = await stitchCall('create_project', { title: name });
    return { projectId: result.name?.split('/')[1] };
  },
  
  async generateScreen(projectId, projectName, screenName, prompt) {
    const exportDir = path.join(PROJECTS_DIR, projectName, 'designs');
    await fs.mkdir(exportDir, { recursive: true });
    
    const genResult = await stitchCall('generate_screen_from_text', {
      projectId,
      prompt,
      deviceType: 'MOBILE',
      modelId: 'GEMINI_3_1_PRO'
    });
    
    const outputs = genResult.outputComponents || [];
    let screenshot = null;
    let html = null;
    
    for (const output of outputs) {
      if (output.design?.screens) {
        for (const screen of output.design.screens) {
          if (screen.screenshot?.downloadUrl) {
            try {
              const imgUrl = `${screen.screenshot.downloadUrl}=w800`;
              const imgRes = await fetch(imgUrl);
              if (imgRes.ok) {
                const buffer = Buffer.from(await imgRes.arrayBuffer());
                const filename = `${screenName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                await fs.writeFile(path.join(exportDir, filename), buffer);
                screenshot = `/static/projects/${projectName}/designs/${filename}`;
              }
            } catch (e) {
              console.error('Screenshot download failed:', e);
            }
          }
          
          if (screen.htmlCode?.downloadUrl) {
            try {
              const htmlRes = await fetch(screen.htmlCode.downloadUrl);
              if (htmlRes.ok) {
                const htmlContent = await htmlRes.text();
                const filename = `${screenName.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
                await fs.writeFile(path.join(exportDir, filename), htmlContent);
                html = `/static/projects/${projectName}/designs/${filename}`;
              }
            } catch (e) {
              console.error('HTML download failed:', e);
            }
          }
          break;
        }
      }
    }
    
    return { screenshot, html };
  }
};

// ============================================================================
// IOS PROJECT GENERATOR (XcodeGen)
// ============================================================================
const iosProjectGenerator = {
  async createProject(projectName, screens = [], features = [], description = '') {
    const projectPath = path.join(PROJECTS_DIR, projectName);
    const sourcesPath = path.join(projectPath, 'Sources');
    const assetsPath = path.join(projectPath, 'Sources', 'Assets.xcassets');
    const designsPath = path.join(projectPath, 'designs');
    
    // Create directories
    await fs.mkdir(sourcesPath, { recursive: true });
    await fs.mkdir(assetsPath, { recursive: true });
    await fs.mkdir(path.join(assetsPath, 'AppIcon.appiconset'), { recursive: true });
    await fs.mkdir(path.join(assetsPath, 'AccentColor.colorset'), { recursive: true });
    await fs.mkdir(designsPath, { recursive: true });
    
    const bundleId = `com.claw.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    // XcodeGen project.yml
    const projectYml = `name: ${projectName}
options:
  bundleIdPrefix: com.claw
  deploymentTarget:
    iOS: "17.0"
  developmentLanguage: en
  xcodeVersion: "16.0"
  generateEmptyDirectories: true
  groupSortPosition: top

settings:
  base:
    SWIFT_VERSION: "6.0"
    GENERATE_INFOPLIST_FILE: YES
    MARKETING_VERSION: "1.0.0"
    CURRENT_PROJECT_VERSION: "1"
    INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
    INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents: YES
    INFOPLIST_KEY_UILaunchScreen_Generation: YES
    INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone: "UIInterfaceOrientationPortrait"
    INFOPLIST_KEY_CFBundleDisplayName: "${projectName}"

targets:
  ${projectName}:
    type: application
    platform: iOS
    sources:
      - path: Sources
        excludes:
          - "**/.DS_Store"
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: ${bundleId}
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
        ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: AccentColor
`;

    // App entry point
    const appSwift = `import SwiftUI

@main
struct ${projectName}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`;

    // ContentView with TabView if multiple screens
    const screenViews = screens.map(s => s.name || s).filter(Boolean);
    const hasMultipleScreens = screenViews.length > 1;
    
    let contentViewSwift;
    if (hasMultipleScreens) {
      const tabs = screenViews.slice(0, 5).map((name, i) => {
        const icon = i === 0 ? 'house.fill' : i === 1 ? 'list.bullet' : i === 2 ? 'gear' : i === 3 ? 'person.fill' : 'star.fill';
        return `            ${name.replace(/[^a-zA-Z0-9]/g, '')}View()
                .tabItem {
                    Label("${name}", systemImage: "${icon}")
                }`;
      }).join('\n');
      
      contentViewSwift = `import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
${tabs}
        }
    }
}

#Preview {
    ContentView()
}
`;
    } else {
      contentViewSwift = `import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            ${screenViews[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'Home'}View()
        }
    }
}

#Preview {
    ContentView()
}
`;
    }

    // Generate view files for each screen
    const viewFiles = {};
    for (const screenName of screenViews) {
      const safeName = screenName.replace(/[^a-zA-Z0-9]/g, '');
      viewFiles[`${safeName}View.swift`] = `import SwiftUI

struct ${safeName}View: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // TODO: Implement ${screenName} UI from design
                Text("${screenName}")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Implement this screen based on the generated design")
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("${screenName}")
    }
}

#Preview {
    NavigationStack {
        ${safeName}View()
    }
}
`;
    }

    // Assets catalog
    const contentsJson = `{
  "info": {
    "author": "xcode",
    "version": 1
  }
}`;

    const appIconContents = `{
  "images": [
    { "idiom": "universal", "platform": "ios", "size": "1024x1024" }
  ],
  "info": { "author": "xcode", "version": 1 }
}`;

    const accentColorContents = `{
  "colors": [
    {
      "color": { "color-space": "srgb", "components": { "red": "0.039", "green": "0.518", "blue": "1.000", "alpha": "1.000" } },
      "idiom": "universal"
    }
  ],
  "info": { "author": "xcode", "version": 1 }
}`;

    // Write all files
    await fs.writeFile(path.join(projectPath, 'project.yml'), projectYml);
    await fs.writeFile(path.join(sourcesPath, `${projectName}App.swift`), appSwift);
    await fs.writeFile(path.join(sourcesPath, 'ContentView.swift'), contentViewSwift);
    
    for (const [filename, content] of Object.entries(viewFiles)) {
      await fs.writeFile(path.join(sourcesPath, filename), content);
    }
    
    await fs.writeFile(path.join(assetsPath, 'Contents.json'), contentsJson);
    await fs.writeFile(path.join(assetsPath, 'AppIcon.appiconset', 'Contents.json'), appIconContents);
    await fs.writeFile(path.join(assetsPath, 'AccentColor.colorset', 'Contents.json'), accentColorContents);

    // Project metadata
    const projectJson = {
      name: projectName,
      bundleId,
      description,
      features,
      screens: screenViews,
      createdAt: new Date().toISOString(),
      platform: 'iOS',
      swiftVersion: '6.0',
      deploymentTarget: '17.0'
    };
    await fs.writeFile(path.join(projectPath, 'project.json'), JSON.stringify(projectJson, null, 2));

    // Run XcodeGen
    try {
      await execAsync(`cd "${projectPath}" && xcodegen generate`, { timeout: 30000 });
      console.log(`✅ Created Xcode project: ${projectName}.xcodeproj`);
      return { 
        success: true, 
        xcodeProject: path.join(projectPath, `${projectName}.xcodeproj`),
        projectPath 
      };
    } catch (e) {
      console.error('XcodeGen failed:', e.message);
      return { 
        success: false, 
        error: e.message,
        projectPath 
      };
    }
  },

  async openInXcode(projectPath, projectName) {
    try {
      await execAsync(`open "${path.join(projectPath, `${projectName}.xcodeproj`)}"`);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};

// ============================================================================
// AGENT EXECUTOR
// ============================================================================
const agentExecutor = {
  async chat(agentId, message, project = null) {
    const contextMessage = project ? `[Project: ${project}] ${message}` : message;
    const escapedMessage = contextMessage
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    
    try {
      const { stdout } = await execAsync(
        `openclaw agent --agent "${agentId}" --message "${escapedMessage}" --json --timeout 180`,
        { timeout: 190000 }
      );
      
      const result = JSON.parse(stdout);
      if (result.status === 'ok' && result.result?.payloads?.[0]?.text) {
        return result.result.payloads[0].text;
      }
      throw new Error(result.error || 'No response');
    } catch (e) {
      console.error(`Agent ${agentId} error:`, e.message);
      throw e;
    }
  },
  
  async exec(command) {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    return { stdout: stdout.trim(), stderr };
  }
};

// ============================================================================
// PIPELINE ENGINE
// ============================================================================
const activePipelines = new Map();

function createPipeline(config) {
  const id = uuidv4();
  const pipeline = {
    id,
    projectName: config.projectName,
    status: 'running',
    currentStage: 'analyze',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    
    config: {
      appDescription: config.description,
      features: config.features || [],
      screens: config.screens || []
    },
    
    design: {
      stitchProjectId: null,
      screens: [],
      reviewStatus: 'pending'
    },
    
    development: {
      status: 'pending',
      xcodeProject: null,
      implementedScreens: [],
      buildStatus: 'pending'
    },
    
    testing: {
      status: 'pending',
      unitTests: { passed: 0, failed: 0, total: 0 },
      uiTests: { passed: 0, failed: 0, total: 0 }
    },
    
    screenshots: {
      status: 'pending',
      images: []
    },
    
    logs: []
  };
  
  activePipelines.set(id, pipeline);
  return pipeline;
}

function pipelineLog(pipelineId, source, message) {
  const pipeline = activePipelines.get(pipelineId);
  if (!pipeline) return;
  
  const entry = { timestamp: new Date().toISOString(), source, message };
  pipeline.logs.push(entry);
  broadcast('pipeline:log', { pipelineId, ...entry });
  console.log(`[Pipeline ${pipelineId.slice(0, 8)}] [${source}] ${message}`);
}

function emitAgentStatus(agentId, status, message = '') {
  broadcast('agent:status', { agent: agentId, status, message });
}

async function runPipelineStage(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  if (!pipeline || pipeline.status !== 'running') return;
  
  try {
    switch (pipeline.currentStage) {
      case 'analyze':
        await runAnalyze(pipelineId);
        break;
      case 'design':
        await runDesignAndScaffold(pipelineId);
        break;
      case 'review':
        pipelineLog(pipelineId, 'review', '⏸️ Waiting for design review...');
        broadcast('pipeline:awaiting-review', { pipelineId });
        break;
      case 'implement':
        await runImplement(pipelineId);
        break;
      case 'test':
        await runTest(pipelineId);
        break;
      case 'screenshot':
        await runScreenshot(pipelineId);
        break;
      case 'complete':
        pipelineLog(pipelineId, 'pipeline', '✅ Pipeline complete!');
        pipeline.status = 'complete';
        broadcast('pipeline:complete', { pipelineId });
        break;
    }
    
    store.savePipeline(pipeline);
    
  } catch (error) {
    pipelineLog(pipelineId, 'error', `❌ ${error.message}`);
    pipeline.status = 'error';
    pipeline.error = error.message;
    broadcast('pipeline:error', { pipelineId, error: error.message });
  }
}

async function runAnalyze(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  pipelineLog(pipelineId, 'pm', '📋 PM analyzing app idea...');
  emitAgentStatus('pm', 'working', 'Analyzing app concept');
  
  const prompt = `Analyze this iOS app and suggest screens with detailed UI descriptions.

App: ${pipeline.projectName}
Description: ${pipeline.config.appDescription}
Features: ${pipeline.config.features.join(', ')}

For each screen provide:
1. Screen name
2. Detailed UI description for a designer (what elements, layout, style)

Output JSON array only:
[{"name": "ScreenName", "description": "UI description..."}]`;

  try {
    const result = await agentExecutor.chat('pm', prompt, pipeline.projectName);
    
    let screens = pipeline.config.screens;
    try {
      const jsonMatch = result.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        screens = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      pipelineLog(pipelineId, 'pm', '⚠️ Using default screens');
    }
    
    pipeline.design.screens = screens.map(s => ({
      name: s.name,
      description: s.description,
      status: 'pending',
      screenshot: null,
      html: null,
      feedback: null,
      version: 1
    }));
    
    pipelineLog(pipelineId, 'pm', `✅ Identified ${screens.length} screens`);
    emitAgentStatus('pm', 'idle');
    
    pipeline.currentStage = 'design';
    broadcast('pipeline:stage', { pipelineId, stage: 'design' });
    runPipelineStage(pipelineId);
    
  } catch (error) {
    emitAgentStatus('pm', 'idle');
    throw error;
  }
}

async function runDesignAndScaffold(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  
  // Run both in parallel
  const designPromise = runDesign(pipelineId);
  const scaffoldPromise = runScaffold(pipelineId);
  
  await Promise.all([designPromise, scaffoldPromise]);
  
  // Move to review
  pipeline.currentStage = 'review';
  broadcast('pipeline:stage', { pipelineId, stage: 'review' });
  runPipelineStage(pipelineId);
}

async function runDesign(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  pipelineLog(pipelineId, 'designer', '🎨 Starting design generation...');
  emitAgentStatus('designer', 'working', 'Generating UI designs');
  
  try {
    // Create Stitch project
    const stitchProject = await stitchClient.createProject(pipeline.projectName);
    pipeline.design.stitchProjectId = stitchProject.projectId;
    
    // Generate each screen
    for (const screen of pipeline.design.screens) {
      pipelineLog(pipelineId, 'designer', `🎨 Generating: ${screen.name}...`);
      screen.status = 'generating';
      broadcast('design:generating', { pipelineId, screenName: screen.name });
      
      const prompt = `iOS mobile app screen: ${screen.name}

${screen.description}

Style: Modern dark mode iOS app, SF Pro font, clean minimal design, proper iOS spacing and components.`;

      try {
        const result = await stitchClient.generateScreen(
          pipeline.design.stitchProjectId,
          pipeline.projectName,
          screen.name,
          prompt
        );
        
        screen.screenshot = result.screenshot;
        screen.html = result.html;
        screen.status = 'ready';
        
        pipelineLog(pipelineId, 'designer', `✅ ${screen.name} design ready`);
        broadcast('design:ready', { pipelineId, screenName: screen.name, screenshot: result.screenshot });
        
      } catch (error) {
        screen.status = 'error';
        screen.error = error.message;
        pipelineLog(pipelineId, 'designer', `❌ ${screen.name} failed: ${error.message}`);
      }
    }
    
    emitAgentStatus('designer', 'idle');
    pipelineLog(pipelineId, 'designer', '✅ All designs generated');
    
  } catch (error) {
    emitAgentStatus('designer', 'idle');
    throw error;
  }
}

async function runScaffold(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  pipelineLog(pipelineId, 'ios-dev', '🍎 Creating iOS project with XcodeGen...');
  emitAgentStatus('ios-dev', 'working', 'Creating Xcode project');
  
  try {
    const screenNames = pipeline.design.screens.map(s => s.name);
    
    const result = await iosProjectGenerator.createProject(
      pipeline.projectName,
      screenNames,
      pipeline.config.features,
      pipeline.config.appDescription
    );
    
    if (result.success) {
      pipeline.development.xcodeProject = result.xcodeProject;
      pipeline.development.status = 'scaffold';
      pipelineLog(pipelineId, 'ios-dev', `✅ Created: ${pipeline.projectName}.xcodeproj`);
      pipelineLog(pipelineId, 'ios-dev', `📁 Path: ${result.projectPath}`);
    } else {
      pipelineLog(pipelineId, 'ios-dev', `⚠️ XcodeGen failed: ${result.error}`);
    }
    
    emitAgentStatus('ios-dev', 'idle');
    
  } catch (error) {
    emitAgentStatus('ios-dev', 'idle');
    pipelineLog(pipelineId, 'ios-dev', `❌ Scaffold failed: ${error.message}`);
  }
}

async function runImplement(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  const approvedScreens = pipeline.design.screens.filter(s => s.status === 'approved');
  
  pipelineLog(pipelineId, 'ios-dev', `🛠️ Implementing ${approvedScreens.length} screens...`);
  emitAgentStatus('ios-dev', 'working', 'Implementing designs');
  pipeline.development.status = 'implementing';
  
  const projectPath = path.join(PROJECTS_DIR, pipeline.projectName);
  
  for (const screen of approvedScreens) {
    pipelineLog(pipelineId, 'ios-dev', `📱 Implementing ${screen.name}...`);
    
    try {
      let designCode = '';
      if (screen.html) {
        const htmlPath = path.join(projectPath, 'designs', `${screen.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`);
        try {
          designCode = await fs.readFile(htmlPath, 'utf-8');
        } catch {}
      }

      const prompt = `Implement SwiftUI view for "${screen.name}" screen.

Design image: ${screen.screenshot || 'See description'}
${designCode ? `HTML/CSS reference:\n\`\`\`\n${designCode.substring(0, 4000)}\n\`\`\`` : ''}
Description: ${screen.description}

Update the existing ${screen.name}View.swift to match the design exactly.
Use proper SwiftUI components, colors, and spacing.`;

      await agentExecutor.chat('ios-dev', prompt, pipeline.projectName);
      
      pipeline.development.implementedScreens.push(screen.name);
      pipelineLog(pipelineId, 'ios-dev', `✅ ${screen.name} implemented`);
      broadcast('implement:screen', { pipelineId, screenName: screen.name });
      
    } catch (error) {
      pipelineLog(pipelineId, 'ios-dev', `❌ ${screen.name} failed: ${error.message}`);
    }
  }
  
  // Build
  pipelineLog(pipelineId, 'ios-dev', '🔨 Building project...');
  pipeline.development.buildStatus = 'building';
  
  try {
    const { stdout } = await agentExecutor.exec(
      `cd "${projectPath}" && xcodebuild -scheme "${pipeline.projectName}" -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 15' build 2>&1 | tail -5`
    );
    
    pipeline.development.buildStatus = stdout.includes('BUILD SUCCEEDED') ? 'success' : 'failed';
    pipelineLog(pipelineId, 'ios-dev', pipeline.development.buildStatus === 'success' ? '✅ Build succeeded!' : '❌ Build failed');
  } catch (e) {
    pipeline.development.buildStatus = 'failed';
  }
  
  emitAgentStatus('ios-dev', 'idle');
  pipeline.development.status = 'complete';
  
  pipeline.currentStage = 'test';
  broadcast('pipeline:stage', { pipelineId, stage: 'test' });
  runPipelineStage(pipelineId);
}

async function runTest(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  
  pipelineLog(pipelineId, 'ios-test', '🧪 Starting test phase...');
  emitAgentStatus('ios-test', 'working', 'Writing tests');
  pipeline.testing.status = 'running';
  
  try {
    const unitPrompt = `Write XCTest unit tests for ${pipeline.projectName}.
Screens: ${pipeline.design.screens.map(s => s.name).join(', ')}
Test ViewModels and models. Create test file in Tests/ folder.`;

    await agentExecutor.chat('ios-test', unitPrompt, pipeline.projectName);
    pipelineLog(pipelineId, 'ios-test', '✅ Unit tests written');
    
    const uiPrompt = `Write XCUITest UI tests for ${pipeline.projectName}.
Test navigation to each screen and verify key elements exist.
Create test file in UITests/ folder.`;

    await agentExecutor.chat('ios-test', uiPrompt, pipeline.projectName);
    pipelineLog(pipelineId, 'ios-test', '✅ UI tests written');
    
    // Run tests
    pipelineLog(pipelineId, 'ios-test', '🏃 Running tests...');
    const projectPath = path.join(PROJECTS_DIR, pipeline.projectName);
    
    try {
      const { stdout } = await agentExecutor.exec(
        `cd "${projectPath}" && xcodebuild test -scheme "${pipeline.projectName}" -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | grep -E "(passed|failed)" | tail -5`
      );
      
      const passedMatch = stdout.match(/(\d+) passed/);
      const failedMatch = stdout.match(/(\d+) failed/);
      
      pipeline.testing.unitTests.passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      pipeline.testing.unitTests.failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      pipeline.testing.unitTests.total = pipeline.testing.unitTests.passed + pipeline.testing.unitTests.failed;
      
      pipelineLog(pipelineId, 'ios-test', `✅ ${pipeline.testing.unitTests.passed} passed, ${pipeline.testing.unitTests.failed} failed`);
    } catch {}
    
  } catch (error) {
    pipelineLog(pipelineId, 'ios-test', `❌ Test error: ${error.message}`);
  }
  
  emitAgentStatus('ios-test', 'idle');
  pipeline.testing.status = 'complete';
  
  pipeline.currentStage = 'screenshot';
  broadcast('pipeline:stage', { pipelineId, stage: 'screenshot' });
  runPipelineStage(pipelineId);
}

async function runScreenshot(pipelineId) {
  const pipeline = activePipelines.get(pipelineId);
  
  pipelineLog(pipelineId, 'screenshot', '📸 Capturing screenshots...');
  pipeline.screenshots.status = 'capturing';
  
  const projectPath = path.join(PROJECTS_DIR, pipeline.projectName);
  const screenshotDir = path.join(projectPath, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  
  try {
    // Boot simulator
    pipelineLog(pipelineId, 'screenshot', '📱 Booting simulator...');
    await agentExecutor.exec('xcrun simctl boot "iPhone 15" 2>/dev/null || true');
    await agentExecutor.exec('open -a Simulator');
    await new Promise(r => setTimeout(r, 3000));
    
    // Build and install
    pipelineLog(pipelineId, 'screenshot', '📦 Installing app...');
    await agentExecutor.exec(
      `cd "${projectPath}" && xcodebuild -scheme "${pipeline.projectName}" -destination 'platform=iOS Simulator,name=iPhone 15' build 2>/dev/null || true`
    );
    
    // Find app
    const { stdout: appPath } = await agentExecutor.exec(
      `find ~/Library/Developer/Xcode/DerivedData -name "${pipeline.projectName}.app" -path "*/Debug-iphonesimulator/*" 2>/dev/null | head -1`
    );
    
    if (appPath) {
      await agentExecutor.exec(`xcrun simctl install "iPhone 15" "${appPath}"`);
      
      const bundleId = `com.app.${pipeline.projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      await agentExecutor.exec(`xcrun simctl launch "iPhone 15" "${bundleId}"`);
      await new Promise(r => setTimeout(r, 2000));
      
      // Capture
      const screenshotPath = path.join(screenshotDir, 'main.png');
      await agentExecutor.exec(`xcrun simctl io "iPhone 15" screenshot "${screenshotPath}"`);
      
      pipeline.screenshots.images.push({
        screen: 'Main',
        path: `/static/projects/${pipeline.projectName}/screenshots/main.png`
      });
      
      pipelineLog(pipelineId, 'screenshot', '✅ Screenshot captured');
      broadcast('screenshot:captured', { pipelineId, path: pipeline.screenshots.images[0].path });
    }
    
  } catch (error) {
    pipelineLog(pipelineId, 'screenshot', `❌ Screenshot error: ${error.message}`);
  }
  
  pipeline.screenshots.status = 'complete';
  
  pipeline.currentStage = 'complete';
  broadcast('pipeline:stage', { pipelineId, stage: 'complete' });
  runPipelineStage(pipelineId);
}

// ============================================================================
// PIPELINE API ENDPOINTS
// ============================================================================

// Start new pipeline
app.post('/api/pipeline/start', async (req, res) => {
  const { projectName, description, features, screens } = req.body;
  
  if (!projectName || !description) {
    return res.status(400).json({ error: 'projectName and description required' });
  }
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  await fs.mkdir(path.join(projectPath, 'designs'), { recursive: true });
  
  const pipeline = createPipeline({ projectName, description, features, screens });
  
  broadcast('pipeline:created', pipeline);
  res.json(pipeline);
  
  // Start execution
  runPipelineStage(pipeline.id);
});

// Get pipeline status
app.get('/api/pipeline/:id', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(pipeline);
});

// Get all pipelines
app.get('/api/pipelines', (req, res) => {
  res.json(Array.from(activePipelines.values()));
});

// Get active pipeline
app.get('/api/pipeline/active', (req, res) => {
  const active = Array.from(activePipelines.values()).find(p => p.status === 'running');
  res.json(active || null);
});

// Pause pipeline
app.post('/api/pipeline/:id/pause', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  
  pipeline.status = 'paused';
  pipelineLog(pipeline.id, 'pipeline', '⏸️ Pipeline paused');
  broadcast('pipeline:paused', { pipelineId: pipeline.id });
  res.json(pipeline);
});

// Resume pipeline
app.post('/api/pipeline/:id/resume', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  
  pipeline.status = 'running';
  pipelineLog(pipeline.id, 'pipeline', '▶️ Pipeline resumed');
  runPipelineStage(pipeline.id);
  res.json(pipeline);
});

// Get pipeline designs
app.get('/api/pipeline/:id/designs', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(pipeline.design.screens);
});

// Submit feedback for a screen
app.post('/api/pipeline/:id/designs/:screenName/feedback', async (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  
  const screen = pipeline.design.screens.find(s => s.name === req.params.screenName);
  if (!screen) {
    return res.status(404).json({ error: 'Screen not found' });
  }
  
  const { feedback } = req.body;
  screen.feedback = feedback;
  screen.status = 'feedback';
  screen.version++;
  
  pipelineLog(pipeline.id, 'review', `📝 Feedback for ${screen.name}`);
  broadcast('design:feedback', { pipelineId: pipeline.id, screenName: screen.name });
  
  // Regenerate
  emitAgentStatus('designer', 'working', `Updating ${screen.name}`);
  screen.status = 'generating';
  
  const prompt = `iOS mobile app screen: ${screen.name}

Original: ${screen.description}
User feedback: ${feedback}

Update the design according to feedback. Modern dark mode iOS style.`;

  try {
    const result = await stitchClient.generateScreen(
      pipeline.design.stitchProjectId,
      pipeline.projectName,
      `${screen.name}_v${screen.version}`,
      prompt
    );
    
    screen.screenshot = result.screenshot;
    screen.html = result.html;
    screen.status = 'ready';
    screen.feedback = null;
    
    pipelineLog(pipeline.id, 'designer', `✅ ${screen.name} v${screen.version} ready`);
    broadcast('design:ready', { pipelineId: pipeline.id, screenName: screen.name, screenshot: result.screenshot });
    
  } catch (error) {
    screen.status = 'error';
  }
  
  emitAgentStatus('designer', 'idle');
  res.json(screen);
});

// Approve single screen
app.post('/api/pipeline/:id/designs/:screenName/approve', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  
  const screen = pipeline.design.screens.find(s => s.name === req.params.screenName);
  if (!screen) {
    return res.status(404).json({ error: 'Screen not found' });
  }
  
  screen.status = 'approved';
  pipelineLog(pipeline.id, 'review', `✅ ${screen.name} approved`);
  broadcast('design:screen-approved', { pipelineId: pipeline.id, screenName: screen.name });
  res.json(screen);
});

// Approve all designs and continue
app.post('/api/pipeline/:id/designs/approve-all', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  
  pipeline.design.screens.forEach(s => {
    if (s.status === 'ready') {
      s.status = 'approved';
    }
  });
  
  pipeline.design.reviewStatus = 'approved';
  pipelineLog(pipeline.id, 'review', '✅ All designs approved!');
  broadcast('design:all-approved', { pipelineId: pipeline.id });
  
  // Advance to implement
  pipeline.currentStage = 'implement';
  broadcast('pipeline:stage', { pipelineId: pipeline.id, stage: 'implement' });
  runPipelineStage(pipeline.id);
  
  res.json(pipeline);
});

// Add new screen
app.post('/api/pipeline/:id/screens', async (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  
  const { name, description } = req.body;
  
  const newScreen = {
    name,
    description,
    status: 'pending',
    screenshot: null,
    html: null,
    feedback: null,
    version: 1
  };
  
  pipeline.design.screens.push(newScreen);
  pipelineLog(pipeline.id, 'review', `➕ Added screen: ${name}`);
  
  // Generate
  emitAgentStatus('designer', 'working', `Generating ${name}`);
  newScreen.status = 'generating';
  broadcast('design:generating', { pipelineId: pipeline.id, screenName: name });
  
  const prompt = `iOS mobile app screen: ${name}

${description}

Style: Modern dark mode iOS app, clean minimal UI, SF Pro font.`;

  try {
    const result = await stitchClient.generateScreen(
      pipeline.design.stitchProjectId,
      pipeline.projectName,
      name,
      prompt
    );
    
    newScreen.screenshot = result.screenshot;
    newScreen.html = result.html;
    newScreen.status = 'ready';
    
    pipelineLog(pipeline.id, 'designer', `✅ ${name} ready`);
    broadcast('design:ready', { pipelineId: pipeline.id, screenName: name, screenshot: result.screenshot });
    
  } catch (error) {
    newScreen.status = 'error';
  }
  
  emitAgentStatus('designer', 'idle');
  res.json(newScreen);
});

// Get pipeline logs
app.get('/api/pipeline/:id/logs', (req, res) => {
  const pipeline = activePipelines.get(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json(pipeline.logs);
});

// ============================================================================
// EXISTING ENDPOINTS (kept for compatibility)
// ============================================================================

// Agents
app.get('/api/agents', async (req, res) => {
  try {
    const { stdout } = await execAsync('openclaw agents list --json 2>/dev/null');
    const agents = JSON.parse(stdout || '[]');
    if (agents.length > 0) return res.json(agents);
  } catch {}
  
  try {
    const dirs = await fs.readdir(AGENTS_DIR);
    const agents = await Promise.all(
      dirs.filter(d => !d.startsWith('.')).map(async (id) => {
        try {
          const configPath = path.join(AGENTS_DIR, id, 'agent.yaml');
          const data = await fs.readFile(configPath, 'utf-8').catch(() => '');
          const name = data.match(/name:\s*["']?([^"'\n]+)/)?.[1]?.trim() || id;
          const emoji = data.match(/emoji:\s*["']?([^\s"'\n]+)/)?.[1]?.trim() || '🤖';
          return { id, name, emoji };
        } catch {
          return { id, name: id, emoji: '🤖' };
        }
      })
    );
    res.json(agents);
  } catch {
    res.json([]);
  }
});

app.post('/api/agents/:id/chat', async (req, res) => {
  const { id } = req.params;
  const { message, project } = req.body;
  
  emitAgentStatus(id, 'working', message.substring(0, 50));
  
  try {
    const response = await agentExecutor.chat(id, message, project);
    emitAgentStatus(id, 'idle');
    res.json({ response, realAgent: true });
  } catch (e) {
    emitAgentStatus(id, 'idle');
    res.json({ response: `Agent ${id} unavailable: ${e.message}`, fallback: true });
  }
});

// Projects
app.get('/api/projects', async (req, res) => {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const projectPath = path.join(PROJECTS_DIR, entry.name);
        let config = {};
        try {
          config = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8'));
        } catch {}
        
        projects.push({
          name: entry.name,
          path: projectPath,
          ...config
        });
      }
    }
    res.json(projects);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:name', async (req, res) => {
  const projectPath = path.join(PROJECTS_DIR, req.params.name);
  try {
    let config = {};
    try {
      config = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8'));
    } catch {}
    res.json({ name: req.params.name, path: projectPath, ...config });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/api/projects/:name/designs', async (req, res) => {
  const designsPath = path.join(PROJECTS_DIR, req.params.name, 'designs');
  try {
    const files = await fs.readdir(designsPath);
    const designs = files
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map(f => ({
        name: f.replace(/\.[^.]+$/, ''),
        file: f,
        thumbnail: `/static/projects/${req.params.name}/designs/${f}`
      }));
    res.json(designs);
  } catch {
    res.json([]);
  }
});

app.get('/api/projects/:name/screenshots', async (req, res) => {
  const screenshotsPath = path.join(PROJECTS_DIR, req.params.name, 'screenshots');
  try {
    const files = await fs.readdir(screenshotsPath);
    const screenshots = files
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
      .map(f => ({
        name: f.replace(/\.[^.]+$/, ''),
        path: `/static/projects/${req.params.name}/screenshots/${f}`
      }));
    res.json(screenshots);
  } catch {
    res.json([]);
  }
});

// Simulators
app.get('/api/simulators', async (req, res) => {
  try {
    const { stdout } = await execAsync('xcrun simctl list devices available --json');
    const data = JSON.parse(stdout);
    const sims = [];
    for (const [runtime, devices] of Object.entries(data.devices)) {
      for (const d of devices) {
        if (d.isAvailable) {
          sims.push({ ...d, runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', '') });
        }
      }
    }
    res.json(sims);
  } catch {
    res.json([]);
  }
});

app.post('/api/simulators/:udid/boot', async (req, res) => {
  try {
    await execAsync(`xcrun simctl boot ${req.params.udid}`);
    await execAsync('open -a Simulator');
    res.json({ success: true });
  } catch { res.json({ success: true }); }
});

app.post('/api/simulators/:udid/shutdown', async (req, res) => {
  try {
    await execAsync(`xcrun simctl shutdown ${req.params.udid}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Shell
app.post('/api/shell', async (req, res) => {
  const { command, cwd } = req.body;
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: cwd || WORKSPACE, timeout: 60000 });
    res.json({ stdout, stderr });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Activity
app.get('/api/activity', (req, res) => {
  res.json(store.getActivity(parseInt(req.query.limit) || 100));
});

// ============================================================================
// WIZARD (for initial PM analysis)
// ============================================================================
app.post('/api/wizard/analyze', async (req, res) => {
  const { name, type, description } = req.body;
  
  broadcast('agent:status', { agent: 'pm', status: 'working', message: 'Analyzing' });
  
  // Context-aware feature and screen suggestions
  const keywords = (description || '').toLowerCase();
  let features = [];
  let screens = [];
  
  if (type === 'ios') {
    features = ['Dark Mode', 'Push Notifications', 'Haptic Feedback'];
    screens = [
      { name: 'Home', description: 'Main landing screen with key features' },
      { name: 'Settings', description: 'App settings and preferences' }
    ];
  }
  
  // Pattern matching for better suggestions
  const patterns = {
    'social|chat|message|community': { 
      f: ['Direct Messages', 'User Profiles', 'Activity Feed', 'Notifications'], 
      s: [
        { name: 'Feed', description: 'Social feed showing posts and activities' },
        { name: 'Chat', description: 'Direct messaging interface' },
        { name: 'Profile', description: 'User profile with avatar, bio, and stats' }
      ]
    },
    'photo|camera|image|gallery': { 
      f: ['Camera Access', 'Photo Gallery', 'Image Filters', 'Share'], 
      s: [
        { name: 'Camera', description: 'Camera capture screen with controls' },
        { name: 'Gallery', description: 'Photo grid gallery view' },
        { name: 'Editor', description: 'Photo editing with filters and adjustments' }
      ]
    },
    'fitness|health|workout|exercise': { 
      f: ['HealthKit Integration', 'Workout Tracking', 'Progress Charts', 'Goals'], 
      s: [
        { name: 'Dashboard', description: 'Fitness dashboard with today\'s stats' },
        { name: 'Workout', description: 'Active workout tracking screen' },
        { name: 'Progress', description: 'Charts and graphs showing progress over time' }
      ]
    },
    'music|audio|player|podcast': { 
      f: ['Background Audio', 'Playlists', 'Offline Mode', 'AirPlay'], 
      s: [
        { name: 'Player', description: 'Now playing screen with album art and controls' },
        { name: 'Library', description: 'Music library with albums, artists, playlists' },
        { name: 'Search', description: 'Search and discover new content' }
      ]
    },
    'task|todo|note|reminder': { 
      f: ['Task Lists', 'Reminders', 'Tags', 'CloudKit Sync', 'Widgets'], 
      s: [
        { name: 'Tasks', description: 'Task list with checkboxes and categories' },
        { name: 'Detail', description: 'Task detail view with notes and due date' },
        { name: 'Calendar', description: 'Calendar view of scheduled tasks' }
      ]
    },
    'shop|store|ecommerce|buy|cart': { 
      f: ['Shopping Cart', 'Apple Pay', 'Order History', 'Wishlist'], 
      s: [
        { name: 'Products', description: 'Product grid with images and prices' },
        { name: 'ProductDetail', description: 'Product detail with images, description, add to cart' },
        { name: 'Cart', description: 'Shopping cart with checkout button' },
        { name: 'Checkout', description: 'Checkout flow with payment options' }
      ]
    },
    'ai|chat|assistant|gpt': { 
      f: ['AI Chat', 'Chat History', 'Voice Input', 'Markdown Support'], 
      s: [
        { name: 'Chat', description: 'AI chat interface with message bubbles' },
        { name: 'History', description: 'List of previous conversations' },
        { name: 'Settings', description: 'AI model settings and preferences' }
      ]
    },
    'weather|forecast': { 
      f: ['Location Services', 'Widgets', 'Notifications', 'Hourly Forecast'], 
      s: [
        { name: 'Today', description: 'Current weather with temperature and conditions' },
        { name: 'Forecast', description: '7-day forecast with daily highs and lows' },
        { name: 'Radar', description: 'Weather radar map' }
      ]
    }
  };
  
  for (const [pattern, { f, s }] of Object.entries(patterns)) {
    if (new RegExp(pattern).test(keywords)) {
      features.push(...f);
      screens.push(...s);
    }
  }
  
  // Deduplicate
  features = [...new Set(features)].slice(0, 12);
  const screenNames = new Set();
  screens = screens.filter(s => {
    if (screenNames.has(s.name)) return false;
    screenNames.add(s.name);
    return true;
  }).slice(0, 8);
  
  // Simulate PM thinking time
  await new Promise(r => setTimeout(r, 800));
  
  broadcast('agent:status', { agent: 'pm', status: 'idle' });
  
  res.json({ features, screens });
});

// ============================================================================
// START
// ============================================================================
const PORT = process.env.PORT || 3001;

store.init().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Dashboard API: http://localhost:${PORT}`);
    console.log(`🎨 Stitch MCP: Ready`);
    console.log(`🤖 Agents: Real agent execution`);
    console.log(`🔧 Pipeline: Ready`);
  });
});
