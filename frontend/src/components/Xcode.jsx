import { useState, useEffect } from 'react'
import { PlayIcon, BeakerIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

export default function Xcode({ project, logs }) {
  const [schemes, setSchemes] = useState([])
  const [selectedScheme, setSelectedScheme] = useState('')
  const [loading, setLoading] = useState(false)

  const buildLogs = logs.filter(l => l.type === 'build' || l.type === 'test').slice(-20)

  useEffect(() => {
    if (project?.hasXcode) fetchSchemes()
  }, [project])

  const fetchSchemes = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/xcode/schemes?project=${encodeURIComponent(project.path)}`)
      const data = await res.json()
      setSchemes(data.schemes || [])
      if (data.schemes?.length > 0) setSelectedScheme(data.schemes[0])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleBuild = async () => {
    await fetch(`${API}/xcode/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project.path, scheme: selectedScheme })
    })
  }

  const handleTest = async () => {
    await fetch(`${API}/xcode/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project.path, scheme: selectedScheme })
    })
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Select a project</p>
      </div>
    )
  }

  if (!project.hasXcode) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500 text-sm">No Xcode project</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Build</h1>
          <p className="text-sm text-zinc-500">{project.name}</p>
        </div>
        <button onClick={fetchSchemes} className="p-2 rounded-lg hover:bg-zinc-800 transition-all">
          <ArrowPathIcon className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Controls */}
        <div className="space-y-3">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-2">Scheme</p>
            <select
              value={selectedScheme}
              onChange={e => setSelectedScheme(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 focus:outline-none text-sm"
            >
              {schemes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={handleBuild}
            disabled={!selectedScheme}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm disabled:opacity-50"
          >
            <PlayIcon className="w-4 h-4" /> Build
          </button>

          <button
            onClick={handleTest}
            disabled={!selectedScheme}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50"
          >
            <BeakerIcon className="w-4 h-4" /> Test
          </button>
        </div>

        {/* Logs */}
        <div className="col-span-2 glass rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-2">Output</p>
          <div className="h-80 overflow-auto bg-black/30 rounded-lg p-3 font-mono text-xs">
            {buildLogs.length === 0 ? (
              <span className="text-zinc-600">Waiting for build...</span>
            ) : (
              buildLogs.map((log, i) => (
                <div key={i} className={`py-0.5 ${log.error ? 'text-red-400' : log.done ? (log.code === 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-400'}`}>
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
