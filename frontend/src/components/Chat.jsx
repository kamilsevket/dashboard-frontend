import { useState, useRef, useEffect } from 'react'
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline'

import { API, authFetch } from '../config'

const QUICK_PROMPTS = [
  "What can you help me with?",
  "Analyze this project",
  "Suggest improvements",
  "Create a new feature",
]

export default function Chat({ agent, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load chat history from backend
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API}/chats/${agent.id}`)
        if (res.ok) {
          const history = await res.json()
          setMessages(history.map(h => ({
            role: h.role,
            content: h.content,
            time: h.time
          })))
        }
      } catch (e) {
        console.error('Failed to load chat history:', e)
      }
      setLoading(false)
    }
    loadHistory()
  }, [agent.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])

  const handleSend = async (text) => {
    const msg = text || input.trim()
    if (!msg || sending) return

    setInput('')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setSending(true)

    try {
      const res = await fetch(`${API}/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.response || 'No response' }])
    } catch (e) {
      setMessages(m => [...m, { role: 'error', content: `Error: ${e.message}` }])
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-zinc-950 border-l border-zinc-800 flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {(agent.name || agent.id).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{agent.name || agent.id}</p>
            <p className="text-xs text-zinc-500">{agent.id}</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 rounded-lg hover:bg-zinc-800 transition-all"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <SparklesIcon className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="font-medium mb-1">Chat with {agent.name || agent.id}</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-[280px]">
              Ask questions, request tasks, or get help with your project
            </p>
            
            {/* Quick Prompts */}
            <div className="space-y-2 w-full max-w-[280px]">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all text-left text-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : msg.role === 'error'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-zinc-800 text-zinc-100'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={sending}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-zinc-700 focus:outline-none text-sm"
            placeholder="Type a message..."
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
