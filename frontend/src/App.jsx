import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import OneLiner from './components/OneLiner'
import Login from './components/Login'
import PipelineView from './components/PipelineView'
import ProjectWizard from './components/ProjectWizard'
import Chat from './components/Chat'
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
  const [selectedProject, setSelectedProject] = useState(null)
  const [chatAgent, setChatAgent] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  
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

  // Fetch data and setup WebSocket when authenticated
  useEffect(() => {
    if (!token) return
    
    let ws = null

    const loadData = async () => {
      try {
        // Fetch projects
        const projRes = await authFetch(`${API}/projects`)
        if (projRes.ok) {
          const projData = await projRes.json()
          setProjects(projData)
        }
        
        // Fetch agents
        const agentRes = await authFetch(`${API}/agents`)
        if (agentRes.ok) {
          const agentData = await agentRes.json()
          setAgents(agentData)
          const status = {}
          agentData.forEach(a => { status[a.id] = { agent: a.id, status: 'idle' } })
          setAgentStatus(status)
        }
        
        // Fetch activity
        const actRes = await authFetch(`${API}/activity?limit=200`)
        if (actRes.ok) {
          const actData = await actRes.json()
          setLogs(actData.map(d => ({ ...d, time: d.time })))
        }
        
        // Fetch active pipeline
        const savedId = localStorage.getItem('activePipeline')
        let pipelineId = null
        
        if (savedId) {
          try {
            pipelineId = JSON.parse(savedId)?.id
          } catch {
            // ignore
          }
        }
        
        if (pipelineId) {
          const pipeRes = await authFetch(`${API}/pipeline/${pipelineId}`)
          if (pipeRes.ok) {
            const pipeData = await pipeRes.json()
            if (pipeData && pipeData.id) {
              setActivePipeline(pipeData)
              return
            }
          }
        }
        
        const activeRes = await authFetch(`${API}/pipeline/active`)
        if (activeRes.ok) {
          const activeData = await activeRes.json()
          if (activeData && activeData.id) {
            setActivePipeline(activeData)
          }
        }
      } catch (e) {
        console.error('Failed to load data:', e)
      }
    }

    loadData()

    // Setup WebSocket
    ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
    }
    
    ws.onmessage = (e) => {
      try {
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
        
        if (type === 'pipeline:created') {
          setActivePipeline(data)
        }
        
        if (type === 'pipeline:complete' || type === 'pipeline:error') {
          loadData()
        }
      } catch (err) {
        console.error('WS message error:', err)
      }
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }
    
    return () => {
      if (ws) ws.close()
    }
  }, [token])

  // Refresh projects function for child components
  const refreshProjects = async () => {
    try {
      const res = await authFetch(`${API}/projects`)
      if (res.ok) setProjects(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  // Show login if not authenticated
  if (!token) {
    return <Login onLogin={(t) => setToken(t)} />
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
            setSelectedProject(project)
          }}
          onSelectAgent={(agent) => {
            setChatAgent(agent)
            setChatOpen(true)
          }}
          onProjectCreated={refreshProjects}
          onStartPipeline={() => setShowWizard(true)}
          activePipeline={activePipeline}
          onOpenPipeline={() => setActivePipeline(activePipeline)}
        />
      </div>
    ),
    oneliner: <OneLiner 
      onProjectCreated={refreshProjects}
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
          onRefresh={refreshProjects}
        />
      )}
    </div>
  )
}

export default App
