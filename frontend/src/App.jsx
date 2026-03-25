import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import OneLiner from './components/OneLiner'
import Login from './components/Login'
import PipelineView from './components/PipelineView'
import ProjectWizard from './components/ProjectWizard'
import { API, WS_URL, authFetch } from './config'
import { APP_VERSION, APP_NAME } from './version'

function App() {
  const [token, setToken] = useState(localStorage.getItem('dashboard_token'))
  const [view, setView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [projects, setProjects] = useState([])
  const [agents, setAgents] = useState([])
  const [agentStatus, setAgentStatus] = useState({})
  const [logs, setLogs] = useState([])
  const [activeTasks, setActiveTasks] = useState([])
  
  // Pipeline state
  const [activePipeline, setActivePipeline] = useState(() => {
    try {
      const saved = localStorage.getItem('activePipeline')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [showWizard, setShowWizard] = useState(false)
  
  // Persist pipeline to localStorage
  useEffect(() => {
    if (activePipeline) {
      localStorage.setItem('activePipeline', JSON.stringify(activePipeline))
    } else {
      localStorage.removeItem('activePipeline')
    }
  }, [activePipeline])

  if (!token) {
    return <Login onLogin={(t) => setToken(t)} />
  }

  useEffect(() => {
    fetchProjects()
    fetchAgents()
    fetchActivity()
    fetchActivePipeline()

    const ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
    }
    
    ws.onmessage = (e) => {
      const { type, data } = JSON.parse(e.data)
      
      if (type === 'log') {
        setLogs(prev => [...prev.slice(-200), { ...data, time: Date.now() }])
      }
      
      if (type === 'agent_status' || type === 'agent:status') {
        setAgentStatus(prev => ({ ...prev, [data.agent]: data }))
      }
      
      if (type === 'task') {
        if (data.done) {
          setActiveTasks(prev => prev.filter(t => t.id !== data.id))
        } else {
          setActiveTasks(prev => {
            const exists = prev.find(t => t.id === data.id)
            if (exists) return prev.map(t => t.id === data.id ? data : t)
            return [...prev, data]
          })
        }
      }
      
      // Pipeline events
      if (type === 'pipeline:created') {
        setActivePipeline(data)
      }
      
      if (type === 'pipeline:complete' || type === 'pipeline:error') {
        fetchProjects()
      }
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }
    
    return () => ws.close()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await authFetch(`${API}/projects`)
      if (res.ok) setProjects(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const fetchAgents = async () => {
    try {
      const res = await authFetch(`${API}/agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
        const status = {}
        data.forEach(a => { status[a.id] = { agent: a.id, status: 'idle' } })
        setAgentStatus(status)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchActivity = async () => {
    try {
      const res = await authFetch(`${API}/activity?limit=200`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.map(d => ({ ...d, time: d.time })))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchActivePipeline = async () => {
    try {
      // First check localStorage
      const savedId = localStorage.getItem('activePipeline')
      let pipelineId = null
      
      if (savedId) {
        try {
          pipelineId = JSON.parse(savedId)?.id
        } catch {}
      }
      
      // If we have a saved pipeline, fetch its latest state
      if (pipelineId) {
        const res = await authFetch(`${API}/pipeline/${pipelineId}`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.id) {
            setActivePipeline(data)
            return
          }
        }
      }
      
      // Otherwise check for any active pipeline
      const res = await authFetch(`${API}/pipeline/active`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.id) {
          setActivePipeline(data)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const openChat = (agent) => {
    setChatAgent(agent)
    setChatOpen(true)
  }

  const openProject = (project) => {
    setSelectedProject(project)
    setView('project')
  }

  const handlePipelineStart = (pipeline) => {
    setShowWizard(false)
    setActivePipeline(pipeline)
  }

  const views = {
    dashboard: (
      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">{APP_NAME}</h1>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">v{APP_VERSION}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWizard(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
            >
              New Project
            </button>
            <button
              onClick={() => setView('oneliner')}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              Quick Start
            </button>
          </div>
        </header>
        
        {/* Dashboard Content */}
        <Dashboard 
          projects={projects} 
          agents={agents}
          agentStatus={agentStatus}
          activeTasks={activeTasks}
          logs={logs}
          onSelectProject={(project) => {
            // Open project details in modal
            console.log('Selected project:', project)
          }}
          onSelectAgent={(agent) => {
            // Open agent chat
            console.log('Selected agent:', agent)
          }}
          onProjectCreated={fetchProjects}
          onStartPipeline={() => setShowWizard(true)}
          activePipeline={activePipeline}
          onOpenPipeline={() => setActivePipeline(activePipeline)}
        />
      </div>
    ),
    oneliner: <OneLiner 
      onProjectCreated={fetchProjects}
      onStartPipeline={() => setShowWizard(true)}
      logs={logs}
    />,
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar 
        view={view} 
        setView={setView} 
        selectedProject={selectedProject}
        agents={agents}
        agentStatus={agentStatus}
        activeTasks={activeTasks}
        logs={logs}
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activePipeline={activePipeline}
        onOpenPipeline={() => setActivePipeline(activePipeline)}
      />
      
      <main className="flex-1 overflow-hidden">
        {views[view]}
      </main>

      {chatOpen && (
        <Chat 
          agent={chatAgent} 
          onClose={() => setChatOpen(false)} 
        />
      )}
      
      {showWizard && (
        <ProjectWizard
          agents={agents}
          onClose={() => setShowWizard(false)}
          onPipelineStart={handlePipelineStart}
        />
      )}
      
      {activePipeline && (
        <PipelineView
          pipeline={activePipeline}
          onClose={() => setActivePipeline(null)}
          onRefresh={fetchProjects}
        />
      )}
    </div>
  )
}

export default App
