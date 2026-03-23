// OpenClaw Gateway Client
// Secure WebSocket connection to gateway for agent communication

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

class GatewayClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.pendingRequests = new Map();
    this.requestId = 1;
    this.reconnectTimer = null;
    this.pingTimer = null;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const headers = {};
      if (GATEWAY_TOKEN) {
        headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
      }
      
      this.ws = new WebSocket(GATEWAY_URL, { headers });
      
      this.ws.on('open', () => {
        console.log('✅ Gateway connected');
        this.connected = true;
        this.emit('connected');
        this.startPing();
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (e) {
          console.error('Gateway message parse error:', e);
        }
      });
      
      this.ws.on('close', () => {
        console.log('Gateway disconnected');
        this.connected = false;
        this.stopPing();
        this.emit('disconnected');
        this.scheduleReconnect();
      });
      
      this.ws.on('error', (err) => {
        console.error('Gateway error:', err.message);
        if (!this.connected) reject(err);
      });
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, 5000);
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  handleMessage(msg) {
    // Handle RPC response
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(msg.id);
      clearTimeout(timeout);
      this.pendingRequests.delete(msg.id);
      
      if (msg.error) {
        reject(new Error(msg.error.message || 'RPC error'));
      } else {
        resolve(msg.result);
      }
      return;
    }
    
    // Handle events
    if (msg.type === 'chat') {
      this.emit('chat', msg.data);
    } else if (msg.type === 'agent') {
      this.emit('agent_status', msg.data);
    }
  }

  async call(method, params = {}, timeoutMs = 120000) {
    if (!this.connected) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Gateway call timeout: ${method}`));
      }, timeoutMs);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params
      }));
    });
  }

  // Chat methods
  async sendMessage(sessionKey, message, idempotencyKey = null) {
    const key = idempotencyKey || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.call('chat.send', {
      sessionKey,
      message,
      idempotencyKey: key
    });
  }

  async getHistory(sessionKey, limit = 20) {
    return this.call('chat.history', { sessionKey, limit });
  }

  async abortRun(sessionKey, runId) {
    return this.call('chat.abort', { sessionKey, runId });
  }

  // Session helpers
  getSessionKey(agentId) {
    return `agent:${agentId}:main`;
  }

  close() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new GatewayClient();
