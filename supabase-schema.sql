-- CreatorFlow AI - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  image TEXT,
  provider TEXT DEFAULT 'credentials',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==================== PROJECTS TABLE ====================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 60,
  aspect_ratio TEXT DEFAULT '16:9',
  language TEXT DEFAULT 'English',
  content_style TEXT DEFAULT 'professional',
  publishing_mode TEXT DEFAULT 'draft',
  schedule_date TEXT,
  schedule_time TEXT,
  selected_voice_id TEXT,
  selected_avatar_id TEXT,

  -- Cached pipeline results (stored as JSONB)
  idea_evaluation JSONB,
  script_data JSONB,
  scenes JSONB,
  thumbnail_data JSONB,
  metadata JSONB,

  -- Video status
  video_job_id TEXT,
  video_url TEXT,

  -- YouTube status
  youtube_video_id TEXT,
  youtube_url TEXT,

  -- Pipeline state
  pipeline_state JSONB DEFAULT '{}',
  pipeline_status TEXT,
  pipeline_started_at TIMESTAMPTZ,
  pipeline_completed_at TIMESTAMPTZ,
  pipeline_results JSONB,
  pipeline_error TEXT,

  -- Status
  status TEXT DEFAULT 'draft',
  error_message TEXT,
  provider_errors JSONB DEFAULT '[]',

  -- Upload/Schedule
  upload_status TEXT,
  upload_error TEXT,
  uploaded_at TIMESTAMPTZ,
  schedule_status TEXT,
  schedule_error TEXT,
  scheduled_at TIMESTAMPTZ,
  publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_video_job_id ON projects(video_job_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- ==================== INTEGRATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config_json JSONB DEFAULT '{}',
  is_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one integration per provider per user
  UNIQUE(user_id, provider)
);

-- Index for integration lookups
CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON integrations(user_id, provider);

-- ==================== ROW LEVEL SECURITY (optional but recommended) ====================
-- Uncomment the following if you want to enable RLS
-- Note: Since we use the service_role key server-side, RLS won't affect API calls
-- but it's good practice for direct client access

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid()::text = id::text);
-- CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid()::text = user_id::text);
-- CREATE POLICY "Users can manage own projects" ON projects FOR ALL USING (auth.uid()::text = user_id::text);
-- CREATE POLICY "Users can view own integrations" ON integrations FOR SELECT USING (auth.uid()::text = user_id::text);
-- CREATE POLICY "Users can manage own integrations" ON integrations FOR ALL USING (auth.uid()::text = user_id::text);
