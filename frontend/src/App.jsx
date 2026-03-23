import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Agents from './components/Agents'
import Projects from './components/Projects'
import ProjectDetail from './components/ProjectDetail'
import Git from './components/Git'
import Xcode from './components/Xcode'
import Simulators from './components/Simulators'
import Terminal from './components/Terminal'
import Chat from './components/Chat'
import OneLiner from './components/OneLiner'
import Login from './components/Login'
import ApiDocs from './components/ApiDocs'
import PipelineView from './components/PipelineView'
import ProjectWizard from './components/ProjectWizard'
import { API, WS_URL, authFetch } from './config'

function App() {
  const [token, setToken] = useState(localStorage.getItem('dashboard_token'))
  const [view, setView] = useState('oneliner')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [projects, setProjects] = useState([])
  const [agents, setAgents] = useState([])
  const [agentStatus, setAgentStatus] = useState({})
  const [chatOpen, setChatOpen] = useState(false)
  const [chatAgent, setChatAgent] = useState(null)
  const [logs, setLogs] = useState([])
  const [activeTasks, setActiveTasks] = useState([])
  
  // Pipeline state - restore from localStorage
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
    oneliner: (
      <div className="h-full overflow-auto p-6">
        <OneLiner 
          onProjectCreated={(name) => {
            fetchProjects()
          }}
          onViewProject={(name) => {
            const project = projects.find(p => p.name === name) || { name, path: `${process.env.HOME || '~'}/clawd-main/dashboard/projects/${name}`, type: 'ios' }
            setSelectedProject(project)
            setView('project')
          }}
          onStartPipeline={() => setShowWizard(true)}
          logs={logs}
        />
        
        <div className="mt-8 text-center">
          <button
            onClick={() => setView('dashboard')}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View Full Dashboard →
          </button>
        </div>
      </div>
    ),
    dashboard: <Dashboard 
      projects={projects} 
      agents={agents}
      agentStatus={agentStatus}
      activeTasks={activeTasks}
      logs={logs}
      onSelectProject={openProject}
      onSelectAgent={openChat}
      onProjectCreated={(name) => {
        fetchProjects()
      }}
      onStartPipeline={() => setShowWizard(true)}
      activePipeline={activePipeline}
      onOpenPipeline={() => setActivePipeline(activePipeline)}
    />,
    agents: <Agents 
      agents={agents} 
      agentStatus={agentStatus}
      activeTasks={activeTasks}
      onChat={openChat} 
      onRefresh={fetchAgents} 
    />,
    projects: <Projects 
      projects={projects} 
      selected={selectedProject}
      onSelect={openProject}
      onRefresh={fetchProjects}
      agents={agents}
      onStartPipeline={() => setShowWizard(true)}
    />,
    project: <ProjectDetail 
      project={selectedProject}
      agents={agents}
      agentStatus={agentStatus}
      logs={logs}
      onBack={() => setView('projects')}
      onChat={openChat}
    />,
    git: <Git project={selectedProject} />,
    xcode: <Xcode project={selectedProject} logs={logs} />,
    simulators: <Simulators />,
    terminal: <Terminal project={selectedProject} />,
    apidocs: <ApiDocs />,
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
