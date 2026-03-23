# ⚡ OpenClaw Dashboard

A beautiful, modern dashboard for managing your AI-powered development factory.

![Dashboard](https://via.placeholder.com/800x450/09090b/fafafa?text=OpenClaw+Dashboard)

## Features

### 🎯 Overview Dashboard
- Real-time project stats
- Active agent monitoring
- Live activity feed
- Quick access to everything

### 🤖 Agent Management
- See all 13+ agents at a glance
- Monitor working/idle status
- Chat with any agent directly
- Track active tasks in real-time

### 📦 Project Management
- Create projects with AI wizard
- PM agent analyzes your idea
- Select features from suggestions
- Auto-generate UI with Stitch
- Agent-powered project setup

### 🎨 Design Integration (Stitch)
- Google Stitch MCP integration
- AI-generated UI designs
- Design preview in project detail
- Export as PNG/HTML

### 🔧 Development Tools
- **Git**: Status, commit, push, pull
- **Xcode**: Build, test, run
- **Simulators**: Boot, shutdown, manage
- **Terminal**: Run any command

## Quick Start

```bash
cd ~/clawd-main/dashboard
./start.sh
```

Open: **http://localhost:5173**

## Manual Start

```bash
# Terminal 1 - Backend
cd backend && npm install && node server.js

# Terminal 2 - Frontend
cd frontend && npm install && npm run dev
```

## Project Structure

```
dashboard/
├── frontend/           # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── App.jsx     # Main app
│   │   └── index.css   # Styles
│   └── package.json
│
├── backend/            # Express.js API
│   ├── server.js       # API server
│   └── package.json
│
├── projects/           # Created projects
│   └── <project>/
│       ├── designs/    # Stitch outputs
│       ├── docs/       # Documentation
│       └── ...         # Project files
│
├── start.sh            # Start script
└── README.md
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/agents` | List all agents |
| `POST /api/agents/:id/chat` | Chat with agent |
| `GET /api/projects` | List projects |
| `POST /api/projects` | Create project |
| `GET /api/projects/:name` | Project detail |
| `GET /api/projects/:name/designs` | Project designs |
| `GET /api/projects/:name/files` | Project files |
| `POST /api/wizard/analyze` | PM analyzes idea |
| `POST /api/wizard/task` | Run agent task |
| `POST /api/stitch/generate` | Generate UI |
| `GET /api/git/status` | Git status |
| `POST /api/git/commit` | Commit changes |
| `GET /api/simulators` | List simulators |
| `POST /api/shell` | Run command |

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Node.js, Express, WebSocket
- **Design**: Dark theme, glassmorphism
- **Icons**: Heroicons

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘ + K` | Search (coming soon) |
| `⌘ + N` | New project |
| `Esc` | Close modals |

---

Built with ⚡ by Hex for OpenClaw
