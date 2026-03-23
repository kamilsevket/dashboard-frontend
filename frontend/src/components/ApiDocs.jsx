import { useState, useEffect } from 'react'
import { API, authFetch } from '../config'

const API_ROUTES = [
  // Auth
  { method: 'POST', path: '/api/auth/login', desc: 'Login with password', auth: false, body: { password: 'string' } },
  
  // Health
  { method: 'GET', path: '/api/health', desc: 'Health check', auth: false },
  
  // Activity
  { method: 'GET', path: '/api/activity', desc: 'Get activity logs', auth: true, params: { limit: 'number' } },
  { method: 'DELETE', path: '/api/activity', desc: 'Clear activity logs', auth: true },
  
  // Agents
  { method: 'GET', path: '/api/agents', desc: 'List all agents', auth: true },
  { method: 'POST', path: '/api/agents/:id/chat', desc: 'Send message to agent', auth: true, body: { message: 'string' } },
  
  // Projects
  { method: 'GET', path: '/api/projects', desc: 'List all projects', auth: true },
  { method: 'GET', path: '/api/projects/:name', desc: 'Get project details', auth: true },
  { method: 'POST', path: '/api/projects', desc: 'Create new project', auth: true, body: { name: 'string', template: 'string' } },
  { method: 'GET', path: '/api/projects/:name/files', desc: 'List project files', auth: true },
  { method: 'GET', path: '/api/projects/:name/designs', desc: 'List project designs', auth: true },
  { method: 'GET', path: '/api/projects/:name/pipelines', desc: 'Get project pipelines', auth: true },
  { method: 'GET', path: '/api/projects/:name/activity', desc: 'Get project activity', auth: true },
  { method: 'POST', path: '/api/projects/:name/init-xcode', desc: 'Initialize Xcode project', auth: true },
  { method: 'POST', path: '/api/projects/:name/open-xcode', desc: 'Open project in Xcode', auth: true },
  
  // Pipelines
  { method: 'GET', path: '/api/pipelines', desc: 'List all pipelines', auth: true },
  { method: 'GET', path: '/api/pipelines/active', desc: 'Get active pipelines', auth: true },
  { method: 'POST', path: '/api/pipelines', desc: 'Create pipeline', auth: true, body: { projectId: 'string', steps: 'array' } },
  { method: 'PATCH', path: '/api/pipelines/:id', desc: 'Update pipeline', auth: true },
  
  // Stitch (Google Design)
  { method: 'GET', path: '/api/stitch/projects', desc: 'List Stitch projects', auth: true },
  { method: 'POST', path: '/api/stitch/project', desc: 'Create Stitch project', auth: true, body: { name: 'string' } },
  { method: 'POST', path: '/api/stitch/screen', desc: 'Create screen design', auth: true, body: { projectId: 'string', prompt: 'string' } },
  { method: 'POST', path: '/api/stitch/generate', desc: 'Generate design', auth: true },
  
  // Wizard
  { method: 'POST', path: '/api/wizard/analyze', desc: 'Analyze project requirements', auth: true, body: { description: 'string' } },
  { method: 'POST', path: '/api/wizard/task', desc: 'Execute wizard task', auth: true },
  
  // Git
  { method: 'GET', path: '/api/git/status', desc: 'Get git status', auth: true },
  { method: 'POST', path: '/api/git/commit', desc: 'Commit changes', auth: true, body: { message: 'string' } },
  
  // Xcode
  { method: 'GET', path: '/api/xcode/schemes', desc: 'List Xcode schemes', auth: true },
  { method: 'POST', path: '/api/xcode/build', desc: 'Build Xcode project', auth: true, body: { scheme: 'string', destination: 'string' } },
  
  // Simulators
  { method: 'GET', path: '/api/simulators', desc: 'List iOS simulators', auth: true },
  { method: 'POST', path: '/api/simulators/:udid/boot', desc: 'Boot simulator', auth: true },
  { method: 'POST', path: '/api/simulators/:udid/shutdown', desc: 'Shutdown simulator', auth: true },
  
  // Shell
  { method: 'POST', path: '/api/shell', desc: 'Execute shell command', auth: true, body: { command: 'string', cwd: 'string?' } },
  
  // Chats
  { method: 'GET', path: '/api/chats', desc: 'List all chat threads', auth: true },
  { method: 'GET', path: '/api/chats/:agentId', desc: 'Get chat history', auth: true },
  { method: 'DELETE', path: '/api/chats/:agentId', desc: 'Delete chat history', auth: true },
]

const METHOD_COLORS = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-yellow-500',
  PATCH: 'bg-orange-500',
  DELETE: 'bg-red-500'
}

export default function ApiDocs() {
  const [selected, setSelected] = useState(null)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [params, setParams] = useState({})
  const [body, setBody] = useState('')
  const [serverStatus, setServerStatus] = useState(null)

  useEffect(() => {
    checkServer()
  }, [])

  const checkServer = async () => {
    try {
      const res = await fetch(`${API}/health`)
      const data = await res.json()
      setServerStatus({ ok: true, time: data.time })
    } catch (e) {
      setServerStatus({ ok: false, error: e.message })
    }
  }

  const tryEndpoint = async (route) => {
    setLoading(true)
    setResponse(null)
    try {
      let url = `${API}${route.path.replace('/api', '')}`
      
      // Replace path params
      Object.keys(params).forEach(key => {
        url = url.replace(`:${key}`, params[key])
      })

      const options = {
        method: route.method,
        headers: { 'Content-Type': 'application/json' }
      }

      if (route.method !== 'GET' && body) {
        options.body = body
      }

      const res = route.auth ? await authFetch(url, options) : await fetch(url, options)
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data
      })
    } catch (e) {
      setResponse({ error: e.message })
    }
    setLoading(false)
  }

  const categories = [
    { name: 'Auth', routes: API_ROUTES.filter(r => r.path.includes('/auth')) },
    { name: 'Health', routes: API_ROUTES.filter(r => r.path.includes('/health')) },
    { name: 'Agents', routes: API_ROUTES.filter(r => r.path.includes('/agents')) },
    { name: 'Projects', routes: API_ROUTES.filter(r => r.path.includes('/projects')) },
    { name: 'Pipelines', routes: API_ROUTES.filter(r => r.path.includes('/pipelines')) },
    { name: 'Stitch', routes: API_ROUTES.filter(r => r.path.includes('/stitch')) },
    { name: 'Wizard', routes: API_ROUTES.filter(r => r.path.includes('/wizard')) },
    { name: 'Git', routes: API_ROUTES.filter(r => r.path.includes('/git')) },
    { name: 'Xcode', routes: API_ROUTES.filter(r => r.path.includes('/xcode')) },
    { name: 'Simulators', routes: API_ROUTES.filter(r => r.path.includes('/simulators')) },
    { name: 'Shell', routes: API_ROUTES.filter(r => r.path.includes('/shell')) },
    { name: 'Chats', routes: API_ROUTES.filter(r => r.path.includes('/chats')) },
    { name: 'Activity', routes: API_ROUTES.filter(r => r.path.includes('/activity')) },
  ]

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📚 API Documentation</h1>
          <p className="text-gray-400 text-sm mt-1">Interactive API explorer</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm ${serverStatus?.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {serverStatus?.ok ? '● Server Online' : '○ Server Offline'}
          </div>
          <button onClick={checkServer} className="text-gray-400 hover:text-white">
            🔄
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints List */}
        <div className="space-y-4">
          {categories.filter(c => c.routes.length > 0).map(category => (
            <div key={category.name} className="bg-gray-800/50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-700/50 font-semibold text-sm">
                {category.name}
              </div>
              <div className="divide-y divide-gray-700/50">
                {category.routes.map((route, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelected(route)
                      setResponse(null)
                      setParams({})
                      setBody(route.body ? JSON.stringify(route.body, null, 2) : '')
                    }}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-700/30 transition ${selected === route ? 'bg-gray-700/50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${METHOD_COLORS[route.method]} px-2 py-0.5 rounded text-xs font-mono font-bold`}>
                        {route.method}
                      </span>
                      <code className="text-sm text-gray-300">{route.path}</code>
                      {route.auth && <span className="text-yellow-500 text-xs">🔒</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{route.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Try It Panel */}
        <div className="bg-gray-800/50 rounded-lg p-4 h-fit sticky top-6">
          {selected ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className={`${METHOD_COLORS[selected.method]} px-2 py-1 rounded text-sm font-mono font-bold`}>
                  {selected.method}
                </span>
                <code className="text-sm">{selected.path}</code>
              </div>

              <p className="text-gray-400 text-sm mb-4">{selected.desc}</p>

              {/* Path Params */}
              {selected.path.includes(':') && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 block mb-2">Path Parameters</label>
                  {selected.path.match(/:(\w+)/g)?.map(param => {
                    const name = param.slice(1)
                    return (
                      <input
                        key={name}
                        type="text"
                        placeholder={name}
                        value={params[name] || ''}
                        onChange={e => setParams({ ...params, [name]: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm mb-2"
                      />
                    )
                  })}
                </div>
              )}

              {/* Request Body */}
              {selected.body && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 block mb-2">Request Body</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={5}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}

              <button
                onClick={() => tryEndpoint(selected)}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded font-semibold transition"
              >
                {loading ? 'Sending...' : 'Try it →'}
              </button>

              {/* Response */}
              {response && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-400">Response</span>
                    {response.status && (
                      <span className={`text-xs px-2 py-0.5 rounded ${response.status < 300 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {response.status} {response.statusText}
                      </span>
                    )}
                  </div>
                  <pre className="bg-gray-900 rounded p-3 text-xs overflow-auto max-h-80 font-mono">
                    {response.error || JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p className="text-4xl mb-3">👈</p>
              <p>Select an endpoint to try it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
