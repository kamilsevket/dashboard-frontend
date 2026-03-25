import { useState, useEffect, useRef } from 'react'
import { 
  SparklesIcon, 
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  FolderOpenIcon,
  StopIcon,
  PlayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { API, authFetch } from '../config'

const COMMON_FEATURES = [
  { id: 'darkmode', name: 'Dark Mode', icon: '🌙', desc: 'System Theme' },
  { id: 'push', name: 'Push Notifications', icon: '🔔', desc: 'APNs' },
  { id: 'cloudkit', name: 'CloudKit', icon: '☁️', desc: 'iCloud Sync' },
  { id: 'widgets', name: 'iOS Widgets', icon: '📱', desc: 'Home Screen' },
  { id: 'watch', name: 'Apple Watch', icon: '⌚', desc: 'watchOS' },
]

export default function OneLiner({ onProjectCreated, onStartPipeline, logs }) {
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState('input')
  const [projectName, setProjectName] = useState('')
  const [appPlan, setAppPlan] = useState(null)
  const [selectedFeatures, setSelectedFeatures] = useState(['darkmode'])
  const [suggestedFeatures, setSuggestedFeatures] = useState([])
  const [activity, setActivity] = useState([])
  const [screens, setScreens] = useState([])
  const [files, setFiles] = useState([])
  const [currentPhase, setCurrentPhase] = useState('')
  const [currentTask, setCurrentTask] = useState('')
  const [error, setError] = useState(null)
  const [recentPipelines, setRecentPipelines] = useState([])
  const [pipelineId, setPipelineId] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isStopped, setIsStopped] = useState(false)
  const activityRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => { 
    loadState()
    loadActivePipeline()
  }, [])
  
  useEffect(() => {
    if (activityRef.current) activityRef.current.scrollTop = activityRef.current.scrollHeight
  }, [activity])

  const loadState = async () => {
    try {
      const res = await authFetch(`${API}/pipelines?limit=5`)
      if (res.ok) {
        const data = await res.json()
        setRecentPipelines(data.reverse())
      }
    } catch {}
  }

  const loadActivePipeline = async () => {
    try {
      const res = await authFetch(`${API}/pipelines/active`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.id) restorePipeline(data)
      }
    } catch {}
  }

  const restorePipeline = (pipeline) => {
    setPipelineId(pipeline.id)
    setProjectName(pipeline.projectName || '')
    setPrompt(pipeline.prompt || '')
    setActivity(pipeline.activity || [])
    setScreens(pipeline.screens || [])
    setFiles(pipeline.files || [])
    setSelectedFeatures(pipeline.features || ['darkmode'])
    if (pipeline.appPlan) setAppPlan(pipeline.appPlan)
    setSuggestedFeatures(pipeline.suggestedFeatures || [])
    setCurrentPhase(pipeline.currentPhase || '')
    setCurrentTask(pipeline.currentTask || '')
    setIsPaused(pipeline.isPaused || false)
    setIsStopped(pipeline.isStopped || false)
    
    if (pipeline.status === 'complete') {
      setPhase('complete')
      setCurrentPhase('complete')
    } else if (pipeline.status === 'paused') {
      setPhase('building')
      setIsPaused(true)
    } else if (pipeline.status === 'running') {
      setPhase('building')
    } else if (pipeline.appPlan && pipeline.status !== 'complete') {
      setPhase('features')
    }
  }

  const addLog = (message, type = 'info', agent = null) => {
    const log = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      time: Date.now(), message, type, agent
    }
    setActivity(prev => [...prev, log])
  }

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    
    setError(null)
    setPhase('building')
    addLog('🚀 Starting AI-powered project creation...', 'success')

    try {
      // Start pipeline
      const res = await authFetch(`${API}/pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: 'MyApp',
          description: prompt,
          features: selectedFeatures,
          screens: []
        })
      })

      if (!res.ok) throw new Error('Failed to start pipeline')
      
      const pipeline = await res.json()
      setPipelineId(pipeline.id)
      
      addLog('✅ Pipeline started successfully', 'success')
      setPhase('building')
      
      // Poll for updates
      pollPipelineStatus(pipeline.id)
      
    } catch (err) {
      setError(err.message)
      setPhase('input')
      addLog(`❌ Error: ${err.message}`, 'error')
    }
  }

  const pollPipelineStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`${API}/pipeline/${id}`)
        if (!res.ok) throw new Error('Failed to fetch pipeline')
        
        const data = await res.json()
        
        // Update UI with latest state
        setActivity(data.logs || [])
        setScreens(data.design?.screens || [])
        setFiles(data.development?.implementedScreens || [])
        setCurrentPhase(data.currentStage || '')
        setCurrentTask(data.currentTask || '')
        
        if (data.status === 'complete') {
          clearInterval(interval)
          setPhase('complete')
          addLog('🎉 Project completed successfully!', 'success')
          if (onProjectCreated) onProjectCreated(data.projectName)
        } else if (data.status === 'error') {
          clearInterval(interval)
          setError(data.error || 'Pipeline failed')
          setPhase('input')
        }
        
      } catch (err) {
        clearInterval(interval)
        setError(err.message)
        setPhase('input')
      }
    }, 3000)
  }

  const handlePause = async () => {
    if (!pipelineId) return
    try {
      await authFetch(`${API}/pipeline/${pipelineId}/pause`, { method: 'POST' })
      setIsPaused(true)
      addLog('⏸️ Pipeline paused', 'warning')
    } catch (err) {
      addLog(`❌ Failed to pause: ${err.message}`, 'error')
    }
  }

  const handleResume = async () => {
    if (!pipelineId) return
    try {
      await authFetch(`${API}/pipeline/${pipelineId}/resume`, { method: 'POST' })
      setIsPaused(false)
      addLog('▶️ Pipeline resumed', 'success')
    } catch (err) {
      addLog(`❌ Failed to resume: ${err.message}`, 'error')
    }
  }

  if (phase === 'input') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 mb-3">
            <SparklesIcon className="w-4 h-4" />
            AI Creator
          </div>
          <h1 className="text-2xl font-bold mb-2">Create Your iOS App</h1>
          <p className="text-zinc-400">Describe your app idea and let AI build it for you</p>
          <p className="text-xs text-zinc-500 mt-2">v{APP_VERSION}</p>
        </div>

        {/* Recent Projects */}
        {recentPipelines.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-zinc-400 mb-3">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentPipelines.slice(0, 4).map(p => (
                <div key={p.id} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{p.projectName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.status === 'running' ? 'bg-indigo-500/10 text-indigo-400' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Unknown date'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Describe your app idea</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: A simple todo app with dark mode and iCloud sync..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-purple-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium mb-2">Features</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {COMMON_FEATURES.map(feature => (
                <button
                  key={feature.id}
                  onClick={() => {
                    setSelectedFeatures(prev => 
                      prev.includes(feature.id) 
                        ? prev.filter(f => f !== feature.id)
                        : [...prev, feature.id]
                    )
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedFeatures.includes(feature.id)
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{feature.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{feature.name}</p>
                      <p className="text-xs text-zinc-500">{feature.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:opacity-50 text-white rounded-xl transition-colors font-medium"
          >
            <RocketLaunchIcon className="w-5 h-5" />
            Create App with AI
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'building') {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Building Your App</h2>
          <p className="text-zinc-400">This may take a few minutes...</p>
          {currentPhase && (
            <p className="text-sm text-zinc-500 mt-2">Current: {currentPhase}</p>
          )}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Progress</span>
            <span className="text-sm text-zinc-400">{activity.length} events</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: `${Math.min(activity.length * 2, 100)}%` }} />
          </div>
        </div>

        {/* Activity Log */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Activity</h3>
          <div 
            ref={activityRef}
            className="h-64 overflow-auto p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 space-y-2"
          >
            {activity.map((log, i) => (
              <div key={i} className={`p-2 rounded text-xs ${
                log.type === 'success' || log.message.includes('✅') ? 'text-emerald-400' :
                log.type === 'error' ? 'text-red-400' :
                'text-zinc-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600">{new Date(log.time).toLocaleTimeString()}</span>
                  {log.agent && <span className="text-zinc-500">[{log.agent}]</span>}
                </div>
                <p>{log.message}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {isPaused ? (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
            >
              <StopIcon className="w-4 h-4" />
              Pause
            </button>
          )}
          <button
            onClick={() => {
              setPhase('input')
              setIsStopped(true)
            }}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return null
}