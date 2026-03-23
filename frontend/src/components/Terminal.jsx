import { useState, useRef, useEffect } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

export default function Terminal({ project }) {
  const [history, setHistory] = useState([{ type: 'system', text: '$ Ready' }])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || running) return

    const cmd = input.trim()
    setInput('')
    setHistory(h => [...h, { type: 'input', text: `$ ${cmd}` }])
    setRunning(true)

    try {
      const res = await fetch(`${API}/shell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: project?.path })
      })
      const data = await res.json()
      if (data.stdout) setHistory(h => [...h, { type: 'output', text: data.stdout }])
      if (data.stderr) setHistory(h => [...h, { type: 'error', text: data.stderr }])
      if (data.error) setHistory(h => [...h, { type: 'error', text: data.error }])
    } catch (e) {
      setHistory(h => [...h, { type: 'error', text: e.message }])
    }
    setRunning(false)
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Terminal</h1>
          <p className="text-sm text-zinc-500 font-mono">{project?.path || '~'}</p>
        </div>
        <button onClick={() => setHistory([{ type: 'system', text: '$ Cleared' }])} className="p-2 rounded-lg hover:bg-zinc-800">
          <TrashIcon className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 glass rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto p-4 font-mono text-xs">
          {history.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap mb-0.5 ${
              line.type === 'input' ? 'text-blue-400' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'system' ? 'text-zinc-500' : 'text-zinc-300'
            }`}>
              {line.text}
            </div>
          ))}
          {running && <span className="text-zinc-500">Running...</span>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 text-sm">$</span>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={running}
              className="flex-1 bg-transparent focus:outline-none text-sm"
              placeholder="command"
              autoFocus
            />
          </div>
        </form>
      </div>
    </div>
  )
}
