import { 
  Squares2X2Icon, 
  FolderIcon, 
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { APP_VERSION, APP_NAME } from '../version'

const navItems = [
  { id: 'dashboard', icon: Squares2X2Icon, label: 'Overview' },
  { id: 'projects', icon: FolderIcon, label: 'Projects' },
  { id: 'oneliner', icon: SparklesIcon, label: 'AI Creator' },
]

export default function Sidebar({ view, setView, selectedProject, agents, agentStatus, activeTasks, collapsed, onToggle }) {
  const workingAgents = Object.values(agentStatus || {}).filter(s => s.status === 'working')
  
  // Collapsed view
  if (collapsed) {
    return (
      <aside className="w-14 h-full bg-zinc-900/50 border-r border-zinc-800/50 flex flex-col">
        {/* Toggle Button */}
        <button 
          onClick={onToggle}
          className="p-4 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Nav Icons */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full p-2.5 rounded-lg flex items-center justify-center transition-all ${
                view === item.id 
                  ? 'bg-white/10 text-white' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </button>
          ))}
        </nav>

        {/* Working indicator */}
        {workingAgents.length > 0 && (
          <div className="p-2 border-t border-zinc-800/50">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </aside>
    )
  }

  // Expanded view
  return (
    <aside className="w-56 h-full bg-zinc-900/50 border-r border-zinc-800/50 flex flex-col">
      {/* Logo + Toggle */}
      <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">⚡</span>
          </div>
          <div>
            <span className="font-semibold text-sm">{APP_NAME}</span>
            <p className="text-[10px] text-zinc-500">v{APP_VERSION}</p>
          </div>
        </div>
        <button 
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              view === item.id 
                ? 'bg-white/10 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Selected Project */}
      {selectedProject && (
        <div className="p-3 border-t border-zinc-800/50">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Project</p>
          <button
            onClick={() => setView('project')}
            className="w-full flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
          >
            <span>{selectedProject.type === 'ios' ? '📱' : '📁'}</span>
            <span className="text-xs truncate">{selectedProject.name}</span>
          </button>
        </div>
      )}

      {/* Agents */}
      <div className="p-3 border-t border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Agents</p>
          {workingAgents.length > 0 && (
            <span className="text-[10px] text-indigo-400">{workingAgents.length} active</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {(agents || []).slice(0, 10).map(agent => {
            const status = agentStatus?.[agent.id]
            return (
              <div
                key={agent.id}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                  status?.status === 'working'
                    ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/50'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
                title={`${agent.name || agent.id} - ${status?.status || 'idle'}`}
              >
                {(agent.name || agent.id).charAt(0).toUpperCase()}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
