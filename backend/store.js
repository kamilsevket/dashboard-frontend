// Persistent store for dashboard state
import fs from 'fs/promises';
import path from 'path';

const STORE_DIR = process.env.HOME + '/clawd-main/dashboard/.store';
const ACTIVITY_FILE = path.join(STORE_DIR, 'activity.json');
const CHATS_FILE = path.join(STORE_DIR, 'chats.json');
const PIPELINES_FILE = path.join(STORE_DIR, 'pipelines.json');

// In-memory cache
let activity = [];
let chats = {}; // { agentId: [messages] }
let pipelines = []; // Active/recent pipelines

// Initialize store
export async function init() {
  try {
    await fs.mkdir(STORE_DIR, { recursive: true });
    
    // Load activity
    try {
      const data = await fs.readFile(ACTIVITY_FILE, 'utf-8');
      activity = JSON.parse(data);
    } catch { activity = []; }
    
    // Load chats
    try {
      const data = await fs.readFile(CHATS_FILE, 'utf-8');
      chats = JSON.parse(data);
    } catch { chats = {}; }
    
    // Load pipelines
    try {
      const data = await fs.readFile(PIPELINES_FILE, 'utf-8');
      pipelines = JSON.parse(data);
    } catch { pipelines = []; }
    
    console.log(`📦 Store loaded: ${activity.length} events, ${Object.keys(chats).length} chat threads`);
  } catch (e) {
    console.error('Store init error:', e);
  }
}

// Save to disk (debounced)
let saveTimer = null;
async function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await fs.writeFile(ACTIVITY_FILE, JSON.stringify(activity.slice(-500), null, 2));
      await fs.writeFile(CHATS_FILE, JSON.stringify(chats, null, 2));
      await fs.writeFile(PIPELINES_FILE, JSON.stringify(pipelines.slice(-20), null, 2));
    } catch (e) {
      console.error('Store save error:', e);
    }
  }, 1000);
}

// Activity
export function addActivity(event) {
  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: Date.now(),
    ...event
  };
  activity.push(entry);
  if (activity.length > 500) activity = activity.slice(-500);
  save();
  return entry;
}

export function getActivity(limit = 100) {
  return activity.slice(-limit);
}

export function clearActivity() {
  activity = [];
  save();
}

// Chats
export function addChatMessage(agentId, message) {
  if (!chats[agentId]) chats[agentId] = [];
  const entry = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: Date.now(),
    ...message
  };
  chats[agentId].push(entry);
  if (chats[agentId].length > 100) chats[agentId] = chats[agentId].slice(-100);
  save();
  return entry;
}

export function getChatHistory(agentId, limit = 50) {
  return (chats[agentId] || []).slice(-limit);
}

export function getAllChats() {
  return chats;
}

export function clearChat(agentId) {
  if (agentId) {
    delete chats[agentId];
  } else {
    chats = {};
  }
  save();
}

// Pipelines
export function addPipeline(pipeline) {
  const entry = {
    id: `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    startTime: Date.now(),
    status: 'running',
    ...pipeline
  };
  pipelines.push(entry);
  if (pipelines.length > 20) pipelines = pipelines.slice(-20);
  save();
  return entry;
}

export function savePipeline(pipeline) {
  const idx = pipelines.findIndex(p => p.id === pipeline.id);
  if (idx >= 0) {
    pipelines[idx] = pipeline;
  } else {
    pipelines.push(pipeline);
  }
  save();
  return pipeline;
}

export function updatePipeline(id, updates) {
  const idx = pipelines.findIndex(p => p.id === id);
  if (idx >= 0) {
    pipelines[idx] = { ...pipelines[idx], ...updates };
    save();
    return pipelines[idx];
  }
  return null;
}

export function getPipeline(id) {
  return pipelines.find(p => p.id === id) || null;
}

export function getPipelines(limit = 10) {
  return pipelines.slice(-limit);
}

export function getActivePipeline() {
  return pipelines.filter(p => p.status === 'running').pop() || null;
}

export default {
  init,
  addActivity,
  getActivity,
  clearActivity,
  addChatMessage,
  getChatHistory,
  getAllChats,
  clearChat,
  addPipeline,
  savePipeline,
  updatePipeline,
  getPipeline,
  getPipelines,
  getActivePipeline
};
