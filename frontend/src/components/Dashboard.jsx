import { 
  FolderIcon, 
  CpuChipIcon, 
  ClockIcon,
  ArrowTrendingUpIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import OneLiner from './OneLiner'

export default function Dashboard({ projects, agents, agentStatus, activeTasks, logs, onSelectProject, onSelectAgent, onProjectCreated }) {
  const recentLogs = logs.slice(-10).reverse()
  const workingAgents = Object.values(agentStatus || {}).filter(s => s.status === 'working')
  const iosProjects = projects.filter(p => p.type === 'ios')
  
  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Your development factory at a glance</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            System Online
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
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
        <StatCard 
          icon={ArrowTrendingUpIcon}
          value={logs.length}
          label="Events"
          trend="Today"
        />
      </div>

      {/* One-Liner App Builder */}
      <div className="mb-8">
        <OneLiner onProjectCreated={onProjectCreated} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Projects */}
        <div className="col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-400">Recent Projects</h2>
            <span className="text-xs text-zinc-600">{projects.length} total</span>
          </div>
          <div className="space-y-2">
            {projects.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-900/50 border border-zinc-800/50 text-center">
                <FolderIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No projects yet</p>
                <p className="text-xs text-zinc-600 mt-1">Create your first project</p>
              </div>
            ) : (
              projects.slice(0, 5).map(project => (
                <button
                  key={project.name}
                  onClick={() => onSelectProject(project)}
                  className="w-full p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-lg">
                      {project.type === 'ios' ? '📱' : project.type === 'web' ? '🌐' : '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{project.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {project.hasGit && <span className="text-[10px] text-zinc-500">Git</span>}
                        {project.hasXcode && <span className="text-[10px] text-zinc-500">Xcode</span>}
                      </div>
                    </div>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Agents */}
        <div className="col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-400">Agents</h2>
            <span className="text-xs text-zinc-600">{workingAgents.length} active</span>
          </div>
          <div className="space-y-2">
            {agents.slice(0, 6).map(agent => {
              const status = agentStatus?.[agent.id]
              const isWorking = status?.status === 'working'
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent)}
                  className={`w-full p-3 rounded-xl border transition-all text-left ${
                    isWorking 
                      ? 'bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40' 
                      : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isWorking ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {(agent.name || agent.id).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{agent.name || agent.id}</p>
                      <p className={`text-xs ${isWorking ? 'text-indigo-400' : 'text-zinc-500'}`}>
                        {isWorking ? status.message || 'Working...' : 'Idle'}
                      </p>
                    </div>
                    {isWorking && (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Activity */}
        <div className="col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-400">Activity</h2>
            <span className="text-xs text-zinc-600">{logs.length} events</span>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 h-[320px] overflow-auto">
            {recentLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <ClockIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No activity</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log, i) => (
                  <div 
                    key={i} 
                    className={`p-2 rounded-lg text-xs ${
                      log.error ? 'bg-red-500/10 text-red-400' :
                      log.done ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-zinc-800/50 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.type}</span>
                      {log.agent && <span className="text-zinc-500">• {log.agent}</span>}
                    </div>
                    <p className="truncate">{log.message}</p>
                  </div>
                ))}
              </div>
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
