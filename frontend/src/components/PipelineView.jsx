import { useState, useEffect, useRef } from 'react'
import { 
  XMarkIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
  ArrowPathIcon,
  PlusIcon,
  ChatBubbleLeftIcon,
  PhotoIcon,
  CodeBracketIcon,
  BeakerIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { API, authFetch, WS_URL } from '../config'

const STAGES = [
  { id: 'analyze', label: 'Analyze', icon: SparklesIcon, agent: 'pm' },
  { id: 'design', label: 'Design', icon: PhotoIcon, agent: 'designer' },
  { id: 'review', label: 'Review', icon: ChatBubbleLeftIcon },
  { id: 'implement', label: 'Implement', icon: CodeBracketIcon, agent: 'ios-dev' },
  { id: 'test', label: 'Test', icon: BeakerIcon, agent: 'ios-test' },
  { id: 'screenshot', label: 'Screenshot', icon: DevicePhoneMobileIcon },
  { id: 'complete', label: 'Complete', icon: CheckIcon }
]

export default function PipelineView({ pipeline, onClose, onRefresh }) {
  const [localPipeline, setLocalPipeline] = useState(pipeline)
  const [logs, setLogs] = useState(pipeline?.logs || [])
  const [selectedScreen, setSelectedScreen] = useState(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenDesc, setNewScreenDesc] = useState('')
  const [showAddScreen, setShowAddScreen] = useState(false)
  const [loading, setLoading] = useState({})
  const logsEndRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      
      if (msg.type === 'pipeline:log' && msg.data.pipelineId === localPipeline?.id) {
        setLogs(prev => [...prev, msg.data])
      }
      
      if (msg.type === 'pipeline:stage' && msg.data.pipelineId === localPipeline?.id) {
        setLocalPipeline(prev => ({ ...prev, currentStage: msg.data.stage }))
      }
      
      if (msg.type === 'design:ready' && msg.data.pipelineId === localPipeline?.id) {
        refreshPipeline()
      }
      
      if (msg.type === 'pipeline:complete' && msg.data.pipelineId === localPipeline?.id) {
        setLocalPipeline(prev => ({ ...prev, status: 'complete', currentStage: 'complete' }))
      }
      
      if (msg.type === 'pipeline:awaiting-review' && msg.data.pipelineId === localPipeline?.id) {
        setLocalPipeline(prev => ({ ...prev, currentStage: 'review' }))
      }
    }
    
    return () => ws.close()
  }, [localPipeline?.id])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const refreshPipeline = async () => {
    try {
      const res = await authFetch(`${API}/pipeline/${localPipeline.id}`)
      const data = await res.json()
      setLocalPipeline(data)
      setLogs(data.logs || [])
    } catch (e) {
      console.error('Refresh failed:', e)
    }
  }

  const handlePause = async () => {
    await authFetch(`${API}/pipeline/${localPipeline.id}/pause`, { method: 'POST' })
    setLocalPipeline(prev => ({ ...prev, status: 'paused' }))
  }

  const handleResume = async () => {
    await authFetch(`${API}/pipeline/${localPipeline.id}/resume`, { method: 'POST' })
    setLocalPipeline(prev => ({ ...prev, status: 'running' }))
  }

  const handleSubmitFeedback = async (screenName) => {
    if (!feedbackText.trim()) return
    
    setLoading(prev => ({ ...prev, [screenName]: true }))
    
    try {
      await authFetch(`${API}/pipeline/${localPipeline.id}/designs/${screenName}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText })
      })
      setFeedbackText('')
      refreshPipeline()
    } catch (e) {
      console.error('Feedback failed:', e)
    }
    
    setLoading(prev => ({ ...prev, [screenName]: false }))
  }

  const handleApproveScreen = async (screenName) => {
    setLoading(prev => ({ ...prev, [screenName]: true }))
    
    try {
      await authFetch(`${API}/pipeline/${localPipeline.id}/designs/${screenName}/approve`, {
        method: 'POST'
      })
      refreshPipeline()
    } catch (e) {
      console.error('Approve failed:', e)
    }
    
    setLoading(prev => ({ ...prev, [screenName]: false }))
  }

  const handleApproveAll = async () => {
    setLoading(prev => ({ ...prev, approveAll: true }))
    
    try {
      await authFetch(`${API}/pipeline/${localPipeline.id}/designs/approve-all`, {
        method: 'POST'
      })
      refreshPipeline()
    } catch (e) {
      console.error('Approve all failed:', e)
    }
    
    setLoading(prev => ({ ...prev, approveAll: false }))
  }

  const handleAddScreen = async () => {
    if (!newScreenName.trim() || !newScreenDesc.trim()) return
    
    setLoading(prev => ({ ...prev, addScreen: true }))
    
    try {
      await authFetch(`${API}/pipeline/${localPipeline.id}/screens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newScreenName, description: newScreenDesc })
      })
      setNewScreenName('')
      setNewScreenDesc('')
      setShowAddScreen(false)
      refreshPipeline()
    } catch (e) {
      console.error('Add screen failed:', e)
    }
    
    setLoading(prev => ({ ...prev, addScreen: false }))
  }

  const currentStageIndex = STAGES.findIndex(s => s.id === localPipeline?.currentStage)
  const screens = localPipeline?.design?.screens || []
  const readyScreens = screens.filter(s => s.status === 'ready')
  const approvedScreens = screens.filter(s => s.status === 'approved')
  const allReady = screens.length > 0 && screens.every(s => s.status === 'ready' || s.status === 'approved')

  return (
    <div className="fixed inset-0 bg-black/80 flex z-50" onClick={onClose}>
      <div className="flex-1 flex" onClick={e => e.stopPropagation()}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-zinc-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">{localPipeline?.projectName}</h2>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                localPipeline?.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' :
                localPipeline?.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                localPipeline?.status === 'complete' ? 'bg-blue-500/20 text-blue-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {localPipeline?.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {localPipeline?.status === 'running' && (
                <button onClick={handlePause} className="p-2 rounded-lg hover:bg-zinc-800">
                  <PauseIcon className="w-5 h-5" />
                </button>
              )}
              {localPipeline?.status === 'paused' && (
                <button onClick={handleResume} className="p-2 rounded-lg hover:bg-zinc-800">
                  <PlayIcon className="w-5 h-5" />
                </button>
              )}
              <button onClick={refreshPipeline} className="p-2 rounded-lg hover:bg-zinc-800">
                <ArrowPathIcon className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stage Progress */}
          <div className="flex items-center gap-1 p-4 border-b border-zinc-800 overflow-x-auto">
            {STAGES.map((stage, i) => {
              const isActive = stage.id === localPipeline?.currentStage
              const isComplete = i < currentStageIndex
              const Icon = stage.icon
              
              return (
                <div key={stage.id} className="flex items-center">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    isActive ? 'bg-white text-black' :
                    isComplete ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isComplete ? (
                      <CheckCircleIcon className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium whitespace-nowrap">{stage.label}</span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <ChevronRightIcon className="w-4 h-4 mx-1 text-zinc-600" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4">
            {/* Review Stage - Design Gallery */}
            {localPipeline?.currentStage === 'review' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Review Designs</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowAddScreen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Screen
                    </button>
                    {allReady && readyScreens.length > 0 && (
                      <button 
                        onClick={handleApproveAll}
                        disabled={loading.approveAll}
                        className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Approve All & Continue
                      </button>
                    )}
                  </div>
                </div>

                {/* Add Screen Modal */}
                {showAddScreen && (
                  <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 space-y-3">
                    <input
                      type="text"
                      value={newScreenName}
                      onChange={e => setNewScreenName(e.target.value)}
                      placeholder="Screen name (e.g., Profile)"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm"
                    />
                    <textarea
                      value={newScreenDesc}
                      onChange={e => setNewScreenDesc(e.target.value)}
                      placeholder="Describe the screen UI..."
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm h-20 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleAddScreen}
                        disabled={loading.addScreen}
                        className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50"
                      >
                        {loading.addScreen ? 'Generating...' : 'Add & Generate'}
                      </button>
                      <button 
                        onClick={() => setShowAddScreen(false)}
                        className="px-4 py-2 rounded-lg bg-zinc-700 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Design Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {screens.map(screen => (
                    <div 
                      key={screen.name}
                      className={`rounded-xl border overflow-hidden ${
                        screen.status === 'approved' ? 'border-emerald-500/50' :
                        screen.status === 'generating' ? 'border-yellow-500/50' :
                        screen.status === 'error' ? 'border-red-500/50' :
                        'border-zinc-700'
                      } bg-zinc-800`}
                    >
                      {/* Image */}
                      <div 
                        className="aspect-[9/16] bg-zinc-900 cursor-pointer relative"
                        onClick={() => setSelectedScreen(selectedScreen === screen.name ? null : screen.name)}
                      >
                        {screen.status === 'generating' ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                          </div>
                        ) : screen.screenshot ? (
                          <img 
                            src={screen.screenshot} 
                            alt={screen.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                            <PhotoIcon className="w-12 h-12" />
                          </div>
                        )}
                        
                        {screen.status === 'approved' && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <CheckIcon className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{screen.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            screen.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            screen.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                            screen.status === 'generating' ? 'bg-yellow-500/20 text-yellow-400' :
                            screen.status === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {screen.status}
                            {screen.version > 1 && ` v${screen.version}`}
                          </span>
                        </div>
                        
                        {/* Expanded View */}
                        {selectedScreen === screen.name && screen.status === 'ready' && (
                          <div className="space-y-2 pt-2 border-t border-zinc-700">
                            <textarea
                              value={feedbackText}
                              onChange={e => setFeedbackText(e.target.value)}
                              placeholder="Add feedback for changes..."
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs h-16 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSubmitFeedback(screen.name)}
                                disabled={loading[screen.name] || !feedbackText.trim()}
                                className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs disabled:opacity-50"
                              >
                                {loading[screen.name] ? 'Updating...' : 'Request Changes'}
                              </button>
                              <button
                                onClick={() => handleApproveScreen(screen.name)}
                                disabled={loading[screen.name]}
                                className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium disabled:opacity-50"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {screens.length === 0 && (
                  <div className="text-center py-12 text-zinc-500">
                    Waiting for designs...
                  </div>
                )}
              </div>
            )}

            {/* Design Stage - Show progress */}
            {localPipeline?.currentStage === 'design' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Generating Designs</h3>
                <p className="text-sm text-zinc-400">
                  Stitch is generating UI designs while iOS scaffold is being created...
                </p>
                
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {screens.map(screen => (
                    <div key={screen.name} className="rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden">
                      <div className="aspect-[9/16] bg-zinc-900 flex items-center justify-center">
                        {screen.status === 'generating' ? (
                          <div className="text-center">
                            <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <span className="text-xs text-zinc-500">Generating...</span>
                          </div>
                        ) : screen.screenshot ? (
                          <img src={screen.screenshot} alt={screen.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-zinc-600">{screen.name}</span>
                        )}
                      </div>
                      <div className="p-2 text-center text-sm font-medium">{screen.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Implement Stage */}
            {localPipeline?.currentStage === 'implement' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Implementing Designs</h3>
                <div className="space-y-2">
                  {screens.filter(s => s.status === 'approved').map(screen => {
                    const implemented = localPipeline?.development?.implementedScreens?.includes(screen.name)
                    return (
                      <div key={screen.name} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800">
                        {implemented ? (
                          <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                        )}
                        <span>{screen.name}</span>
                        <span className="text-xs text-zinc-500">
                          {implemented ? 'Complete' : 'In progress...'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                <div className="p-3 rounded-lg bg-zinc-800">
                  <div className="flex items-center gap-2 text-sm">
                    <CodeBracketIcon className="w-4 h-4" />
                    <span>Build Status:</span>
                    <span className={
                      localPipeline?.development?.buildStatus === 'success' ? 'text-emerald-400' :
                      localPipeline?.development?.buildStatus === 'failed' ? 'text-red-400' :
                      'text-yellow-400'
                    }>
                      {localPipeline?.development?.buildStatus || 'pending'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Test Stage */}
            {localPipeline?.currentStage === 'test' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Running Tests</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-800">
                    <h4 className="text-sm text-zinc-400 mb-2">Unit Tests</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-emerald-400">
                        {localPipeline?.testing?.unitTests?.passed || 0}
                      </span>
                      <span className="text-zinc-500">passed</span>
                      {localPipeline?.testing?.unitTests?.failed > 0 && (
                        <>
                          <span className="text-2xl font-bold text-red-400">
                            {localPipeline?.testing?.unitTests?.failed}
                          </span>
                          <span className="text-zinc-500">failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-800">
                    <h4 className="text-sm text-zinc-400 mb-2">UI Tests</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-emerald-400">
                        {localPipeline?.testing?.uiTests?.passed || 0}
                      </span>
                      <span className="text-zinc-500">passed</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Screenshot Stage */}
            {localPipeline?.currentStage === 'screenshot' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Capturing Screenshots</h3>
                <p className="text-sm text-zinc-400">
                  Running app on simulator and capturing screenshots...
                </p>
                <div className="flex items-center justify-center py-12">
                  <div className="w-12 h-12 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                </div>
              </div>
            )}

            {/* Complete Stage */}
            {localPipeline?.currentStage === 'complete' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Pipeline Complete!</h3>
                  <p className="text-zinc-400">
                    {localPipeline.projectName} is ready
                  </p>
                </div>

                {/* Final Screenshots */}
                {localPipeline?.screenshots?.images?.length > 0 && (
                  <div>
                    <h4 className="text-sm text-zinc-400 mb-3">App Screenshots</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {localPipeline.screenshots.images.map((img, i) => (
                        <div key={i} className="rounded-xl border border-zinc-700 overflow-hidden">
                          <img src={img.path} alt={img.screen} className="w-full" />
                          <div className="p-2 text-center text-sm">{img.screen}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-800 text-center">
                    <div className="text-2xl font-bold">{screens.length}</div>
                    <div className="text-sm text-zinc-400">Screens</div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-800 text-center">
                    <div className="text-2xl font-bold text-emerald-400">
                      {localPipeline?.testing?.unitTests?.passed || 0}
                    </div>
                    <div className="text-sm text-zinc-400">Tests Passed</div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-800 text-center">
                    <div className="text-2xl font-bold">
                      {localPipeline?.development?.buildStatus === 'success' ? '✓' : '✗'}
                    </div>
                    <div className="text-sm text-zinc-400">Build</div>
                  </div>
                </div>
              </div>
            )}

            {/* Analyze Stage */}
            {localPipeline?.currentStage === 'analyze' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-2 border-zinc-600 border-t-white rounded-full animate-spin mb-4" />
                <p className="text-zinc-400">PM agent analyzing your app idea...</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Log Sidebar */}
        <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col">
          <div className="p-3 border-b border-zinc-800">
            <h3 className="text-sm font-medium">Activity Log</h3>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-600 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('en-GB', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
                <span className={`shrink-0 ${
                  log.source === 'pm' ? 'text-purple-400' :
                  log.source === 'designer' ? 'text-pink-400' :
                  log.source === 'ios-dev' ? 'text-orange-400' :
                  log.source === 'ios-test' ? 'text-cyan-400' :
                  log.source === 'error' ? 'text-red-400' :
                  log.source === 'review' ? 'text-yellow-400' :
                  'text-zinc-400'
                }`}>
                  [{log.source}]
                </span>
                <span className={log.message.includes('❌') ? 'text-red-400' : 'text-zinc-300'}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
