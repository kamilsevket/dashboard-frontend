/**
 * Pipeline Engine - Real App Development Pipeline
 * 
 * Stages:
 * 1. analyze - PM analyzes app idea
 * 2. design - Stitch generates UI designs (parallel with scaffold)
 * 3. scaffold - ios-dev creates base project structure
 * 4. review - User reviews/approves designs
 * 5. implement - ios-dev implements approved designs
 * 6. test - Write and run tests
 * 7. screenshot - Capture simulator screenshots
 * 8. complete - All done
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

const PROJECTS_DIR = process.env.HOME + '/clawd-main/dashboard/projects';

class Pipeline extends EventEmitter {
  constructor(store, agents, stitch) {
    super();
    this.store = store;
    this.agents = agents; // Agent executor
    this.stitch = stitch; // Stitch MCP client
    this.activePipelines = new Map();
  }

  /**
   * Create and start a new pipeline
   */
  async create(config) {
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

    // Create project directory
    const projectPath = path.join(PROJECTS_DIR, config.projectName);
    await fs.mkdir(path.join(projectPath, 'designs'), { recursive: true });
    
    // Save project config
    await fs.writeFile(
      path.join(projectPath, 'project.json'),
      JSON.stringify({
        ...config,
        pipelineId: id,
        createdAt: pipeline.createdAt
      }, null, 2)
    );

    this.activePipelines.set(id, pipeline);
    this.store.savePipeline(pipeline);
    
    this.log(id, 'pipeline', '🚀 Pipeline started');
    this.emit('pipeline:created', pipeline);
    
    // Start execution
    this.execute(id);
    
    return pipeline;
  }

  /**
   * Main pipeline execution loop
   */
  async execute(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) return;

    try {
      switch (pipeline.currentStage) {
        case 'analyze':
          await this.runAnalyze(pipelineId);
          break;
          
        case 'design':
          // Design and scaffold run in parallel
          await Promise.all([
            this.runDesign(pipelineId),
            this.runScaffold(pipelineId)
          ]);
          break;
          
        case 'review':
          // Wait for user action - don't auto-advance
          this.log(pipelineId, 'review', '⏸️ Waiting for design review...');
          break;
          
        case 'implement':
          await this.runImplement(pipelineId);
          break;
          
        case 'test':
          await this.runTest(pipelineId);
          break;
          
        case 'screenshot':
          await this.runScreenshot(pipelineId);
          break;
          
        case 'complete':
          this.log(pipelineId, 'complete', '✅ Pipeline complete!');
          pipeline.status = 'complete';
          this.emit('pipeline:complete', pipeline);
          break;
      }
      
      this.store.savePipeline(pipeline);
      
    } catch (error) {
      this.log(pipelineId, 'error', `❌ Error: ${error.message}`);
      pipeline.status = 'error';
      pipeline.error = error.message;
      this.emit('pipeline:error', { pipelineId, error: error.message });
    }
  }

  /**
   * Stage 1: PM Analysis
   */
  async runAnalyze(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    this.log(pipelineId, 'pm', '📋 PM analyzing app idea...');
    this.emitAgentStatus('pm', 'working', 'Analyzing app concept');
    
    const prompt = `Analyze this iOS app idea and suggest specific screens with detailed descriptions:

App: ${pipeline.projectName}
Description: ${pipeline.config.appDescription}
Features: ${pipeline.config.features.join(', ')}

For each screen, provide:
1. Screen name (e.g., "Home", "Profile", "Settings")
2. Detailed UI description for a designer
3. Key UI elements and their purposes

Output as JSON array:
[{"name": "ScreenName", "description": "Detailed design description..."}]`;

    try {
      const result = await this.agents.chat('pm', prompt, pipeline.projectName);
      
      // Parse PM's response for screens
      let screens = pipeline.config.screens;
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          screens = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        this.log(pipelineId, 'pm', '⚠️ Using default screens');
      }

      // Initialize design screens
      pipeline.design.screens = screens.map(s => ({
        name: s.name,
        description: s.description,
        status: 'pending',
        prompt: s.description,
        screenshot: null,
        html: null,
        feedback: null,
        version: 1
      }));
      
      this.log(pipelineId, 'pm', `✅ Identified ${screens.length} screens`);
      this.emitAgentStatus('pm', 'idle');
      
      // Move to next stage
      this.advanceStage(pipelineId, 'design');
      
    } catch (error) {
      this.log(pipelineId, 'pm', `❌ Analysis failed: ${error.message}`);
      this.emitAgentStatus('pm', 'idle');
      throw error;
    }
  }

  /**
   * Stage 2a: Design Generation with Stitch
   */
  async runDesign(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    this.log(pipelineId, 'designer', '🎨 Starting design generation...');
    this.emitAgentStatus('designer', 'working', 'Generating UI designs');
    
    try {
      // Create Stitch project
      const stitchProject = await this.stitch.createProject(pipeline.projectName);
      pipeline.design.stitchProjectId = stitchProject.projectId;
      
      // Generate each screen
      for (const screen of pipeline.design.screens) {
        this.log(pipelineId, 'designer', `🎨 Generating: ${screen.name}...`);
        screen.status = 'generating';
        this.emit('design:generating', { pipelineId, screenName: screen.name });
        
        const prompt = `iOS mobile app screen: ${screen.name}
        
${screen.description}

Style: Modern dark mode iOS app, clean minimal UI, SF Pro font, proper spacing, iOS design patterns.
Include: Navigation bar, proper safe areas, iOS-native components.`;

        try {
          const result = await this.stitch.generateScreen(
            pipeline.design.stitchProjectId,
            pipeline.projectName,
            screen.name,
            prompt
          );
          
          screen.screenshot = result.screenshot;
          screen.html = result.html;
          screen.status = 'ready';
          
          this.log(pipelineId, 'designer', `✅ ${screen.name} design ready`);
          this.emit('design:ready', { 
            pipelineId, 
            screenName: screen.name, 
            screenshot: result.screenshot 
          });
          
        } catch (error) {
          screen.status = 'error';
          screen.error = error.message;
          this.log(pipelineId, 'designer', `❌ ${screen.name} failed: ${error.message}`);
        }
      }
      
      this.emitAgentStatus('designer', 'idle');
      this.log(pipelineId, 'designer', '✅ All designs generated');
      
      // Check if scaffold is also done
      this.checkDesignAndScaffoldComplete(pipelineId);
      
    } catch (error) {
      this.emitAgentStatus('designer', 'idle');
      throw error;
    }
  }

  /**
   * Stage 2b: iOS Scaffold Generation (runs parallel with design)
   */
  async runScaffold(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    this.log(pipelineId, 'ios-dev', '🍎 Creating iOS project scaffold...');
    this.emitAgentStatus('ios-dev', 'working', 'Creating project structure');
    
    const projectPath = path.join(PROJECTS_DIR, pipeline.projectName);
    
    try {
      // Generate screen list for the agent
      const screenNames = pipeline.design.screens.map(s => s.name);
      
      const prompt = `Create a complete, buildable iOS SwiftUI project structure for "${pipeline.projectName}".

Screens needed: ${screenNames.join(', ')}
Features: ${pipeline.config.features.join(', ')}
Description: ${pipeline.config.appDescription}

Requirements:
1. Create proper Xcode project structure with .xcodeproj
2. Create placeholder SwiftUI views for each screen (with TODO comments for UI)
3. Set up navigation (TabView or NavigationStack as appropriate)
4. Create data models based on features
5. Create service layer stubs
6. Make it compile and run on simulator
7. Use modern Swift 5.9+ and iOS 17+ patterns

Project path: ${projectPath}

Create all necessary files. The UI will be implemented later from designs.`;

      const result = await this.agents.chat('ios-dev', prompt, pipeline.projectName);
      
      // Find xcodeproj
      const { stdout } = await this.agents.exec(
        `find "${projectPath}" -maxdepth 3 -name "*.xcodeproj" | head -1`
      );
      
      if (stdout.trim()) {
        pipeline.development.xcodeProject = stdout.trim();
        pipeline.development.status = 'scaffold';
        this.log(pipelineId, 'ios-dev', `✅ Project created: ${path.basename(stdout.trim())}`);
      } else {
        this.log(pipelineId, 'ios-dev', '⚠️ No .xcodeproj found, scaffold may be incomplete');
      }
      
      this.emitAgentStatus('ios-dev', 'idle');
      
      // Check if design is also done
      this.checkDesignAndScaffoldComplete(pipelineId);
      
    } catch (error) {
      this.emitAgentStatus('ios-dev', 'idle');
      this.log(pipelineId, 'ios-dev', `❌ Scaffold failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if both design and scaffold are complete to move to review
   */
  checkDesignAndScaffoldComplete(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    
    const designsReady = pipeline.design.screens.every(
      s => s.status === 'ready' || s.status === 'error'
    );
    const scaffoldReady = pipeline.development.status !== 'pending';
    
    if (designsReady && scaffoldReady) {
      this.advanceStage(pipelineId, 'review');
    }
  }

  /**
   * Stage 3: Review - User provides feedback or approves
   */
  async submitFeedback(pipelineId, screenName, feedback) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) throw new Error('Pipeline not found');
    
    const screen = pipeline.design.screens.find(s => s.name === screenName);
    if (!screen) throw new Error('Screen not found');
    
    screen.feedback = feedback;
    screen.status = 'feedback';
    screen.version++;
    
    this.log(pipelineId, 'review', `📝 Feedback for ${screenName}: ${feedback.substring(0, 50)}...`);
    this.store.savePipeline(pipeline);
    this.emit('design:feedback', { pipelineId, screenName, feedback });
    
    // Re-generate this screen
    await this.regenerateScreen(pipelineId, screenName);
  }

  async regenerateScreen(pipelineId, screenName) {
    const pipeline = this.activePipelines.get(pipelineId);
    const screen = pipeline.design.screens.find(s => s.name === screenName);
    
    this.log(pipelineId, 'designer', `🔄 Regenerating ${screenName} (v${screen.version})...`);
    this.emitAgentStatus('designer', 'working', `Updating ${screenName}`);
    screen.status = 'generating';
    
    const prompt = `iOS mobile app screen: ${screen.name}

Original: ${screen.description}

User feedback: ${screen.feedback}

Please update the design according to the feedback. Style: Modern dark mode iOS app.`;

    try {
      const result = await this.stitch.generateScreen(
        pipeline.design.stitchProjectId,
        pipeline.projectName,
        `${screen.name}_v${screen.version}`,
        prompt
      );
      
      screen.screenshot = result.screenshot;
      screen.html = result.html;
      screen.status = 'ready';
      screen.feedback = null;
      
      this.log(pipelineId, 'designer', `✅ ${screenName} v${screen.version} ready`);
      this.emit('design:ready', { pipelineId, screenName, screenshot: result.screenshot });
      
    } catch (error) {
      screen.status = 'error';
      this.log(pipelineId, 'designer', `❌ Regeneration failed: ${error.message}`);
    }
    
    this.emitAgentStatus('designer', 'idle');
    this.store.savePipeline(pipeline);
  }

  async addScreen(pipelineId, screenData) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) throw new Error('Pipeline not found');
    
    const newScreen = {
      name: screenData.name,
      description: screenData.description,
      status: 'pending',
      prompt: screenData.description,
      screenshot: null,
      html: null,
      feedback: null,
      version: 1
    };
    
    pipeline.design.screens.push(newScreen);
    this.log(pipelineId, 'review', `➕ Added new screen: ${screenData.name}`);
    this.store.savePipeline(pipeline);
    
    // Generate the new screen
    await this.generateSingleScreen(pipelineId, newScreen);
    
    return newScreen;
  }

  async generateSingleScreen(pipelineId, screen) {
    const pipeline = this.activePipelines.get(pipelineId);
    
    this.log(pipelineId, 'designer', `🎨 Generating: ${screen.name}...`);
    this.emitAgentStatus('designer', 'working', `Designing ${screen.name}`);
    screen.status = 'generating';
    
    const prompt = `iOS mobile app screen: ${screen.name}
    
${screen.description}

Style: Modern dark mode iOS app, clean minimal UI, SF Pro font, iOS design patterns.`;

    try {
      const result = await this.stitch.generateScreen(
        pipeline.design.stitchProjectId,
        pipeline.projectName,
        screen.name,
        prompt
      );
      
      screen.screenshot = result.screenshot;
      screen.html = result.html;
      screen.status = 'ready';
      
      this.log(pipelineId, 'designer', `✅ ${screen.name} ready`);
      this.emit('design:ready', { pipelineId, screenName: screen.name, screenshot: result.screenshot });
      
    } catch (error) {
      screen.status = 'error';
      this.log(pipelineId, 'designer', `❌ Generation failed: ${error.message}`);
    }
    
    this.emitAgentStatus('designer', 'idle');
    this.store.savePipeline(pipeline);
  }

  async approveAllDesigns(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) throw new Error('Pipeline not found');
    
    // Mark all ready screens as approved
    pipeline.design.screens.forEach(s => {
      if (s.status === 'ready') {
        s.status = 'approved';
      }
    });
    
    pipeline.design.reviewStatus = 'approved';
    this.log(pipelineId, 'review', '✅ All designs approved!');
    this.store.savePipeline(pipeline);
    this.emit('design:approved', { pipelineId });
    
    // Advance to implementation
    this.advanceStage(pipelineId, 'implement');
  }

  /**
   * Stage 4: Implement approved designs
   */
  async runImplement(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    const approvedScreens = pipeline.design.screens.filter(s => s.status === 'approved');
    
    this.log(pipelineId, 'ios-dev', `🛠️ Implementing ${approvedScreens.length} screens...`);
    this.emitAgentStatus('ios-dev', 'working', 'Implementing designs');
    pipeline.development.status = 'implementing';
    
    for (const screen of approvedScreens) {
      this.log(pipelineId, 'ios-dev', `📱 Implementing ${screen.name}...`);
      
      try {
        // Read the HTML design
        let designCode = '';
        if (screen.html) {
          const htmlPath = path.join(PROJECTS_DIR, pipeline.projectName, 'designs', 
            `${screen.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`);
          try {
            designCode = await fs.readFile(htmlPath, 'utf-8');
          } catch (e) {
            // HTML file might not exist, use description
          }
        }

        const prompt = `Implement the SwiftUI view for "${screen.name}" screen.

Design screenshot: ${screen.screenshot || 'See description'}
${designCode ? `HTML/CSS reference:\n\`\`\`html\n${designCode.substring(0, 3000)}\n\`\`\`` : ''}

Design description: ${screen.description}

Requirements:
1. Match the design as closely as possible
2. Use proper SwiftUI components
3. Include all UI elements shown
4. Use proper iOS patterns (NavigationStack, etc.)
5. Make it responsive and accessible
6. Update the existing placeholder view

Project: ${pipeline.projectName}
File: ${screen.name}View.swift`;

        await this.agents.chat('ios-dev', prompt, pipeline.projectName);
        
        pipeline.development.implementedScreens.push(screen.name);
        this.log(pipelineId, 'ios-dev', `✅ ${screen.name} implemented`);
        this.emit('implement:screen', { pipelineId, screenName: screen.name });
        
      } catch (error) {
        this.log(pipelineId, 'ios-dev', `❌ ${screen.name} failed: ${error.message}`);
      }
    }
    
    // Build the project
    this.log(pipelineId, 'ios-dev', '🔨 Building project...');
    pipeline.development.buildStatus = 'building';
    
    try {
      const buildResult = await this.agents.exec(
        `cd "${path.join(PROJECTS_DIR, pipeline.projectName)}" && ` +
        `xcodebuild -scheme "${pipeline.projectName}" -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 15' build 2>&1 | tail -20`
      );
      
      if (buildResult.includes('BUILD SUCCEEDED')) {
        pipeline.development.buildStatus = 'success';
        this.log(pipelineId, 'ios-dev', '✅ Build succeeded!');
      } else {
        pipeline.development.buildStatus = 'failed';
        this.log(pipelineId, 'ios-dev', '❌ Build failed, check logs');
      }
    } catch (e) {
      pipeline.development.buildStatus = 'failed';
      this.log(pipelineId, 'ios-dev', `❌ Build error: ${e.message}`);
    }
    
    this.emitAgentStatus('ios-dev', 'idle');
    pipeline.development.status = 'complete';
    this.store.savePipeline(pipeline);
    
    // Move to testing
    this.advanceStage(pipelineId, 'test');
  }

  /**
   * Stage 5: Testing
   */
  async runTest(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    
    this.log(pipelineId, 'ios-test', '🧪 Starting test phase...');
    this.emitAgentStatus('ios-test', 'working', 'Writing tests');
    pipeline.testing.status = 'running';
    
    try {
      // Generate unit tests
      this.log(pipelineId, 'ios-test', '📝 Writing unit tests...');
      
      const unitTestPrompt = `Write unit tests for the ${pipeline.projectName} iOS app.

Screens: ${pipeline.design.screens.map(s => s.name).join(', ')}
Features: ${pipeline.config.features.join(', ')}

Create XCTest unit tests for:
1. ViewModels / business logic
2. Data models
3. Service layer

Put tests in the Tests folder with proper structure.`;

      await this.agents.chat('ios-test', unitTestPrompt, pipeline.projectName);
      this.log(pipelineId, 'ios-test', '✅ Unit tests written');
      
      // Generate UI tests
      this.log(pipelineId, 'ios-test', '📝 Writing UI tests...');
      
      const uiTestPrompt = `Write XCUITest UI tests for the ${pipeline.projectName} iOS app.

Test each screen: ${pipeline.design.screens.map(s => s.name).join(', ')}

Create UI tests that:
1. Navigate to each screen
2. Verify key UI elements exist
3. Test basic interactions

Put tests in the UITests folder.`;

      await this.agents.chat('ios-test', uiTestPrompt, pipeline.projectName);
      this.log(pipelineId, 'ios-test', '✅ UI tests written');
      
      // Run tests
      this.log(pipelineId, 'ios-test', '🏃 Running tests...');
      
      const testResult = await this.agents.exec(
        `cd "${path.join(PROJECTS_DIR, pipeline.projectName)}" && ` +
        `xcodebuild test -scheme "${pipeline.projectName}" -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | grep -E "(Test Case|passed|failed)" | tail -30`
      );
      
      // Parse test results
      const passedMatch = testResult.match(/(\d+) tests? passed/);
      const failedMatch = testResult.match(/(\d+) tests? failed/);
      
      pipeline.testing.unitTests.passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      pipeline.testing.unitTests.failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      pipeline.testing.unitTests.total = pipeline.testing.unitTests.passed + pipeline.testing.unitTests.failed;
      
      this.log(pipelineId, 'ios-test', 
        `✅ Tests: ${pipeline.testing.unitTests.passed} passed, ${pipeline.testing.unitTests.failed} failed`
      );
      
    } catch (error) {
      this.log(pipelineId, 'ios-test', `❌ Test error: ${error.message}`);
    }
    
    this.emitAgentStatus('ios-test', 'idle');
    pipeline.testing.status = 'complete';
    this.store.savePipeline(pipeline);
    
    // Move to screenshots
    this.advanceStage(pipelineId, 'screenshot');
  }

  /**
   * Stage 6: Screenshot Capture
   */
  async runScreenshot(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    
    this.log(pipelineId, 'screenshot', '📸 Capturing screenshots...');
    pipeline.screenshots.status = 'capturing';
    
    const screenshotDir = path.join(PROJECTS_DIR, pipeline.projectName, 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });
    
    try {
      // Boot simulator
      this.log(pipelineId, 'screenshot', '📱 Booting simulator...');
      await this.agents.exec('xcrun simctl boot "iPhone 15" 2>/dev/null || true');
      await this.agents.exec('open -a Simulator');
      await new Promise(r => setTimeout(r, 3000)); // Wait for boot
      
      // Build and install app
      this.log(pipelineId, 'screenshot', '📦 Installing app...');
      const projectPath = path.join(PROJECTS_DIR, pipeline.projectName);
      await this.agents.exec(
        `cd "${projectPath}" && xcodebuild -scheme "${pipeline.projectName}" ` +
        `-destination 'platform=iOS Simulator,name=iPhone 15' build 2>/dev/null`
      );
      
      // Find and install the app
      const { stdout: appPath } = await this.agents.exec(
        `find ~/Library/Developer/Xcode/DerivedData -name "${pipeline.projectName}.app" -path "*/Debug-iphonesimulator/*" | head -1`
      );
      
      if (appPath.trim()) {
        await this.agents.exec(`xcrun simctl install "iPhone 15" "${appPath.trim()}"`);
        
        // Launch app
        const bundleId = `com.app.${pipeline.projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        await this.agents.exec(`xcrun simctl launch "iPhone 15" "${bundleId}"`);
        await new Promise(r => setTimeout(r, 2000));
        
        // Capture screenshot
        const screenshotPath = path.join(screenshotDir, 'main.png');
        await this.agents.exec(`xcrun simctl io "iPhone 15" screenshot "${screenshotPath}"`);
        
        pipeline.screenshots.images.push({
          screen: 'Main',
          path: `/static/projects/${pipeline.projectName}/screenshots/main.png`
        });
        
        this.log(pipelineId, 'screenshot', '✅ Screenshot captured');
        this.emit('screenshot:captured', { 
          pipelineId, 
          path: pipeline.screenshots.images[0].path 
        });
      }
      
    } catch (error) {
      this.log(pipelineId, 'screenshot', `❌ Screenshot error: ${error.message}`);
    }
    
    pipeline.screenshots.status = 'complete';
    this.store.savePipeline(pipeline);
    
    // Complete!
    this.advanceStage(pipelineId, 'complete');
  }

  /**
   * Utility methods
   */
  advanceStage(pipelineId, newStage) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) return;
    
    pipeline.currentStage = newStage;
    pipeline.updatedAt = new Date().toISOString();
    
    this.log(pipelineId, 'pipeline', `📍 Stage: ${newStage}`);
    this.emit('pipeline:stage', { pipelineId, stage: newStage });
    this.store.savePipeline(pipeline);
    
    // Continue execution
    this.execute(pipelineId);
  }

  log(pipelineId, source, message) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      source,
      message
    };
    
    pipeline.logs.push(entry);
    this.emit('pipeline:log', { pipelineId, ...entry });
    
    console.log(`[${pipelineId.slice(0, 8)}] [${source}] ${message}`);
  }

  emitAgentStatus(agentId, status, message = '') {
    this.emit('agent:status', { agent: agentId, status, message });
  }

  get(pipelineId) {
    return this.activePipelines.get(pipelineId);
  }

  getAll() {
    return Array.from(this.activePipelines.values());
  }

  pause(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (pipeline) {
      pipeline.status = 'paused';
      this.log(pipelineId, 'pipeline', '⏸️ Pipeline paused');
      this.emit('pipeline:paused', { pipelineId });
    }
  }

  resume(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId);
    if (pipeline && pipeline.status === 'paused') {
      pipeline.status = 'running';
      this.log(pipelineId, 'pipeline', '▶️ Pipeline resumed');
      this.execute(pipelineId);
    }
  }
}

export default Pipeline;
