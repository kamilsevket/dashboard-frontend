import { useState } from 'react'
import { 
  PlusIcon,
  ArrowPathIcon,
  FolderIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import ProjectWizard from './ProjectWizard'

export default function Projects({ projects, selected, onSelect, onRefresh, agents }) {
  const [showWizard, setShowWizard] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const handleComplete = async () => {
    setShowWizard(false)
    await onRefresh()
  }

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || p.type === filter
    return matchesSearch && matchesFilter
  })

  const stats = {
    total: projects.length,
    ios: projects.filter(p => p.type === 'ios').length,
    web: projects.filter(p => p.type === 'web' || p.type === 'node').length,
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {stats.total} projects · {stats.ios} iOS · {stats.web} Web
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-all"
          >
            <ArrowPathIcon className="w-5 h-5 text-zinc-400" />
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-all"
          >
            <PlusIcon className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-zinc-700 focus:outline-none text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          {[
            { id: 'all', label: 'All' },
            { id: 'ios', label: 'iOS' },
            { id: 'web', label: 'Web' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded text-sm transition-all ${
                filter === f.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Wizard */}
      {showWizard && (
        <ProjectWizard 
          agents={agents}
          onClose={() => setShowWizard(false)}
          onComplete={handleComplete}
        />
      )}

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4">
            <FolderIcon className="w-8 h-8 text-zinc-700" />
          </div>
          <p className="text-zinc-400 mb-1">
            {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
          </p>
          <p className="text-sm text-zinc-600">
            {projects.length === 0 
              ? 'Create your first project to get started' 
              : 'Try a different search term'}
          </p>
          {projects.length === 0 && (
            <button
              onClick={() => setShowWizard(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <button
              key={project.name}
              onClick={() => onSelect(project)}
              className={`p-5 rounded-xl border text-left transition-all hover:border-zinc-600 group ${
                selected?.name === project.name 
                  ? 'bg-zinc-900 border-white/20' 
                  : 'bg-zinc-900/50 border-zinc-800/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  {project.type === 'ios' ? '📱' : project.type === 'web' ? '🌐' : '📁'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium mb-1">{project.name}</h3>
                  <p className="text-xs text-zinc-500 truncate">{project.path}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4">
                {project.hasGit && (
                  <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400">Git</span>
                )}
                {project.hasXcode && (
                  <span className="px-2 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400">Xcode</span>
                )}
                {project.hasPackage && (
                  <span className="px-2 py-0.5 text-[10px] rounded bg-green-500/10 text-green-400">npm</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
