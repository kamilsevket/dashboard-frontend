import { FolderIcon, CpuChipIcon, PlayIcon } from '@heroicons/react/24/outline'
import { APP_VERSION } from '../version'

export default function Dashboard({ projects, agents, agentStatus, activeTasks, logs, activePipeline, onStartPipeline, onRefreshProjects }) {
  const workingAgents = Object.values(agentStatus || {}).filter(s => s.status === 'working')
  const iosProjects = projects.filter(p => p.type === 'ios')
  const recentLogs = logs.slice(-5).reverse()
  
  return (
    <div className="h-full overflow-auto">
      {/* Header with Version */}
      <header className="px-6 py-4 bg-zinc-900/30 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-sm text-zinc-500">v{APP_VERSION}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onStartPipeline}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
          >
            🚀 New iOS Project
          </button>
          <button
            onClick={onRefreshProjects}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Active Pipeline */}
        {activePipeline && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-purple-300">Active Pipeline</h3>
                <p className="text-sm text-zinc-400">{activePipeline.projectName}</p>
                <p className="text-xs text-zinc-500 mt-1">Stage: {activePipeline.currentStage} • Status: {activePipeline.status}</p>
              </div>
              <div className="flex items-center gap-2">
                {activePipeline.status === 'running' && (
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                )}
                <span className="text-sm text-purple-300">{activePipeline.status}</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard 
            icon={FolderIcon}
            value={projects.length}
            label="Projects"
            trend={iosProjects.length > 0 ? `${iosProjects.length} iOS` : null}
          />
          <StatCard 
            icon={CpuChipIcon}
            value={agents.length}
            label="Agents"
            trend={workingAgents.length > 0 ? `${workingAgents.length} active` : 'All idle'}
            trendUp={workingAgents.length > 0}
          />
          <StatCard 
            icon={PlayIcon}
            value={activeTasks.length}
            label="Active Tasks"
            trend={activeTasks.length > 0 ? 'Running' : 'None'}
            trendUp={activeTasks.length > 0}
          />
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {recentLogs.length === 0 ? (
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 text-center">
                <p className="text-sm text-zinc-500">No recent activity</p>
              </div>
            ) : (
              recentLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-lg text-xs ${
                    log.error ? 'bg-red-500/10 text-red-400' :
                    log.done ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-zinc-900/50 border border-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{log.type || log.source}</span>
                    {log.agent && <span className="text-zinc-500">• {log.agent}</span>}
                    <span className="text-zinc-500 ml-auto">{new Date(log.time || log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="truncate">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, value, label, trend, trendUp }) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-zinc-800">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
        {trend && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  )
}