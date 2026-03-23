import { useState, useEffect } from 'react'
import { ArrowPathIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

export default function Simulators() {
  const [simulators, setSimulators] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchSimulators()
  }, [])

  const fetchSimulators = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/simulators`)
      setSimulators(await res.json())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleBoot = async (udid) => {
    await fetch(`${API}/simulators/${udid}/boot`, { method: 'POST' })
    await fetchSimulators()
  }

  const handleShutdown = async (udid) => {
    await fetch(`${API}/simulators/${udid}/shutdown`, { method: 'POST' })
    await fetchSimulators()
  }

  const runtimes = [...new Set(simulators.map(s => s.runtime))].sort().reverse()
  const filtered = filter === 'all' ? simulators : simulators.filter(s => s.runtime === filter)
  const booted = simulators.filter(s => s.state === 'Booted')

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Devices</h1>
          <p className="text-sm text-zinc-500">{booted.length} running</p>
        </div>
        <button onClick={fetchSimulators} className="p-2 rounded-lg hover:bg-zinc-800 transition-all">
          <ArrowPathIcon className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${filter === 'all' ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700'}`}
        >
          All
        </button>
        {runtimes.slice(0, 5).map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${filter === r ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          >
            {r.replace('iOS-', 'iOS ')}
          </button>
        ))}
      </div>

      {/* Running */}
      {booted.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Running
          </p>
          <div className="grid grid-cols-4 gap-2">
            {booted.map(sim => (
              <div key={sim.udid} className="glass rounded-lg p-3 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate">{sim.name}</span>
                  <button onClick={() => handleShutdown(sim.udid)} className="p-1 rounded hover:bg-zinc-700">
                    <StopIcon className="w-3 h-3 text-red-400" />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500">{sim.runtime.replace('iOS-', 'iOS ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All */}
      <div className="grid grid-cols-4 gap-2">
        {filtered.filter(s => s.state !== 'Booted').map(sim => (
          <div key={sim.udid} className="glass rounded-lg p-3 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm truncate">{sim.name}</span>
              <button 
                onClick={() => handleBoot(sim.udid)} 
                className="p-1 rounded hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <PlayIcon className="w-3 h-3 text-emerald-400" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">{sim.runtime.replace('iOS-', 'iOS ')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
