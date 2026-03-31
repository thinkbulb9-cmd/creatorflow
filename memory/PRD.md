# CreatorFlow AI - Product Requirements Document

## Overview
CreatorFlow AI is a full-stack SaaS application that automates YouTube content creation through an AI-powered pipeline: Idea → Script → Scenes → Video → Metadata → Upload → Schedule.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Lucide icons
- **Backend**: Next.js API Routes (catch-all pattern)
- **Database**: MongoDB
- **Auth**: NextAuth.js v4 (Credentials + Google + GitHub OAuth)
- **AI**: OpenAI GPT-4o-mini (with mock fallback)
- **Video**: HeyGen API (with mock fallback)
- **Publishing**: YouTube Data API (with mock fallback)

## Features

### Authentication
- Email/password registration and login
- Google OAuth social login (placeholder credentials)
- GitHub OAuth social login (placeholder credentials)
- JWT-based sessions via NextAuth

### Dashboard
- Project statistics (Total, In Progress, Completed, Scheduled)
- Recent projects quick access
- New project creation shortcut

### Project Management
- Create projects with concept, duration, aspect ratio, language, style, publishing mode
- Auto-run pipeline option on creation
- Projects list with status badges and delete
- Scheduled projects filter view

### Pipeline System
- **Evaluate**: AI idea evaluation (score, feedback, suggestions, market potential)
- **Script**: AI script generation (hook, full script, CTA, word count)
- **Scenes**: AI scene breakdown (visual types, camera styles, backgrounds)
- **Video**: HeyGen avatar video generation with polling
- **Metadata**: AI metadata generation (title, description, tags, hashtags, thumbnail prompt)
- **Upload**: YouTube video upload
- **Schedule**: YouTube scheduling

### Integrations Management
- OpenAI API key storage with masking and test
- HeyGen API key storage with masking and test
- YouTube OAuth (Client ID + Secret) with Connect OAuth flow
- Per-user key storage in MongoDB
- Mock mode when not connected

### Mock Mode
- All services return realistic mock data when no API key is configured
- Full pipeline works end-to-end in mock mode
- Visual indicator ("Mock Mode" badge) on project detail

## API Routes
- POST /api/register - User registration
- GET/POST /api/projects - List/Create projects
- GET/DELETE /api/projects/:id - Get/Delete project
- POST /api/projects/:id/evaluate - Evaluate idea
- POST /api/projects/:id/generate-script - Generate script
- POST /api/projects/:id/generate-scenes - Generate scenes
- POST /api/projects/:id/generate-video - Generate video
- POST /api/projects/:id/generate-metadata - Generate metadata
- POST /api/projects/:id/publish-youtube - Upload to YouTube
- POST /api/projects/:id/schedule-youtube - Schedule on YouTube
- POST /api/projects/:id/run-pipeline - Run full pipeline
- GET/POST/DELETE /api/integrations - Integration management
- POST /api/integrations/test - Test integration
- GET /api/dashboard/stats - Dashboard stats
- GET /api/youtube/auth - YouTube OAuth URL
- GET /api/youtube/callback - YouTube OAuth callback
