import { useState } from 'react'
import { 
  XMarkIcon, 
  ArrowRightIcon, 
  ArrowLeftIcon,
  SparklesIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  CpuChipIcon,
  CheckIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

const STEPS = [
  { id: 'basics', title: 'Basics', desc: 'Name & description' },
  { id: 'features', title: 'Features', desc: 'Select features' },
  { id: 'confirm', title: 'Confirm', desc: 'Review & start' },
]

const PROJECT_TYPES = [
  { id: 'ios', icon: DevicePhoneMobileIcon, label: 'iOS', desc: 'Swift + SwiftUI' },
  { id: 'web', icon: GlobeAltIcon, label: 'Web', desc: 'React' },
  { id: 'api', icon: CpuChipIcon, label: 'API', desc: 'Node.js' },
]

const SUGGESTED_FEATURES = {
  ios: [
    'Dark Mode',
    'Push Notifications', 
    'Haptic Feedback',
    'Offline Support',
    'Biometric Auth',
    'CloudKit Sync',
    'Widgets',
    'App Clips',
    'SharePlay',
    'Live Activities'
  ],
  web: [
    'Responsive Design',
    'Dark Mode',
    'PWA Support',
    'Auth System',
    'API Integration',
    'Real-time Updates'
  ],
  api: [
    'REST API',
    'GraphQL',
    'Authentication',
    'Database',
    'File Upload',
    'Rate Limiting'
  ]
}

export default function ProjectWizard({ agents, onClose, onPipelineStart }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    name: '',
    type: 'ios',
    description: '',
    suggestedFeatures: SUGGESTED_FEATURES.ios,
    selectedFeatures: [],
    suggestedScreens: [],
    selectedScreens: [],
  })

  const currentStep = STEPS[step]

  const updateData = (key, value) => {
    setData(d => {
      const newData = { ...d, [key]: value }
      // Update suggested features when type changes
      if (key === 'type') {
        newData.suggestedFeatures = SUGGESTED_FEATURES[value] || []
        newData.selectedFeatures = []
      }
      return newData
    })
  }

  const toggleFeature = (feature) => {
    setData(d => ({
      ...d,
      selectedFeatures: d.selectedFeatures.includes(feature)
        ? d.selectedFeatures.filter(f => f !== feature)
        : [...d.selectedFeatures, feature]
    }))
  }

  const handleAnalyze = async () => {
    setLoading(true)
    
    try {
      const res = await authFetch(`${API}/wizard/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          description: data.description
        })
      })
      const result = await res.json()
      
      // Add PM suggestions to existing features
      const allFeatures = [...new Set([...SUGGESTED_FEATURES[data.type], ...(result.features || [])])]
      
      updateData('suggestedFeatures', allFeatures)
      updateData('suggestedScreens', result.screens || [])
      updateData('selectedFeatures', result.features?.slice(0, 3) || [])
      updateData('selectedScreens', result.screens?.slice(0, 4) || [])
      
      setStep(1)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleStartPipeline = async () => {
    setLoading(true)
    
    try {
      const res = await authFetch(`${API}/pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: data.name,
          description: data.description,
          features: data.selectedFeatures,
          screens: data.selectedScreens.map(s => 
            typeof s === 'string' 
              ? { name: s, description: `${s} screen for ${data.name}` }
              : s
          )
        })
      })
      
      const pipeline = await res.json()
      onPipelineStart(pipeline)
    } catch (e) {
      console.error(e)
    }
    
    setLoading(false)
  }

  const canNext = () => {
    if (step === 0) return data.name.trim() && data.description.trim()
    if (step === 1) return data.selectedFeatures.length > 0
    return true
  }

  const renderStep = () => {
    switch (currentStep.id) {
      case 'basics':
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">App Name</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={e => updateData('name', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-zinc-500 focus:outline-none text-sm"
                  placeholder="MyAwesomeApp"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Type</label>
                <div className="flex gap-2">
                  {PROJECT_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => updateData('type', type.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-sm transition-all ${
                        data.type === type.id 
                          ? 'border-white bg-white/5' 
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">What does your app do?</label>
              <textarea
                value={data.description}
                onChange={e => updateData('description', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-zinc-500 focus:outline-none resize-none h-32 text-sm"
                placeholder="Describe your app in detail. What problem does it solve? Who is it for? What are the key features?"
              />
            </div>
            
            <button
              onClick={handleAnalyze}
              disabled={!canNext() || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                  Analyzing with PM...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Analyze with PM Agent
                </>
              )}
            </button>
          </div>
        )

      case 'features':
        return (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-zinc-400">Features</label>
                <span className="text-xs text-zinc-500">{data.selectedFeatures.length} selected</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-auto">
                {data.suggestedFeatures.map((feature, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-sm ${
                      data.selectedFeatures.includes(feature)
                        ? 'bg-white/10 border border-white/20'
                        : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={data.selectedFeatures.includes(feature)}
                      onChange={() => toggleFeature(feature)}
                      className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-white focus:ring-0"
                    />
                    {feature}
                  </label>
                ))}
              </div>
            </div>
            
            {data.suggestedScreens.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400">Suggested Screens</label>
                  <span className="text-xs text-zinc-500">{data.selectedScreens.length} selected</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-auto">
                  {data.suggestedScreens.map((screen, i) => {
                    const screenName = typeof screen === 'string' ? screen : screen.name
                    const isSelected = data.selectedScreens.some(s => 
                      (typeof s === 'string' ? s : s.name) === screenName
                    )
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white/10 border border-white/20'
                            : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setData(d => ({
                              ...d,
                              selectedScreens: isSelected
                                ? d.selectedScreens.filter(s => 
                                    (typeof s === 'string' ? s : s.name) !== screenName
                                  )
                                : [...d.selectedScreens, screen]
                            }))
                          }}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-white focus:ring-0"
                        />
                        <span className="text-sm">{screenName}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )

      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <h4 className="font-medium mb-3">{data.name}</h4>
              <p className="text-sm text-zinc-400 mb-4">{data.description}</p>
              
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-zinc-500">Features</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {data.selectedFeatures.map((f, i) => (
                      <span key={i} className="px-2 py-1 text-xs rounded-lg bg-zinc-700">{f}</span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <span className="text-xs text-zinc-500">Screens</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {data.selectedScreens.map((s, i) => (
                      <span key={i} className="px-2 py-1 text-xs rounded-lg bg-zinc-700">
                        {typeof s === 'string' ? s : s.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <RocketLaunchIcon className="w-5 h-5 text-purple-400" />
                Pipeline Preview
              </h4>
              <ol className="text-sm text-zinc-400 space-y-1">
                <li>1. PM will refine screen descriptions</li>
                <li>2. Stitch will generate UI designs (parallel with scaffold)</li>
                <li>3. iOS Dev creates buildable project structure</li>
                <li>4. You review designs & provide feedback</li>
                <li>5. iOS Dev implements approved designs</li>
                <li>6. Tests are written and run</li>
                <li>7. Screenshots captured from simulator</li>
              </ol>
            </div>
            
            <button
              onClick={handleStartPipeline}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 text-sm font-medium"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Starting Pipeline...
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="w-4 h-4" />
                  Start Development Pipeline
                </>
              )}
            </button>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-[520px] max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {STEPS.map((s, i) => (
                <div key={s.id} className={`w-10 h-1 rounded-full ${i <= step ? 'bg-white' : 'bg-zinc-700'}`} />
              ))}
            </div>
            <span className="text-xs text-zinc-500">{currentStep.title}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {renderStep()}
        </div>

        {/* Footer */}
        {step > 0 && step < 2 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-zinc-800 text-sm text-zinc-400"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-sm font-medium"
            >
              Continue <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        
        {step === 2 && (
          <div className="flex items-center p-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-zinc-800 text-sm text-zinc-400"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
