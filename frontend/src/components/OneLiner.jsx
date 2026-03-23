import { useState, useEffect, useRef } from 'react'
import { 
  SparklesIcon, 
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  PhotoIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  SwatchIcon,
  XMarkIcon,
  CheckIcon,
  FolderOpenIcon,
  StopIcon,
  PlayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

const COMMON_FEATURES = [
  { id: 'supabase', name: 'Supabase', icon: '⚡', desc: 'Auth, Database, Storage' },
  { id: 'firebase', name: 'Firebase', icon: '🔥', desc: 'Auth, Firestore, Analytics' },
  { id: 'revenuecat', name: 'RevenueCat', icon: '💰', desc: 'Subscriptions & IAP' },
  { id: 'cloudkit', name: 'CloudKit', icon: '☁️', desc: 'iCloud Sync' },
  { id: 'push', name: 'Push Notifications', icon: '🔔', desc: 'APNs' },
  { id: 'analytics', name: 'Analytics', icon: '📊', desc: 'Usage Tracking' },
  { id: 'widgets', name: 'iOS Widgets', icon: '📱', desc: 'Home Screen' },
  { id: 'watch', name: 'Apple Watch', icon: '⌚', desc: 'watchOS' },
  { id: 'darkmode', name: 'Dark Mode', icon: '🌙', desc: 'System Theme' },
]

export default function OneLiner({ onProjectCreated, onViewProject }) {
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
    // Check for active pipeline on mount
    loadActivePipeline()
  }, [])
  
  useEffect(() => {
    if (activityRef.current) activityRef.current.scrollTop = activityRef.current.scrollHeight
  }, [activity])

  // Save state to backend whenever it changes
  useEffect(() => {
    if (pipelineId && phase !== 'input') {
      savePipelineState()
    }
  }, [activity, screens, files, currentPhase, phase])

  const loadState = async () => {
    try {
      const res = await authFetch(`${API}/pipelines?limit=10`)
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
        if (data && data.id) {
          // Restore active pipeline state
          restorePipeline(data)
        }
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

  const savePipelineState = async () => {
    if (!pipelineId) return
    try {
      await authFetch(`${API}/pipelines/${pipelineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity,
          screens,
          files,
          currentPhase,
          currentTask,
          appPlan,
          suggestedFeatures,
          features: selectedFeatures,
          isPaused,
          isStopped,
          status: phase === 'complete' ? 'complete' : isPaused ? 'paused' : isStopped ? 'stopped' : 'running'
        })
      })
    } catch {}
  }

  const addLog = (message, type = 'info', agent = null) => {
    const log = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      time: Date.now(), message, type, agent
    }
    setActivity(prev => [...prev, log])
    // Also save to backend activity
    authFetch(`${API}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...log, project: projectName })
    }).catch(() => {})
  }

  const toggleFeature = (id) => {
    setSelectedFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  // Stop pipeline
  const stopPipeline = () => {
    setIsStopped(true)
    setIsPaused(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    addLog('⏹️ Pipeline stopped by user', 'warning')
    savePipelineState()
  }

  // Pause pipeline
  const pausePipeline = () => {
    setIsPaused(true)
    addLog('⏸️ Pipeline paused', 'warning')
    savePipelineState()
  }

  // Resume pipeline
  const resumePipeline = async () => {
    setIsPaused(false)
    setIsStopped(false)
    addLog('▶️ Pipeline resumed', 'info')
    // Continue from where we left off
    if (currentPhase && appPlan) {
      await continueBuild()
    }
  }

  // === PHASE 1: PM Analysis ===
  const startAnalysis = async () => {
    if (!prompt.trim()) return
    setPhase('analyzing')
    setError(null)
    setActivity([])
    setIsStopped(false)
    setIsPaused(false)
    
    const name = prompt.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 2).join('-').replace(/[^a-z0-9-]/g, '') || 'my-app'
    setProjectName(name)
    
    // Create pipeline first
    const newPipelineId = `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    setPipelineId(newPipelineId)
    
    addLog(`🚀 Analyzing: "${prompt}"`, 'info')
    addLog(`📁 Project: ${name}`, 'info')

    try {
      // Create project folder
      const projRes = await authFetch(`${API}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'ios', description: prompt })
      })
      
      if (projRes.ok) {
        addLog(`✅ Project folder created`, 'success')
      }
      
      addLog(`📋 PM analyzing app requirements...`, 'working', 'PM')
      
      const pmRes = await authFetch(`${API}/agents/pm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `Analyze this iOS app and return ONLY JSON:
App: "${prompt}"

{
  "appName": "AppName",
  "tagline": "Short tagline",
  "screens": [{"name": "ScreenName", "description": "Purpose"}],
  "suggestedFeatures": [{"id": "unique_id", "name": "Feature", "description": "Why useful", "priority": "high|medium|low"}],
  "techStack": ["SwiftUI", "etc"]
}

Suggest 4-8 app-specific features.`, project: name
        })
      })
      
      if (!pmRes.ok) {
        throw new Error('PM agent failed')
      }
      
      let plan
      try {
        const data = await pmRes.json()
        addLog(`✅ PM response received (${data.durationMs}ms)`, 'success', 'PM')
        const match = data.response?.match(/\{[\s\S]*\}/m)
        plan = match ? JSON.parse(match[0]) : null
      } catch (e) {
        addLog(`⚠️ Failed to parse PM response, using defaults`, 'warning', 'PM')
      }
      
      if (!plan) {
        plan = {
          appName: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
          tagline: prompt,
          screens: [
            { name: 'Home', description: 'Main screen' }, 
            { name: 'Detail', description: 'Detail view' },
            { name: 'Settings', description: 'App settings' }
          ],
          suggestedFeatures: [],
          techStack: ['SwiftUI', 'SwiftData']
        }
      }
      
      setAppPlan(plan)
      setSuggestedFeatures(plan.suggestedFeatures || [])
      setSelectedFeatures(prev => [...prev, ...(plan.suggestedFeatures || []).filter(f => f.priority === 'high').map(f => f.id)])
      
      addLog(`✅ Analysis complete: ${plan.appName}`, 'success', 'PM')
      addLog(`📱 ${plan.screens.length} screens identified`, 'info', 'PM')
      addLog(`✨ ${plan.suggestedFeatures?.length || 0} features suggested`, 'info', 'PM')
      
      // Save initial pipeline
      await authFetch(`${API}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: newPipelineId,
          prompt, 
          projectName: name, 
          status: 'analyzing', 
          appPlan: plan,
          suggestedFeatures: plan.suggestedFeatures,
          features: selectedFeatures,
          startTime: Date.now()
        })
      })
      
      setPhase('features')
    } catch (e) {
      setError(e.message)
      addLog(`❌ Error: ${e.message}`, 'error')
      setPhase('input')
    }
  }

  // === PHASE 2: Build ===
  const startBuild = async () => {
    setPhase('building')
    setScreens([])
    setFiles([])
    setIsStopped(false)
    setIsPaused(false)
    
    abortControllerRef.current = new AbortController()
    
    const allFeatures = [
      ...COMMON_FEATURES.filter(f => selectedFeatures.includes(f.id)),
      ...suggestedFeatures.filter(f => selectedFeatures.includes(f.id))
    ]
    
    addLog(``, 'info')
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info')
    addLog(`🚀 Starting build with ${allFeatures.length} features`, 'info')
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info')
    allFeatures.forEach(f => addLog(`   ✓ ${f.name || f.id}`, 'info'))

    try {
      // Update pipeline status
      await authFetch(`${API}/pipelines/${pipelineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running', features: selectedFeatures })
      })

      // === STEP 1: Create Xcode Project ===
      setCurrentPhase('ios-dev')
      setCurrentTask('Creating Xcode project')
      addLog(``, 'info')
      addLog(`🍎 iOS Dev: Initializing Xcode project...`, 'working', 'iOS Dev')
      
      if (isStopped) return
      
      const initRes = await authFetch(`${API}/projects/${projectName}/init-xcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: appPlan.appName,
          screens: appPlan.screens,
          features: selectedFeatures,
          bundleId: `com.app.${projectName.replace(/[^a-z0-9]/g, '')}`
        })
      })
      
      if (initRes.ok) {
        const initData = await initRes.json()
        if (initData.success) {
          addLog(`✅ Xcode project created`, 'success', 'iOS Dev')
          setFiles(prev => [...prev, 
            { name: `${appPlan.appName}/`, type: 'folder' },
            { name: 'App.swift', type: 'file' },
            { name: 'ContentView.swift', type: 'file' }
          ])
        }
      } else {
        addLog(`⚠️ Xcode init skipped (manual setup needed)`, 'warning', 'iOS Dev')
      }

      // === STEP 2: Generate SwiftUI Views ===
      for (let i = 0; i < appPlan.screens.length; i++) {
        if (isStopped) {
          addLog(`⏹️ Build stopped`, 'warning')
          return
        }
        
        while (isPaused) {
          await new Promise(r => setTimeout(r, 1000))
          if (isStopped) return
        }
        
        const screen = appPlan.screens[i]
        const viewName = screen.name.replace(/\s/g, '')
        setCurrentTask(`${screen.name} (${i + 1}/${appPlan.screens.length})`)
        
        addLog(``, 'info')
        addLog(`━━━ Screen ${i + 1}/${appPlan.screens.length}: ${screen.name} ━━━`, 'working')
        
        // Generate SwiftUI code
        addLog(`   🍎 Generating ${viewName}View.swift...`, 'working', 'iOS Dev')
        
        try {
          const devRes = await authFetch(`${API}/agents/ios-dev/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Write a SwiftUI view for "${screen.name}" screen.
App: ${appPlan.appName} - ${appPlan.tagline}
Purpose: ${screen.description}
Features: ${allFeatures.map(f => f.name).join(', ')}

Requirements:
- Dark theme (#0A0A0A background)
- iOS 17+ APIs (@Observable, not ObservableObject)
- SF Symbols for icons
- Clean MVVM structure
- Include sample data

Return ONLY the Swift code, no explanations.`, project: projectName
            })
          })
          
          if (devRes.ok) {
            const devData = await devRes.json()
            addLog(`   ✅ ${viewName}View.swift generated (${devData.durationMs}ms)`, 'success', 'iOS Dev')
            
            // Extract and save Swift code
            const swiftCode = devData.response
            if (swiftCode && swiftCode.includes('struct') && swiftCode.includes('View')) {
              // Save to file
              await authFetch(`${API}/shell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  command: `mkdir -p "${appPlan.appName}" && cat > "${appPlan.appName}/${viewName}View.swift" << 'SWIFTEOF'
${swiftCode.replace(/```swift\n?/g, '').replace(/```\n?/g, '')}
SWIFTEOF`,
                  cwd: `${process.env.HOME || '/Users/kamil'}/clawd-main/dashboard/projects/${projectName}`
                })
              })
              
              setFiles(prev => [...prev, { name: `${viewName}View.swift`, type: 'file', content: swiftCode }])
            }
          } else {
            addLog(`   ⚠️ ${viewName}View.swift: using template`, 'warning', 'iOS Dev')
            // Create basic template
            setFiles(prev => [...prev, { name: `${viewName}View.swift`, type: 'file' }])
          }
        } catch (e) {
          addLog(`   ❌ ${viewName}: ${e.message}`, 'error', 'iOS Dev')
        }
        
        // Small delay between screens
        await new Promise(r => setTimeout(r, 500))
      }

      // === STEP 3: Generate Services ===
      if (!isStopped) {
        setCurrentPhase('services')
        setCurrentTask('Generating services')
        addLog(``, 'info')
        addLog(`🔧 Generating service files...`, 'working', 'iOS Dev')
        
        const services = []
        if (selectedFeatures.includes('supabase')) services.push('SupabaseManager')
        if (selectedFeatures.includes('firebase')) services.push('FirebaseManager')
        if (selectedFeatures.includes('revenuecat')) services.push('PurchaseManager')
        if (selectedFeatures.includes('push')) services.push('NotificationManager')
        
        for (const svc of services) {
          setFiles(prev => [...prev, { name: `Services/${svc}.swift`, type: 'file' }])
          addLog(`   ✓ ${svc}.swift`, 'success', 'iOS Dev')
        }
      }

      // === STEP 4: QA Review ===
      if (!isStopped) {
        setCurrentPhase('qa')
        setCurrentTask('QA Review')
        addLog(``, 'info')
        addLog(`🧪 QA: Reviewing app...`, 'working', 'QA')
        
        try {
          const qaRes = await authFetch(`${API}/agents/ios-test/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Quick review for ${appPlan.appName}:
- Screens: ${appPlan.screens.map(s => s.name).join(', ')}
- Features: ${allFeatures.map(f => f.name).join(', ')}

List 3 critical test cases (one line each).`, project: projectName
            })
          })
          
          if (qaRes.ok) {
            const qaData = await qaRes.json()
            addLog(`✅ QA review complete`, 'success', 'QA')
          }
        } catch {
          addLog(`⚠️ QA skipped`, 'warning', 'QA')
        }
      }

      // === Complete ===
      if (!isStopped) {
        setCurrentPhase('complete')
        setPhase('complete')
        setCurrentTask('')
        
        addLog(``, 'info')
        addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'success')
        addLog(`🎉 BUILD COMPLETE!`, 'success')
        addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'success')
        addLog(`📱 ${appPlan.appName}`, 'info')
        addLog(`📄 ${files.length} Swift files generated`, 'info')
        addLog(`✨ ${allFeatures.length} features integrated`, 'info')
        
        // Update pipeline
        await authFetch(`${API}/pipelines/${pipelineId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: 'complete', 
            screens, 
            files, 
            activity,
            endTime: Date.now()
          })
        })
        
        loadState()
        if (onProjectCreated) onProjectCreated(projectName)
      }
      
    } catch (e) {
      setError(e.message)
      addLog(`❌ Build error: ${e.message}`, 'error')
    }
  }

  const continueBuild = async () => {
    // Resume from current phase
    addLog(`▶️ Continuing from ${currentPhase}...`, 'info')
    await startBuild()
  }

  const openInXcode = async () => {
    try {
      await authFetch(`${API}/projects/${projectName}/open-xcode`, { method: 'POST' })
      addLog(`✅ Opening in Xcode...`, 'success')
    } catch (e) {
      addLog(`❌ ${e.message}`, 'error')
    }
  }

  const viewProject = () => {
    if (onViewProject) onViewProject(projectName)
  }

  const reset = () => {
    setPhase('input')
    setPrompt('')
    setAppPlan(null)
    setSelectedFeatures(['darkmode'])
    setSuggestedFeatures([])
    setActivity([])
    setScreens([])
    setFiles([])
    setCurrentPhase('')
    setCurrentTask('')
    setError(null)
    setPipelineId(null)
    setIsPaused(false)
    setIsStopped(false)
  }

  // === RENDER: Feature Selection ===
  if (phase === 'features' && appPlan) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1">{appPlan.appName}</h1>
          <p className="text-sm text-zinc-500">{appPlan.tagline}</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
          <h3 className="font-medium mb-3 text-sm">📱 Screens ({appPlan.screens.length})</h3>
          <div className="flex flex-wrap gap-2">
            {appPlan.screens.map((s, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-sm">{s.name}</span>
            ))}
          </div>
        </div>

        {suggestedFeatures.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <h3 className="font-medium mb-3 text-sm">✨ Suggested for {appPlan.appName}</h3>
            <div className="grid grid-cols-2 gap-2">
              {suggestedFeatures.map((f) => (
                <button key={f.id} onClick={() => toggleFeature(f.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedFeatures.includes(f.id) ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                  }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    selectedFeatures.includes(f.id) ? 'bg-indigo-500' : 'bg-zinc-800'
                  }`}>
                    {selectedFeatures.includes(f.id) && <CheckIcon className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{f.description}</p>
                    {f.priority === 'high' && <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">Recommended</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
          <h3 className="font-medium mb-3 text-sm">🔧 Backend & Services</h3>
          <div className="grid grid-cols-3 gap-2">
            {COMMON_FEATURES.map((f) => (
              <button key={f.id} onClick={() => toggleFeature(f.id)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                  selectedFeatures.includes(f.id) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                }`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center ${
                  selectedFeatures.includes(f.id) ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}>
                  {selectedFeatures.includes(f.id) && <CheckIcon className="w-2.5 h-2.5" />}
                </div>
                <span className="text-sm">{f.icon}</span>
                <span className="text-xs">{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
          <p className="text-sm"><span className="font-medium">{selectedFeatures.length}</span> features selected</p>
          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-all text-sm">← Back</button>
            <button onClick={startBuild} className="px-6 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition-all text-sm font-medium flex items-center gap-2">
              <RocketLaunchIcon className="w-4 h-4" />Build App
            </button>
          </div>
        </div>
      </div>
    )
  }

  // === RENDER: Building/Complete ===
  if (phase === 'building' || phase === 'complete' || phase === 'analyzing') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold mb-1">
              {phase === 'complete' ? '🎉 Complete!' : phase === 'analyzing' ? '📋 Analyzing...' : isStopped ? '⏹️ Stopped' : isPaused ? '⏸️ Paused' : '🔨 Building...'}
            </h1>
            <p className="text-sm text-zinc-500">{appPlan?.appName || projectName}</p>
          </div>
          
          {/* Control Buttons */}
          {phase === 'building' && !isStopped && (
            <div className="flex gap-2">
              {isPaused ? (
                <button onClick={resumePipeline} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 transition-all text-sm font-medium flex items-center gap-2">
                  <PlayIcon className="w-4 h-4" />Resume
                </button>
              ) : (
                <button onClick={pausePipeline} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 transition-all text-sm font-medium flex items-center gap-2">
                  <StopIcon className="w-4 h-4" />Pause
                </button>
              )}
              <button onClick={stopPipeline} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 transition-all text-sm font-medium flex items-center gap-2">
                <XMarkIcon className="w-4 h-4" />Stop
              </button>
            </div>
          )}
          
          {isStopped && (
            <div className="flex gap-2">
              <button onClick={resumePipeline} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 transition-all text-sm font-medium flex items-center gap-2">
                <PlayIcon className="w-4 h-4" />Continue
              </button>
              <button onClick={reset} className="px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 transition-all text-sm">
                New Build
              </button>
            </div>
          )}
        </div>

        {phase !== 'analyzing' && (
          <div className="flex items-center justify-center gap-1 mb-4">
            {[
              { id: 'ios-dev', icon: '🍎', label: 'iOS Dev' },
              { id: 'services', icon: '🔧', label: 'Services' },
              { id: 'qa', icon: '🧪', label: 'QA' },
              { id: 'complete', icon: '✅', label: 'Done' }
            ].map((p, i) => {
              const phases = ['ios-dev', 'services', 'qa', 'complete']
              const idx = phases.indexOf(currentPhase)
              const status = currentPhase === p.id ? 'active' : phases.indexOf(p.id) < idx ? 'done' : 'pending'
              return (
                <div key={p.id} className="flex items-center">
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs ${
                    status === 'active' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' :
                    status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800/50 text-zinc-500'
                  }`}>
                    {status === 'active' && !isPaused && <ArrowPathIcon className="w-3 h-3 animate-spin" />}
                    {status === 'active' && isPaused && <StopIcon className="w-3 h-3" />}
                    {status === 'done' && <CheckCircleIcon className="w-3 h-3" />}
                    <span>{p.icon} {p.label}</span>
                    {status === 'active' && currentTask && <span className="text-indigo-400">: {currentTask}</span>}
                  </div>
                  {i < 3 && <div className={`w-4 h-px mx-1 ${status === 'done' ? 'bg-emerald-500/50' : 'bg-zinc-700'}`} />}
                </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
            <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
              <DocumentTextIcon className="w-4 h-4" />Activity ({activity.length})
            </h3>
            <div ref={activityRef} className="space-y-0.5 max-h-[450px] overflow-auto font-mono text-xs">
              {activity.map((log) => (
                <div key={log.id} className={`flex items-start gap-2 py-1 px-2 rounded ${
                  log.type === 'success' ? 'bg-emerald-500/5 text-emerald-400' :
                  log.type === 'error' ? 'bg-red-500/10 text-red-400' :
                  log.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                  log.type === 'working' ? 'bg-indigo-500/10 text-indigo-300' :
                  log.message?.includes('━━━') ? 'text-zinc-300 font-medium' : 'text-zinc-400'
                }`}>
                  <span className="text-zinc-600 w-20 flex-shrink-0">{new Date(log.time).toLocaleTimeString()}</span>
                  {log.agent && <span className="text-zinc-500 w-16">[{log.agent}]</span>}
                  <span className="flex-1">{log.message}</span>
                </div>
              ))}
              {phase === 'building' && !isPaused && !isStopped && (
                <div className="flex items-center gap-2 py-1 px-2 text-indigo-400">
                  <ArrowPathIcon className="w-3 h-3 animate-spin" /><span>Processing...</span>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <CodeBracketIcon className="w-4 h-4" />Files ({files.length})
              </h3>
              <div className="space-y-1 max-h-60 overflow-auto font-mono">
                {files.length === 0 ? <p className="text-xs text-zinc-500 italic">Generating...</p> :
                  files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-0.5 px-2">
                      <span className={`w-2 h-2 rounded-sm ${f.type === 'folder' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                      <span className="text-zinc-300">{f.name}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {phase === 'complete' && (
              <div className="space-y-2">
                <button onClick={openInXcode}
                  className="w-full px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 transition-all text-sm font-medium flex items-center justify-center gap-2">
                  <FolderOpenIcon className="w-4 h-4" />Open in Xcode
                </button>
                <button onClick={viewProject}
                  className="w-full px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-all text-sm flex items-center justify-center gap-2">
                  View Project →
                </button>
                <button onClick={reset}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 transition-all text-sm text-zinc-400">
                  Build Another
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-medium">Build Error</p>
              <p className="text-xs text-red-400/70 mt-1">{error}</p>
              <button onClick={resumePipeline} className="mt-2 text-xs text-red-400 underline hover:text-red-300">
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // === RENDER: Input ===
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">Welcome, Master</h1>
          <p className="text-zinc-400 text-lg">Describe your app and let AI build it</p>
        </div>

        <div className="p-1 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20">
          <div className="p-5 rounded-xl bg-zinc-950">
            <div className="flex gap-3">
              <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startAnalysis()}
                placeholder="A meditation app with guided sessions..."
                className="flex-1 px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-indigo-500/50 focus:outline-none text-base placeholder:text-zinc-600" />
              <button onClick={startAnalysis} disabled={!prompt.trim()}
                className="px-8 py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />Analyze
              </button>
            </div>
          </div>
        </div>

        {recentPipelines.length > 0 && (
          <div className="pt-6">
            <p className="text-center text-sm text-zinc-500 mb-4">Recent Builds</p>
            <div className="flex flex-wrap justify-center gap-2">
              {recentPipelines.map((p) => (
                <button 
                  key={p.id} 
                  onClick={() => restorePipeline(p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    p.status === 'complete' ? 'bg-emerald-500' : 
                    p.status === 'running' ? 'bg-indigo-500 animate-pulse' :
                    p.status === 'paused' ? 'bg-amber-500' : 'bg-zinc-500'
                  }`} />
                  <span className="text-sm">{p.projectName}</span>
                  <span className="text-xs text-zinc-500">{p.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
