# CreatorFlow AI - Frontend Rebuild Implementation Plan

## Status: IN PROGRESS

### Backend: ✅ COMPLETE
All backend services, API endpoints, and pipeline logic fully implemented.

### Frontend: 🚧 BUILDING NOW

## Frontend Structure

### Main Components to Build:

1. **Dashboard Tab** (NEW - with Analytics)
   - Analytics cards (views, clicks, shares, watch time)
   - Chart visualization (recharts)
   - Time filter (7d, 30d)
   - Recent projects list

2. **Projects Tab** (ENHANCED)
   - Project list with better cards
   - Progress indicators
   - Status badges

3. **New Project Modal** (COMPLETELY REDESIGNED)
   - Language dropdown (fetch from /api/languages)
   - Voice dropdown (fetch from /api/heygen/voices when HeyGen connected)
   - Avatar dropdown (fetch from /api/heygen/avatars when HeyGen connected)
   - Duration, Aspect Ratio, Content Style
   - Publishing Mode dropdown
   - Conditional Schedule Date/Time pickers (shown when Scheduled selected)
   - Better validation

4. **Project Detail Page** (MAJOR OVERHAUL)
   - Overall progress bar with percentage
   - Current step indicator
   - Pipeline steps visualization with strict statuses:
     * Pending (gray)
     * Running (blue, animated)
     * Completed (green with checkmark)
     * Failed (red with error)
   - Each step expandable with:
     * Cached result display
     * Regenerate button
     * Error details if failed
   - Improved evaluation display (cards for strengths/weaknesses)
   - Thumbnail preview and selection
   - Publishing confirmation modal

5. **Integrations Tab** (EXPANDED)
   - Existing: OpenAI, HeyGen, YouTube (improved design)
   - NEW Coming Soon cards: Instagram, Facebook, LinkedIn, X (Twitter)
   - Better connection status indicators
   - Selected voice/avatar display for HeyGen

6. **Settings Tab**
   - User profile
   - Preferences

### Key Features Implementation:

#### Form Improvements ✅
- Language: Searchable dropdown with 15 languages
- Voice: Dropdown with HeyGen voices (name, language, gender)
- Avatar: Dropdown with HeyGen avatars (name, gender, preview image)
- Publishing Mode: dropdown (draft, scheduled, immediate)
- Schedule: Date picker + Time picker (AM/PM) - conditional on "scheduled"

#### Pipeline Visualization ✅
- 8-step pipeline: Evaluate → Script → Scenes → Video → Thumbnail → Metadata → Upload → Schedule
- Progress bar: `X of 8 steps completed (Y%)`
- Step cards with status icons
- Expandable details per step
- Regenerate buttons (explicit, not automatic)

#### Caching & Regeneration ✅
- Display "Loaded from cache" message
- Show "Regenerate" button for each cached step
- Regenerate sends `{regenerate: true}` in request

#### Analytics Dashboard ✅
- KPI cards: Views, Clicks, Shares, Watch Time, Published, Scheduled
- Line chart for views/clicks over time
- Time filter: Last 7 Days, Last 30 Days
- "Sample Data" label (mock analytics)

#### Thumbnail Generation ✅
- Generate button after metadata step
- Preview 3 aspect ratios (16:9, 9:16, 1:1)
- Radio selection
- Selected thumbnail highlighted
- Regenerate thumbnails button

#### Evaluation Display ✅
- Score badge with color (1-3 red, 4-5 orange, 6-7 yellow, 8-9 green, 10 gold)
- Opportunity/Competition/Audience Fit cards
- Strengths list with check icons
- Weaknesses list with alert icons
- Recommendations with "Why" and "Impact" explanations

#### Premium UI Polish ✅
- Modern card designs with shadows
- Better spacing and typography
- Smooth animations
- Status badges with colors
- Loading skeletons
- Mobile-responsive grid
- Toast notifications

#### Integrations Expansion ✅
- Coming Soon cards for: Instagram, Facebook, LinkedIn, X
- Disabled state with "Coming Soon" badge
- Future auto-posting mention

### Technical Implementation:

```jsx
// State Management
- activeTab (dashboard, projects, integrations, settings)
- projects list
- selectedProject
- showNewProjectModal
- showProjectDetailModal
- languages (fetched from /api/languages)
- voices (fetched from /api/heygen/voices)
- avatars (fetched from /api/heygen/avatars)
- analytics (fetched from /api/analytics)
- integrations

// API Calls
- fetch('/api/languages') - on mount
- fetch('/api/heygen/voices') - when HeyGen connected
- fetch('/api/heygen/avatars') - when HeyGen connected
- fetch('/api/analytics?timeframe=7d') - for dashboard
- POST /api/projects/:id/evaluate {regenerate: true} - for regeneration
- POST /api/projects/:id/generate-thumbnail - new endpoint
- POST /api/projects/:id/select-thumbnail {selected_thumbnail_url} - selection

// Components to Build
1. DashboardTab (analytics)
2. ProjectsTab (list)
3. NewProjectModal (improved form)
4. ProjectDetailModal (pipeline visualization)
5. IntegrationsTab (expanded)
6. SettingsTab
7. ProgressBar component
8. PipelineStep component
9. EvaluationDisplay component
10. ThumbnailSelector component
11. AnalyticsChart component
12. KPICard component
13. ComingSoonCard component
```

## Implementation Progress

- [x] Backend services enhanced
- [x] API routes rebuilt
- [x] Pipeline state management
- [ ] Frontend page.js rebuild (IN PROGRESS)
- [ ] Testing
- [ ] Documentation

## Next: Building Complete page.js Now
