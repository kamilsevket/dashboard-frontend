// Stitch MCP Client
const STITCH_API_KEY = 'AQ.Ab8RN6Ks0zpnb7lzKUVLGnzeudhUL33BmoFauP-qZ__pq3hnBw';
const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp';

let requestId = 1;

async function callMCP(method, params = {}) {
  const response = await fetch(STITCH_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': STITCH_API_KEY
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId++,
      method,
      params
    })
  });
  
  if (!response.ok) {
    throw new Error(`Stitch API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Stitch MCP error');
  }
  
  return data.result;
}

export async function listTools() {
  return await callMCP('tools/list', {});
}

export async function listProjects() {
  return await callMCP('tools/call', {
    name: 'list_projects',
    arguments: {}
  });
}

export async function createProject(title) {
  return await callMCP('tools/call', {
    name: 'create_project',
    arguments: { title }
  });
}

export async function getProject(projectName) {
  return await callMCP('tools/call', {
    name: 'get_project',
    arguments: { name: projectName }
  });
}

export async function listScreens(projectId) {
  return await callMCP('tools/call', {
    name: 'list_screens',
    arguments: { projectId }
  });
}

export async function getScreen(name, projectId, screenId) {
  return await callMCP('tools/call', {
    name: 'get_screen',
    arguments: { name, projectId, screenId }
  });
}

export async function generateScreen(projectId, prompt, deviceType = 'MOBILE', modelId = 'GEMINI_3_PRO') {
  return await callMCP('tools/call', {
    name: 'generate_screen_from_text',
    arguments: {
      projectId,
      prompt,
      deviceType,
      modelId
    }
  });
}

export async function editScreens(projectId, screenIds, prompt, deviceType = 'MOBILE') {
  return await callMCP('tools/call', {
    name: 'edit_screens',
    arguments: {
      projectId,
      selectedScreenIds: screenIds,
      prompt,
      deviceType
    }
  });
}

export async function generateVariants(projectId, screenIds, prompt, variantOptions = {}) {
  return await callMCP('tools/call', {
    name: 'generate_variants',
    arguments: {
      projectId,
      selectedScreenIds: screenIds,
      prompt,
      variantOptions: {
        variantCount: 3,
        creativeRange: 'EXPLORE',
        ...variantOptions
      }
    }
  });
}

// Download screenshot from FIFE URL
export async function downloadScreenshot(downloadUrl, width = 400) {
  // FIFE URLs need size parameters
  const url = `${downloadUrl}=w${width}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  return await response.arrayBuffer();
}
