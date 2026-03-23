import { useState } from 'react'
import { 
  ArrowPathIcon, 
  ChatBubbleLeftIcon,
  PlayIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export default function Agents({ agents, agentStatus, activeTasks, onChat, onRefresh }) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    await onRefresh()
    setLoading(false)
  }

  const workingAgents = Object.values(agentStatus || {}).filter(s => s.status === 'working')
  const idleAgents = agents.filter(a => agentStatus?.[a.id]?.status !== 'working')

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {workingAgents.length} active · {idleAgents.length} idle
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-all"
        >
          <ArrowPathIcon className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Active Tasks */}
      {activeTasks?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Running Tasks</h2>
          <div className="space-y-2">
            {activeTasks.map((task, i) => (
              <div 
                key={i}
                className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{task.agent}</p>
                    <p className="text-xs text-indigo-400 truncate">{task.message}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <ClockIcon className="w-3 h-3" />
                    Running
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Working Agents */}
      {workingAgents.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Working</h2>
          <div className="grid grid-cols-2 gap-3">
            {agents.filter(a => agentStatus?.[a.id]?.status === 'working').map(agent => {
              const status = agentStatus[agent.id]
              return (
                <div
                  key={agent.id}
                  className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-400">
                      {(agent.name || agent.id).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{agent.name || agent.id}</p>
                        <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-xs text-zinc-500 font-mono">{agent.id}</p>
                    </div>
                  </div>
                  <p className="text-sm text-indigo-400 mb-3 line-clamp-2">{status?.message || 'Working...'}</p>
                  <button
                    onClick={() => onChat(agent)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 transition-all text-sm text-indigo-300"
                  >
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                    Chat
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All Agents */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">All Agents</h2>
        <div className="grid grid-cols-3 gap-3">
          {agents.map(agent => {
            const status = agentStatus?.[agent.id]
            const isWorking = status?.status === 'working'
            return (
              <div
                key={agent.id}
                className={`p-4 rounded-xl border transition-all ${
                  isWorking 
                    ? 'bg-indigo-500/5 border-indigo-500/20' 
                    : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    isWorking ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {(agent.name || agent.id).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{agent.name || agent.id}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{agent.id}</p>
                  </div>
                  {isWorking && (
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${isWorking ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
                  <span className={`text-xs ${isWorking ? 'text-indigo-400' : 'text-zinc-500'}`}>
                    {isWorking ? 'Working' : 'Idle'}
                  </span>
                </div>

                <button
                  onClick={() => onChat(agent)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all text-sm"
                >
                  <ChatBubbleLeftIcon className="w-4 h-4" />
                  Chat
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
