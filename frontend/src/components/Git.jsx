import { useState, useEffect } from 'react'
import { 
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

export default function Git({ project }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    if (project) fetchStatus()
  }, [project])

  const fetchStatus = async () => {
    if (!project) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/git/status?project=${encodeURIComponent(project.path)}`)
      setStatus(await res.json())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    try {
      await fetch(`${API}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: project.path, message: commitMsg })
      })
      setCommitMsg('')
      await fetchStatus()
    } catch (e) {
      console.error(e)
    }
    setCommitting(false)
  }

  const handlePush = async () => {
    await fetch(`${API}/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project.path })
    })
    await fetchStatus()
  }

  const handlePull = async () => {
    await fetch(`${API}/git/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project.path })
    })
    await fetchStatus()
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Select a project</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Git</h1>
          <p className="text-sm text-zinc-500">{project.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStatus} className="p-2 rounded-lg hover:bg-zinc-800 transition-all">
            <ArrowPathIcon className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handlePull} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">
            <ArrowDownIcon className="w-3.5 h-3.5" /> Pull
          </button>
          <button onClick={handlePush} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200">
            <ArrowUpIcon className="w-3.5 h-3.5" /> Push
          </button>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            {/* Branch */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Branch</p>
              <p className="font-medium">{status.branch || 'main'}</p>
            </div>

            {/* Changes */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2">Changes ({status.changes?.length || 0})</p>
              {status.changes?.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-500 text-sm">
                  <CheckIcon className="w-4 h-4" /> Clean
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-auto">
                  {status.changes?.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`text-xs w-4 ${c.status === 'M' ? 'text-yellow-500' : c.status === 'A' ? 'text-emerald-500' : c.status === 'D' ? 'text-red-500' : 'text-blue-500'}`}>
                        {c.status}
                      </span>
                      <span className="font-mono text-xs truncate text-zinc-400">{c.file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commit */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2">Commit</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-zinc-600 focus:outline-none text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleCommit()}
                />
                <button
                  onClick={handleCommit}
                  disabled={committing || !commitMsg.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-50"
                >
                  {committing ? '...' : 'Commit'}
                </button>
              </div>
            </div>
          </div>

          {/* Log */}
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-2">Recent Commits</p>
            <div className="space-y-1">
              {status.log?.map((commit, i) => (
                <div key={i} className="text-sm font-mono text-zinc-400 truncate py-1">
                  {commit}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
