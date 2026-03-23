# Dashboard Pipeline Specification

## Overview
Real-time app development pipeline with parallel iOS development and design review.

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PIPELINE STAGES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. PROMPT & ANALYSIS                                                       │
│     └─► User enters app idea                                                │
│     └─► PM Agent analyzes → suggests features & screens                     │
│     └─► User confirms selections                                            │
│                                                                             │
│  2. PARALLEL EXECUTION (Starts simultaneously)                              │
│     ┌────────────────────────┬──────────────────────────────────┐          │
│     │  DESIGN TRACK          │  iOS DEVELOPMENT TRACK            │          │
│     │                        │                                   │          │
│     │  Stitch generates UI   │  ios-dev creates project         │          │
│     │  for each screen       │  (buildable, no UI yet)          │          │
│     │  ↓                     │                                   │          │
│     │  Show designs as they  │  Full SwiftUI structure          │          │
│     │  arrive in terminal    │  Navigation, models, services    │          │
│     │  ↓                     │                                   │          │
│     │  User reviews all      │  Compiles & runs                 │          │
│     │  designs together      │                                   │          │
│     └────────────────────────┴──────────────────────────────────┘          │
│                                                                             │
│  3. DESIGN REVIEW (User Interaction)                                        │
│     └─► Display all screens in gallery                                      │
│     └─► User can:                                                           │
│         • Approve all → Continue                                            │
│         • Add feedback per screen → Re-generate                             │
│         • Add new screen → Generate new                                     │
│         • Loop until satisfied                                              │
│                                                                             │
│  4. DESIGN IMPLEMENTATION                                                   │
│     └─► ios-dev implements approved designs                                 │
│     └─► Updates SwiftUI views with actual UI                               │
│     └─► Each screen implemented sequentially                                │
│                                                                             │
│  5. TESTING                                                                 │
│     └─► ios-test writes unit tests                                         │
│     └─► ios-test writes UI tests                                           │
│     └─► Run all tests, report results                                      │
│                                                                             │
│  6. SCREENSHOTS & COMPLETION                                                │
│     └─► Boot simulator                                                      │
│     └─► Launch app                                                          │
│     └─► Capture screenshots of each screen                                  │
│     └─► Display final gallery in dashboard                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Models

### Pipeline
```json
{
  "id": "uuid",
  "projectName": "MyApp",
  "status": "designing|reviewing|implementing|testing|complete|paused",
  "currentStage": "design|review|implement|test|screenshot",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  
  "config": {
    "appDescription": "...",
    "features": ["..."],
    "screens": [
      { "name": "Home", "description": "Main screen" },
      { "name": "Settings", "description": "App settings" }
    ]
  },
  
  "design": {
    "stitchProjectId": "...",
    "screens": [
      {
        "name": "Home",
        "status": "pending|generating|ready|feedback|approved",
        "prompt": "...",
        "screenshot": "/path/to/image.png",
        "html": "/path/to/file.html",
        "feedback": "User feedback if any",
        "version": 1
      }
    ],
    "reviewStatus": "pending|in-progress|approved"
  },
  
  "development": {
    "status": "pending|scaffold|implementing|complete",
    "xcodeProject": "/path/to/project.xcodeproj",
    "implementedScreens": ["Home"],
    "buildStatus": "pending|building|success|failed"
  },
  
  "testing": {
    "status": "pending|running|complete",
    "unitTests": { "passed": 0, "failed": 0, "total": 0 },
    "uiTests": { "passed": 0, "failed": 0, "total": 0 }
  },
  
  "screenshots": {
    "status": "pending|capturing|complete",
    "images": [
      { "screen": "Home", "path": "/path/to/screenshot.png" }
    ]
  }
}
```

### Event Stream
```json
{
  "type": "pipeline_stage|design_ready|build_status|test_result|screenshot_captured",
  "pipelineId": "...",
  "data": { ... },
  "timestamp": "ISO"
}
```

## API Endpoints

### Pipeline Management
- `POST /api/pipeline/start` - Start new pipeline
- `GET /api/pipeline/:id` - Get pipeline status
- `POST /api/pipeline/:id/pause` - Pause pipeline
- `POST /api/pipeline/:id/resume` - Resume pipeline

### Design Review
- `GET /api/pipeline/:id/designs` - Get all designs
- `POST /api/pipeline/:id/designs/:screenName/feedback` - Add feedback
- `POST /api/pipeline/:id/designs/:screenName/approve` - Approve single
- `POST /api/pipeline/:id/designs/approve-all` - Approve all
- `POST /api/pipeline/:id/screens` - Add new screen

### Progress
- `GET /api/pipeline/:id/logs` - Get pipeline logs
- WebSocket: Real-time updates for all stages

## Frontend Components

### PipelineView (Main Container)
- Shows current stage progress bar
- Contains stage-specific panels
- Activity log sidebar

### DesignGallery
- Grid of screen designs
- Click to enlarge
- Feedback input per screen
- Approve/Request Changes buttons

### ImplementationProgress
- List of screens being implemented
- Real-time status updates
- Code preview (optional)

### TestResults
- Unit test results table
- UI test results table
- Pass/fail indicators

### ScreenshotGallery
- Final app screenshots
- Device frame mockups
- Export options

## Implementation Order

1. Backend Pipeline Engine
2. WebSocket event streaming
3. Frontend PipelineView component
4. Design generation with real Stitch
5. Design review UI
6. iOS scaffold generation (via ios-dev agent)
7. Design implementation phase
8. Test execution
9. Screenshot capture
