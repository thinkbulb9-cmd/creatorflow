'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Video, Globe, Eye, EyeOff, Check, Loader2, Plus, Play, Trash2, Calendar, Clock, BarChart3, TrendingUp, Users, Share2, PlayCircle, CheckCircle2, AlertCircle, RefreshCw, Image as ImageIcon, Upload, Instagram, Facebook, Linkedin, Twitter, Award, Target, AlertTriangle, Lightbulb, ArrowRight, ArrowLeft, Settings, User, Music, Film, ExternalLink, CheckSquare, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function App() {
  const { data: session, status } = useSession();
  
  // Main navigation state
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'projects' | 'integrations' | 'create-project' | 'project-detail' | 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('7d');
  const [languages, setLanguages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [youtubeStatus, setYoutubeStatus] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  
  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Project creation states
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
    concept: '',
    duration_seconds: 60,
    aspect_ratio: '16:9',
    language: 'English',
    content_style: 'professional',
    publishing_mode: 'draft', // draft, scheduled, instant
    schedule_date: '',
    schedule_time: '',
    selected_voice_id: '',
    selected_avatar_id: ''
  });
  const [validationWarnings, setValidationWarnings] = useState([]);

  // Integration states
  const [keys, setKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [saving, setSaving] = useState(null);
  const [testing, setTesting] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [pollingVideo, setPollingVideo] = useState(null);

  // Fetch data on mount
  useEffect(() => {
    if (session) {
      fetchProjects();
      fetchIntegrations();
      fetchLanguages();
      fetchAnalytics(analyticsTimeframe);
      fetchYoutubeStatus();
      fetchUserSettings();
      
      // Check for YouTube OAuth callback
      const params = new URLSearchParams(window.location.search);
      const youtubeCallback = params.get('youtube_callback');
      const channel = params.get('channel');
      const message = params.get('message');
      
      if (youtubeCallback === 'success') {
        toast.success(channel ? `YouTube connected successfully! Channel: ${channel}` : 'YouTube connected successfully!');
        fetchYoutubeStatus(); // Refresh status
        fetchIntegrations(); // Refresh integrations
        // Clean up URL
        window.history.replaceState({}, '', '/');
      } else if (youtubeCallback === 'error') {
        toast.error(`YouTube connection failed: ${message || 'Unknown error'}`);
        // Clean up URL
        window.history.replaceState({}, '', '/');
      }
    }
  }, [session, analyticsTimeframe]);

  // Poll video status
  useEffect(() => {
    if (pollingVideo) {
      const interval = setInterval(() => {
        pollVideoStatus(pollingVideo);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [pollingVideo]);

  // Auto-refresh selected project
  useEffect(() => {
    if (selectedProject) {
      const interval = setInterval(() => {
        refreshProject(selectedProject._id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedProject]);

  // Validate avatar/voice selection
  useEffect(() => {
    if (projectForm.selected_avatar_id && projectForm.selected_voice_id && avatars.length > 0 && voices.length > 0) {
      const avatar = avatars.find(a => a.avatar_id === projectForm.selected_avatar_id);
      const voice = voices.find(v => v.voice_id === projectForm.selected_voice_id);
      
      if (avatar && voice) {
        const warnings = [];
        if (avatar.gender && voice.gender && avatar.gender.toLowerCase() !== voice.gender.toLowerCase()) {
          warnings.push({
            type: 'gender_mismatch',
            message: `Avatar gender (${avatar.gender}) doesn't match voice gender (${voice.gender}). This may affect video quality.`
          });
        }
        setValidationWarnings(warnings);
      }
    } else {
      setValidationWarnings([]);
    }
  }, [projectForm.selected_avatar_id, projectForm.selected_voice_id, avatars, voices]);

  const api = async (endpoint, options = {}) => {
    const res = await fetch(`/api/${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    const data = await res.json();
    if (!data.success && data.message) toast.error(data.message);
    return data;
  };

  const fetchProjects = async () => {
    const data = await api('projects');
    if (data.success) setProjects(data.projects || []);
  };

  const fetchIntegrations = async () => {
    const data = await api('integrations');
    if (data.success) {
      setIntegrations(data.integrations || []);
      const heygen = data.integrations?.find(i => i.provider === 'heygen' && i.is_connected);
      if (heygen) {
        fetchVoices();
        fetchAvatars();
      }
    }
  };

  const fetchLanguages = async () => {
    const data = await api('languages');
    if (data.success) setLanguages(data.languages || []);
  };

  const fetchVoices = async () => {
    const data = await api('heygen/voices');
    if (data.success) setVoices(data.voices || []);
  };

  const fetchAvatars = async () => {
    const data = await api('heygen/avatars');
    if (data.success) setAvatars(data.avatars || []);
  };

  const fetchAnalytics = async (timeframe) => {
    const data = await api(`analytics?timeframe=${timeframe}`);
    if (data.success) setAnalytics(data.analytics);
  };

  const fetchYoutubeStatus = async () => {
    const data = await api('youtube/connection-status');
    if (data.success) setYoutubeStatus(data);
  };

  const fetchUserSettings = async () => {
    const data = await api('settings');
    if (data.success) setUserSettings(data.settings);
  };

  const refreshProject = async (id) => {
    const data = await api(`projects/${id}`);
    if (data.success) {
      setSelectedProject(data.project);
      setProjects(prev => prev.map(p => p._id === id ? data.project : p));
    }
  };

  const pollVideoStatus = async (jobId) => {
    const data = await api(`video-jobs/${jobId}/poll`);
    if (data.success && data.status === 'completed') {
      setPollingVideo(null);
      if (selectedProject) refreshProject(selectedProject._id);
      toast.success('Video generation completed!');
    }
  };

  const createProject = async () => {
    // Validate scheduled mode requirements
    if (projectForm.publishing_mode === 'scheduled') {
      if (!projectForm.schedule_date || !projectForm.schedule_time) {
        toast.error('Please select date and time for scheduled publishing');
        return;
      }
      
      const scheduleDateTime = new Date(`${projectForm.schedule_date}T${projectForm.schedule_time}`);
      if (scheduleDateTime <= new Date()) {
        toast.error('Schedule time must be in the future');
        return;
      }
    }
    
    setLoading(true);
    const data = await api('projects', { method: 'POST', body: JSON.stringify(projectForm) });
    if (data.success) {
      toast.success('Project created successfully!');
      setActiveView('projects');
      setProjectForm({
        concept: '',
        duration_seconds: 60,
        aspect_ratio: '16:9',
        language: 'English',
        content_style: 'professional',
        publishing_mode: 'draft',
        schedule_date: '',
        schedule_time: '',
        selected_voice_id: '',
        selected_avatar_id: ''
      });
      setValidationWarnings([]);
      fetchProjects();
    }
    setLoading(false);
  };

  const runPipelineStep = async (projectId, step, regenerate = false) => {
    setLoading(true);
    const data = await api(`projects/${projectId}/${step}`, {
      method: 'POST',
      body: JSON.stringify({ regenerate })
    });
    
    if (data.success) {
      if (data.cached) {
        toast.info(data.message || 'Loaded from cache');
      } else {
        toast.success(`${step.replace(/-/g, ' ')} completed!`);
      }
      
      if (step === 'generate-video' && data.job_id) {
        setPollingVideo(data.job_id);
      }
      
      refreshProject(projectId);
    }
    setLoading(false);
  };

  const selectThumbnail = async (projectId, thumbnailUrl) => {
    const data = await api(`projects/${projectId}/select-thumbnail`, {
      method: 'POST',
      body: JSON.stringify({ selected_thumbnail_url: thumbnailUrl })
    });
    if (data.success) {
      toast.success(data.message || 'Thumbnail selected! Pipeline advanced to Metadata step.');
      // Refresh project to get updated pipeline state
      await refreshProject(projectId);
      
      // Log progress update
      if (data.progress) {
        console.log('[Pipeline] Progress updated:', data.progress);
      }
      if (data.current_step) {
        console.log('[Pipeline] Current active step:', data.current_step.name);
      }
    }
  };

  const deleteProject = async (id) => {
    if (!confirm('Delete this project? This action cannot be undone.')) return;
    const data = await api(`projects/${id}`, { method: 'DELETE' });
    if (data.success) {
      toast.success('Project deleted');
      fetchProjects();
      if (selectedProject?._id === id) {
        setSelectedProject(null);
        setActiveView('projects');
      }
    }
  };

  const handleSaveIntegration = async (provider, config) => {
    setSaving(provider);
    const data = await api('integrations', {
      method: 'POST',
      body: JSON.stringify({ provider, config_json: config })
    });
    if (data.success) {
      toast.success(data.message || 'Integration saved!');
      fetchIntegrations();
      if (provider === 'youtube') fetchYoutubeStatus();
    }
    setSaving(null);
  };

  const handleTestIntegration = async (provider) => {
    setTesting(provider);
    const data = await api('integrations/test', {
      method: 'POST',
      body: JSON.stringify({ provider })
    });
    if (data.success) {
      toast[data.connected ? 'success' : 'error'](data.message);
    }
    setTesting(null);
  };

  const handleYoutubeAuth = async () => {
    const data = await api('youtube/auth');
    if (data.success && data.auth_url) {
      window.location.href = data.auth_url;
    }
  };

  const saveUserSettings = async (newSettings) => {
    const data = await api('settings', {
      method: 'POST',
      body: JSON.stringify({ settings: newSettings })
    });
    if (data.success) {
      toast.success('Settings saved!');
      setUserSettings(newSettings);
    }
  };

  // Calculate progress with strict dependencies
  const calculateProgress = (project) => {
    if (!project?.pipeline_state) return { completed: 0, total: 8, percentage: 0 };
    
    const stepOrder = ['evaluate', 'script', 'scenes', 'video', 'thumbnail', 'metadata', 'upload', 'schedule'];
    let completed = 0;
    
    for (const step of stepOrder) {
      if (project.pipeline_state[step]?.status === 'completed') {
        completed++;
      } else {
        break; // Strict sequential progression
      }
    }
    
    const percentage = Math.round((completed / stepOrder.length) * 100);
    return { completed, total: stepOrder.length, percentage };
  };

  // Get current step info
  const getCurrentStep = (project) => {
    if (!project?.pipeline_state) return { name: 'Not Started', status: 'pending', key: null };
    
    const stepOrder = ['evaluate', 'script', 'scenes', 'video', 'thumbnail', 'metadata', 'upload', 'schedule'];
    const stepNames = {
      'evaluate': 'Idea Evaluation',
      'script': 'Script Generation',
      'scenes': 'Scene Creation',
      'video': 'Video Generation',
      'thumbnail': 'Thumbnail Creation',
      'metadata': 'Metadata Generation',
      'upload': 'YouTube Upload',
      'schedule': 'Schedule Publishing'
    };
    
    for (const stepKey of stepOrder) {
      const step = project.pipeline_state[stepKey];
      if (!step || step.status !== 'completed') {
        return {
          key: stepKey,
          name: stepNames[stepKey],
          status: step?.status || 'pending'
        };
      }
    }
    return { name: 'Completed', status: 'completed', key: null };
  };

  const getScoreColor = (score) => {
    if (score >= 9) return 'text-yellow-500';
    if (score >= 7) return 'text-green-500';
    if (score >= 5) return 'text-orange-500';
    return 'text-red-500';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    
    const result = await signIn('credentials', {
      email: loginEmail,
      password: loginPassword,
      redirect: false
    });
    
    if (result?.error) {
      setLoginError('Invalid email or password');
      setLoginLoading(false);
    } else {
      window.location.href = '/';
    }
  };

  // Auth check
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">CreatorFlow AI</CardTitle>
                <CardDescription>Automate your YouTube content pipeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label className="text-white">Email</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              {loginError && (
                <div className="text-sm text-red-400 bg-red-950/20 border border-red-900 rounded p-2">
                  {loginError}
                </div>
              )}
              <Button 
                type="submit" 
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {loginLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
              <div className="text-center text-sm text-slate-400">
                Test credentials: testuser@creatorflow.ai / TestPassword123!
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main App Layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Global Progress Bar for Selected Project */}
      {selectedProject && activeView === 'project-detail' && (
        <GlobalProgressBar project={selectedProject} />
      )}

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('dashboard')}>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">CreatorFlow AI</h1>
                <p className="text-xs text-slate-400">Automate YouTube content</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => setActiveView('settings')} 
                variant="ghost" 
                size="sm" 
                className="hidden sm:flex items-center gap-2 text-slate-400 hover:text-white"
              >
                <User className="h-4 w-4" />
                <span className="text-sm">{session.user.email}</span>
              </Button>
              <Button onClick={() => signOut()} variant="outline" size="sm" className="border-slate-700">
                Sign Out
              </Button>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              onClick={() => setActiveView('dashboard')}
              variant={activeView === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              className={activeView === 'dashboard' ? 'bg-violet-600 hover:bg-violet-700' : 'text-slate-400 hover:text-white'}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              onClick={() => setActiveView('projects')}
              variant={(activeView === 'projects' || activeView === 'create-project' || activeView === 'project-detail') ? 'default' : 'ghost'}
              size="sm"
              className={(activeView === 'projects' || activeView === 'create-project' || activeView === 'project-detail') ? 'bg-violet-600 hover:bg-violet-700' : 'text-slate-400 hover:text-white'}
            >
              <Video className="h-4 w-4 mr-2" />
              Projects
            </Button>
            <Button
              onClick={() => setActiveView('integrations')}
              variant={activeView === 'integrations' ? 'default' : 'ghost'}
              size="sm"
              className={activeView === 'integrations' ? 'bg-violet-600 hover:bg-violet-700' : 'text-slate-400 hover:text-white'}
            >
              <Globe className="h-4 w-4 mr-2" />
              Integrations
            </Button>
            <Button
              onClick={() => setActiveView('settings')}
              variant={activeView === 'settings' ? 'default' : 'ghost'}
              size="sm"
              className={activeView === 'settings' ? 'bg-violet-600 hover:bg-violet-700' : 'text-slate-400 hover:text-white'}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Router */}
      <div className="container mx-auto px-4 py-6">
        {activeView === 'dashboard' && (
          <DashboardView 
            analytics={analytics}
            analyticsTimeframe={analyticsTimeframe}
            setAnalyticsTimeframe={setAnalyticsTimeframe}
            projects={projects}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'projects' && (
          <ProjectsView 
            projects={projects}
            onCreateNew={() => setActiveView('create-project')}
            onSelectProject={(proj) => {
              setSelectedProject(proj);
              setActiveView('project-detail');
            }}
            calculateProgress={calculateProgress}
            getCurrentStep={getCurrentStep}
          />
        )}

        {activeView === 'integrations' && (
          <IntegrationsView 
            integrations={integrations}
            youtubeStatus={youtubeStatus}
            keys={keys}
            setKeys={setKeys}
            showKeys={showKeys}
            setShowKeys={setShowKeys}
            saving={saving}
            testing={testing}
            avatars={avatars}
            onSaveIntegration={handleSaveIntegration}
            onTestIntegration={handleTestIntegration}
            onYoutubeAuth={handleYoutubeAuth}
          />
        )}

        {activeView === 'create-project' && (
          <CreateProjectView 
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            languages={languages}
            voices={voices}
            avatars={avatars}
            validationWarnings={validationWarnings}
            loading={loading}
            onCancel={() => setActiveView('projects')}
            onCreate={createProject}
          />
        )}

        {activeView === 'project-detail' && selectedProject && (
          <ProjectDetailView 
            project={selectedProject}
            onBack={() => {
              setSelectedProject(null);
              setActiveView('projects');
            }}
            onDelete={deleteProject}
            onRunStep={runPipelineStep}
            onSelectThumbnail={selectThumbnail}
            loading={loading}
            pollingVideo={pollingVideo}
            youtubeStatus={youtubeStatus}
            calculateProgress={calculateProgress}
            getCurrentStep={getCurrentStep}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView 
            user={session.user}
            settings={userSettings}
            onBack={() => setActiveView('dashboard')}
            onSave={saveUserSettings}
          />
        )}
      </div>

    </div>
  );
}

// ==================== GLOBAL PROGRESS BAR ====================
function GlobalProgressBar({ project }) {
  const stepOrder = ['evaluate', 'script', 'scenes', 'video', 'thumbnail', 'metadata', 'upload', 'schedule'];
  const stepNames = ['Evaluate', 'Script', 'Scenes', 'Video', 'Thumbnail', 'Metadata', 'Upload', 'Schedule'];
  
  let completedSteps = 0;
  for (const step of stepOrder) {
    if (project.pipeline_state?.[step]?.status === 'completed') {
      completedSteps++;
    } else {
      break;
    }
  }
  
  const percentage = Math.round((completedSteps / stepOrder.length) * 100);
  
  return (
    <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-300">Pipeline Progress</span>
              <span className="text-xs font-bold text-violet-400">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
          <div className="hidden md:flex items-center gap-2">
            {stepOrder.map((step, idx) => {
              const status = project.pipeline_state?.[step]?.status || 'pending';
              return (
                <div key={step} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    status === 'completed' ? 'bg-green-600 text-white' :
                    status === 'running' ? 'bg-blue-600 text-white animate-pulse' :
                    status === 'failed' ? 'bg-red-600 text-white' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {status === 'completed' ? <Check className="h-3 w-3" /> : idx + 1}
                  </div>
                  {idx < stepOrder.length - 1 && (
                    <div className={`w-4 h-0.5 ${status === 'completed' ? 'bg-green-600' : 'bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== DASHBOARD VIEW ====================
function DashboardView({ analytics, analyticsTimeframe, setAnalyticsTimeframe, projects, onNavigate }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
          <p className="text-slate-400 text-sm">Track your content performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={analyticsTimeframe} onValueChange={setAnalyticsTimeframe}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => onNavigate('projects')} className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {analytics && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Views</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-violet-500" />
                  <span className="text-2xl font-bold text-white">{analytics.views?.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Clicks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-white">{analytics.clicks?.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Shares</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-white">{analytics.shares?.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Watch Time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-2xl font-bold text-white">{Math.floor(analytics.watch_time / 3600)}h</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Published</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-white">{analytics.published_videos}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Scheduled</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold text-white">{analytics.scheduled_videos}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Performance Trend
                {analytics.is_mock && (
                  <Badge variant="secondary" className="text-xs">Sample Data</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.chart_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} />
                  <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Projects Quick View */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projects.slice(0, 5).map(proj => (
                  <div key={proj._id} className="flex items-center justify-between p-2 rounded hover:bg-slate-700/50 cursor-pointer" onClick={() => onNavigate('project-detail')}>
                    <div className="flex-1">
                      <div className="text-sm text-white font-medium line-clamp-1">{proj.concept}</div>
                      <div className="text-xs text-slate-400">{new Date(proj.created_at).toLocaleDateString()}</div>
                    </div>
                    <Badge variant="secondary">{proj.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ==================== PROJECTS VIEW ====================
function ProjectsView({ projects, onCreateNew, onSelectProject, calculateProgress, getCurrentStep }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-slate-400 text-sm">Manage your content projects</p>
        </div>
        <Button
          onClick={onCreateNew}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const progress = calculateProgress(project);
          const currentStep = getCurrentStep(project);

          return (
            <Card
              key={project._id}
              className="bg-slate-800/50 border-slate-700 hover:border-violet-500 transition-all cursor-pointer group"
              onClick={() => onSelectProject(project)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg line-clamp-2 group-hover:text-violet-400 transition-colors">
                      {project.concept}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {project.aspect_ratio} • {project.duration_seconds}s • {project.language}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={currentStep.status === 'completed' ? 'default' : currentStep.status === 'failed' ? 'destructive' : 'secondary'} className="ml-2">
                    {currentStep.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>{progress.completed} of {progress.total} steps</span>
                    <span className="font-bold text-violet-400">{progress.percentage}%</span>
                  </div>
                  <Progress value={progress.percentage} className="h-2" />
                </div>
                <div className="text-xs text-slate-400">
                  Current: {currentStep.name}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 mb-4">No projects yet. Create your first project!</p>
            <Button onClick={onCreateNew} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== INTEGRATIONS VIEW ====================
function IntegrationsView({ integrations, youtubeStatus, keys, setKeys, showKeys, setShowKeys, saving, testing, avatars, onSaveIntegration, onTestIntegration, onYoutubeAuth }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Integrations</h2>
        <p className="text-slate-400 text-sm">Connect your services to enable AI-powered content generation</p>
      </div>

      {/* Setup Checklist */}
      <SetupChecklist integrations={integrations} youtubeStatus={youtubeStatus} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* OpenAI */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white">OpenAI</CardTitle>
                <CardDescription className="text-xs">AI idea evaluation, script, scenes, and metadata</CardDescription>
              </div>
              <Badge variant={integrations.find(i => i.provider === 'openai')?.is_connected ? 'default' : 'secondary'}>
                {integrations.find(i => i.provider === 'openai')?.is_connected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">API Key</Label>
              <div className="relative">
                <Input
                  type={showKeys.openai ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={keys.openai || ''}
                  onChange={e => setKeys(p => ({ ...p, openai: e.target.value }))}
                  className="pr-10 bg-slate-900 border-slate-700"
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  onClick={() => setShowKeys(p => ({ ...p, openai: !p.openai }))}
                >
                  {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onSaveIntegration('openai', { api_key: keys.openai })}
                disabled={!keys.openai || saving === 'openai'}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                {saving === 'openai' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTestIntegration('openai')}
                disabled={testing === 'openai'}
                className="border-slate-700"
              >
                {testing === 'openai' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* HeyGen */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <Video className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white">HeyGen</CardTitle>
                <CardDescription className="text-xs">AI avatar video generation from scripts</CardDescription>
              </div>
              <Badge variant={integrations.find(i => i.provider === 'heygen')?.is_connected ? 'default' : 'secondary'}>
                {integrations.find(i => i.provider === 'heygen')?.is_connected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">API Key</Label>
              <div className="relative">
                <Input
                  type={showKeys.heygen ? 'text' : 'password'}
                  placeholder="Your HeyGen API key"
                  value={keys.heygen || ''}
                  onChange={e => setKeys(p => ({ ...p, heygen: e.target.value }))}
                  className="pr-10 bg-slate-900 border-slate-700"
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  onClick={() => setShowKeys(p => ({ ...p, heygen: !p.heygen }))}
                >
                  {showKeys.heygen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {avatars.length > 0 && (
              <div>
                <Label className="text-xs text-slate-400">Selected Avatar</Label>
                <div className="text-sm text-slate-300">
                  {avatars.find(a => a.avatar_id === integrations.find(i => i.provider === 'heygen')?.config_json?.avatar_id)?.avatar_name || 'Auto-detected'}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onSaveIntegration('heygen', { api_key: keys.heygen })}
                disabled={!keys.heygen || saving === 'heygen'}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                {saving === 'heygen' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTestIntegration('heygen')}
                disabled={testing === 'heygen'}
                className="border-slate-700"
              >
                {testing === 'heygen' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* YouTube */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white">YouTube</CardTitle>
                <CardDescription className="text-xs">Upload videos and schedule publishing</CardDescription>
              </div>
              <Badge variant={youtubeStatus?.has_access_token ? 'default' : 'secondary'}>
                {youtubeStatus?.has_access_token ? 'Connected' : youtubeStatus?.has_credentials ? 'Credentials Saved' : 'Not Connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {youtubeStatus?.requires_oauth && (
              <div className="bg-orange-950/20 border border-orange-900 rounded p-2 text-xs text-orange-400">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                OAuth required - Click "Connect" below
              </div>
            )}
            {youtubeStatus?.channel_info && (
              <div className="text-xs text-slate-300">
                <div className="font-semibold">Connected Channel:</div>
                <div>{youtubeStatus.channel_info.title}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Client ID</Label>
                <Input
                  placeholder="Google OAuth Client ID"
                  value={keys.yt_client_id || ''}
                  onChange={e => setKeys(p => ({ ...p, yt_client_id: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Client Secret</Label>
                <Input
                  type="password"
                  placeholder="Client Secret"
                  value={keys.yt_client_secret || ''}
                  onChange={e => setKeys(p => ({ ...p, yt_client_secret: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onSaveIntegration('youtube', { client_id: keys.yt_client_id, client_secret: keys.yt_client_secret })}
                disabled={!keys.yt_client_id || saving === 'youtube'}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                {saving === 'youtube' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Save
              </Button>
              {youtubeStatus?.requires_oauth && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onYoutubeAuth}
                  className="border-slate-700"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Connect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon - Instagram */}
        <Card className="bg-slate-800/30 border-slate-700 opacity-60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white">Instagram</CardTitle>
                <CardDescription className="text-xs">Auto-post reels and stories</CardDescription>
              </div>
              <Badge variant="outline" className="border-slate-600">Coming Soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Future support for automatic Instagram posting</p>
          </CardContent>
        </Card>

        {/* Coming Soon - TikTok */}
        <Card className="bg-slate-800/30 border-slate-700 opacity-60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center">
                <Music className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white">TikTok</CardTitle>
                <CardDescription className="text-xs">Auto-upload short-form videos</CardDescription>
              </div>
              <Badge variant="outline" className="border-slate-600">Coming Soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Future support for TikTok video publishing</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== SETUP CHECKLIST ====================
function SetupChecklist({ integrations, youtubeStatus }) {
  const checks = [
    {
      name: 'OpenAI API Key',
      status: integrations.find(i => i.provider === 'openai')?.is_connected,
      required: 'Required for AI idea evaluation, script generation, scenes, and metadata'
    },
    {
      name: 'HeyGen API Key',
      status: integrations.find(i => i.provider === 'heygen')?.is_connected,
      required: 'Required for avatar video generation'
    },
    {
      name: 'YouTube OAuth',
      status: youtubeStatus?.connected && youtubeStatus?.has_access_token,
      required: 'Required for uploading and scheduling videos to YouTube'
    }
  ];

  const allComplete = checks.every(c => c.status);

  return (
    <Card className={`border-2 ${allComplete ? 'border-green-600 bg-green-950/20' : 'border-orange-600 bg-orange-950/20'}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Setup Checklist for End-to-End Testing
        </CardTitle>
        <CardDescription>
          {allComplete ? 'All integrations configured! Ready for full pipeline testing.' : 'Complete these integrations to enable full pipeline functionality.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded bg-slate-800/50">
              {check.status ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{check.name}</div>
                <div className="text-xs text-slate-400">{check.required}</div>
              </div>
              <Badge variant={check.status ? 'default' : 'secondary'}>
                {check.status ? 'Ready' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== CREATE PROJECT VIEW ====================
function CreateProjectView({ projectForm, setProjectForm, languages, voices, avatars, validationWarnings, loading, onCancel, onCreate }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Create New Project</h2>
          <p className="text-slate-400 text-sm">Configure your AI-powered content project</p>
        </div>
        <Button variant="ghost" onClick={onCancel} className="text-slate-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6 space-y-6">
          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <div className="bg-orange-950/20 border border-orange-900 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-orange-400 font-semibold">
                <AlertTriangle className="h-5 w-5" />
                Validation Warnings
              </div>
              {validationWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-orange-300 pl-7">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          <div>
            <Label className="text-white">Video Concept *</Label>
            <Input
              placeholder="e.g., 5 productivity tips for remote workers"
              value={projectForm.concept}
              onChange={e => setProjectForm(p => ({ ...p, concept: e.target.value }))}
              className="bg-slate-900 border-slate-700 text-white mt-2"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Duration</Label>
              <Select value={String(projectForm.duration_seconds)} onValueChange={v => setProjectForm(p => ({ ...p, duration_seconds: parseInt(v) }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="480">8 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white">Aspect Ratio</Label>
              <Select value={projectForm.aspect_ratio} onValueChange={v => setProjectForm(p => ({ ...p, aspect_ratio: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Landscape - YouTube)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait - TikTok/Reels)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square - Instagram)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Language</Label>
              <Select value={projectForm.language} onValueChange={v => setProjectForm(p => ({ ...p, language: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(lang => (
                    <SelectItem key={lang.code} value={lang.name}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white">Content Style</Label>
              <Select value={projectForm.content_style} onValueChange={v => setProjectForm(p => ({ ...p, content_style: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual & Friendly</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="entertaining">Entertaining</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {voices.length > 0 && (
            <div>
              <Label className="text-white">Voice (Optional)</Label>
              <Select value={projectForm.selected_voice_id || 'auto'} onValueChange={v => setProjectForm(p => ({ ...p, selected_voice_id: v === 'auto' ? '' : v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                  <SelectValue placeholder="Auto-select from language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select from language</SelectItem>
                  {voices.map(voice => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      {voice.voice_name} ({voice.language}, {voice.gender})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {avatars.length > 0 && (
            <div>
              <Label className="text-white">Avatar (Optional)</Label>
              <Select value={projectForm.selected_avatar_id || 'auto'} onValueChange={v => setProjectForm(p => ({ ...p, selected_avatar_id: v === 'auto' ? '' : v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                  <SelectValue placeholder="Auto-select first available" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select first available</SelectItem>
                  {avatars.map(avatar => (
                    <SelectItem key={avatar.avatar_id} value={avatar.avatar_id}>
                      {avatar.avatar_name} ({avatar.gender})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-white">Publishing Mode *</Label>
            <Select value={projectForm.publishing_mode} onValueChange={v => setProjectForm(p => ({ ...p, publishing_mode: v }))}>
              <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (No publishing)</SelectItem>
                <SelectItem value="scheduled">Scheduled (Choose date & time)</SelectItem>
                <SelectItem value="instant">Instant Publish (Publish immediately)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">
              {projectForm.publishing_mode === 'draft' && 'Content will be generated but not published'}
              {projectForm.publishing_mode === 'scheduled' && 'Video will be uploaded and published at your chosen time'}
              {projectForm.publishing_mode === 'instant' && 'Video will be uploaded and published immediately'}
            </p>
          </div>

          {projectForm.publishing_mode === 'scheduled' && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-400" />
                Schedule Publishing Date & Time
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Date *</Label>
                  <Input
                    type="date"
                    value={projectForm.schedule_date}
                    onChange={e => setProjectForm(p => ({ ...p, schedule_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    required={projectForm.publishing_mode === 'scheduled'}
                    className="bg-slate-900 border-slate-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label className="text-white">Time *</Label>
                  <Input
                    type="time"
                    value={projectForm.schedule_time}
                    onChange={e => setProjectForm(p => ({ ...p, schedule_time: e.target.value }))}
                    required={projectForm.publishing_mode === 'scheduled'}
                    className="bg-slate-900 border-slate-700 text-white mt-2"
                  />
                </div>
              </div>
              {projectForm.schedule_date && projectForm.schedule_time && (
                <div className="text-xs text-slate-400">
                  Video will be published on: {new Date(`${projectForm.schedule_date}T${projectForm.schedule_time}`).toLocaleString()}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onCreate}
              disabled={!projectForm.concept || loading}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Project
            </Button>
            <Button variant="outline" onClick={onCancel} className="border-slate-700">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== PROJECT DETAIL VIEW ====================
function ProjectDetailView({ project, onBack, onDelete, onRunStep, onSelectThumbnail, loading, pollingVideo, youtubeStatus, calculateProgress, getCurrentStep }) {
  const progress = calculateProgress(project);
  const currentStep = getCurrentStep(project);

  const pipelineSteps = [
    { key: 'evaluate', name: 'Idea Evaluation', endpoint: 'evaluate', icon: Award, data: project.idea_evaluation, alwaysShow: true },
    { key: 'script', name: 'Script Generation', endpoint: 'generate-script', icon: Sparkles, data: project.script_data, alwaysShow: true },
    { key: 'scenes', name: 'Scene Creation', endpoint: 'generate-scenes', icon: Video, data: project.scenes, alwaysShow: true },
    { key: 'video', name: 'Video Generation', endpoint: 'generate-video', icon: PlayCircle, data: project.video_url, alwaysShow: true },
    { key: 'thumbnail', name: 'Thumbnail', endpoint: 'generate-thumbnail', icon: ImageIcon, data: project.thumbnail_data, alwaysShow: true },
    { key: 'metadata', name: 'Metadata', endpoint: 'generate-metadata', icon: Globe, data: project.metadata, alwaysShow: true },
    { 
      key: 'upload', 
      name: project.publishing_mode === 'draft' ? 'Upload (Optional)' : 'Upload to YouTube', 
      endpoint: 'publish-youtube', 
      icon: Upload, 
      data: project.youtube_video_id,
      showFor: ['scheduled', 'instant'] // Only show for scheduled and instant modes
    },
    { 
      key: 'schedule', 
      name: 'Schedule Publishing', 
      endpoint: 'schedule-youtube', 
      icon: Calendar, 
      data: project.status === 'scheduled',
      showFor: ['scheduled'] // Only show for scheduled mode
    }
  ];

  const getStepStatus = (stepKey) => {
    return project.pipeline_state?.[stepKey]?.status || 'pending';
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === 'running') return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    if (status === 'failed') return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <div className="h-5 w-5 rounded-full border-2 border-slate-600" />;
  };

  const getScoreColor = (score) => {
    if (score >= 9) return 'text-yellow-500';
    if (score >= 7) return 'text-green-500';
    if (score >= 5) return 'text-orange-500';
    return 'text-red-500';
  };

  // Filter steps based on publishing mode
  const visibleSteps = pipelineSteps.filter(step => {
    if (step.alwaysShow) return true;
    if (!step.showFor) return true;
    return step.showFor.includes(project.publishing_mode);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Button variant="ghost" onClick={onBack} className="text-slate-400 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <h2 className="text-2xl font-bold text-white">{project.concept}</h2>
          <p className="text-slate-400 text-sm">
            {project.aspect_ratio} • {project.duration_seconds}s • {project.language} • {project.content_style}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {new Date(project.created_at).toLocaleString()}
            </div>
            {project.updated_at && (
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Updated {new Date(project.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(project._id)}
          className="text-red-400 hover:text-red-300 hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-4">
        {visibleSteps.map((step, index) => {
          const status = getStepStatus(step.key);
          const StepIcon = step.icon;
          const isLocked = index > 0 && getStepStatus(visibleSteps[index - 1].key) !== 'completed';
          
          // Special lock for upload/schedule if YouTube not connected
          const isYoutubeStep = step.key === 'upload' || step.key === 'schedule';
          const youtubeNotReady = isYoutubeStep && (!youtubeStatus?.connected || !youtubeStatus?.has_access_token);
          
          // For upload step, show real data or blocked state
          const showUploadBlock = step.key === 'upload' && youtubeNotReady;
          const showMockWarning = step.key === 'upload' && status === 'completed' && project.youtube_video_id && project.youtube_video_id.startsWith('mock_');

          return (
            <Card key={step.key} className={`bg-slate-800/50 border-slate-700 ${(isLocked || youtubeNotReady) ? 'opacity-50' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {getStatusIcon(status)}
                  <StepIcon className="h-5 w-5 text-violet-400" />
                  <div className="flex-1">
                    <CardTitle className="text-base text-white">{step.name}</CardTitle>
                    <CardDescription className="text-xs capitalize">{status}</CardDescription>
                  </div>
                  {youtubeNotReady && (
                    <Badge variant="destructive" className="text-xs">
                      YouTube Not Connected
                    </Badge>
                  )}
                  {!isLocked && !youtubeNotReady && status !== 'running' && (
                    <div className="flex gap-2">
                      {step.data && status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRunStep(project._id, step.endpoint, true)}
                          disabled={loading}
                          className="border-slate-600"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Regenerate
                        </Button>
                      )}
                      {(!step.data || status === 'failed') && (
                        <Button
                          size="sm"
                          onClick={() => onRunStep(project._id, step.endpoint, false)}
                          disabled={loading || isLocked}
                          className="bg-violet-600 hover:bg-violet-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {status === 'failed' ? 'Retry' : 'Run'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Step Content */}
              {step.data && status === 'completed' && (
                <CardContent className="space-y-3">
                  {/* Evaluation Display */}
                  {step.key === 'evaluate' && step.data && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className={`text-4xl font-bold ${getScoreColor(step.data.score)}`}>
                          {step.data.score}/10
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex gap-2 flex-wrap">
                            {step.data.opportunity_level && (
                              <Badge variant="secondary">Opportunity: {step.data.opportunity_level}</Badge>
                            )}
                            {step.data.competition_level && (
                              <Badge variant="secondary">Competition: {step.data.competition_level}</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {step.data.strengths && step.data.strengths.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Strengths
                          </h4>
                          <ul className="space-y-1">
                            {step.data.strengths.map((strength, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-green-500">•</span>
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {step.data.weaknesses && step.data.weaknesses.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Weaknesses
                          </h4>
                          <ul className="space-y-1">
                            {step.data.weaknesses.map((weakness, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-orange-500">•</span>
                                {weakness}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {step.data.recommendations && step.data.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-violet-400 mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" /> Recommendations
                          </h4>
                          <div className="space-y-2">
                            {step.data.recommendations.map((rec, i) => (
                              <div key={i} className="bg-slate-900/50 p-3 rounded-lg">
                                <div className="text-sm text-slate-200 font-medium">{rec.text}</div>
                                {rec.why && <div className="text-xs text-slate-400 mt-1">Why: {rec.why}</div>}
                                {rec.impact && <div className="text-xs text-violet-400 mt-1">Impact: {rec.impact}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Script Display */}
                  {step.key === 'script' && step.data && (
                    <div className="space-y-2">
                      <div className="bg-slate-900/50 p-3 rounded text-sm text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {step.data.full_script}
                      </div>
                      <div className="text-xs text-slate-500">{step.data.word_count} words</div>
                    </div>
                  )}

                  {/* Scenes Display */}
                  {step.key === 'scenes' && step.data && (
                    <div className="space-y-2">
                      {(Array.isArray(step.data) ? step.data : step.data.scenes || []).slice(0, 5).map((scene, i) => (
                        <div key={i} className="bg-slate-900/50 p-3 rounded space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-violet-400">Scene {scene.scene_number}</div>
                            <Badge variant="secondary" className="text-xs">{scene.duration_sec}s</Badge>
                          </div>
                          <div className="text-sm text-slate-300">{scene.speaker_text}</div>
                          {scene.b_roll_suggestion && (
                            <div className="flex items-start gap-2 text-xs text-slate-400">
                              <Film className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>B-Roll: {scene.b_roll_suggestion}</span>
                            </div>
                          )}
                          {scene.music_mood && (
                            <div className="flex items-start gap-2 text-xs text-slate-400">
                              <Music className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>Music: {scene.music_mood}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="text-xs text-slate-500">{(Array.isArray(step.data) ? step.data : step.data.scenes || []).length} scenes total</div>
                    </div>
                  )}

                  {/* Video Display */}
                  {step.key === 'video' && step.data && (
                    <div className="space-y-2">
                      <video src={step.data} controls className="w-full rounded-lg max-h-96" />
                      {pollingVideo === project.video_job_id && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking video status...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Thumbnail Display */}
                  {step.key === 'thumbnail' && step.data?.images && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400">Select a thumbnail (3 aspect ratios available):</div>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(step.data.images).map(([ratio, url]) => (
                          <div
                            key={ratio}
                            className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              step.data.selected === url ? 'border-violet-500 ring-2 ring-violet-500' : 'border-slate-700 hover:border-slate-600'
                            }`}
                            onClick={() => onSelectThumbnail(project._id, url)}
                          >
                            <img src={url} alt={ratio} className="w-full h-auto" />
                            <div className="bg-slate-900/80 p-2 text-xs text-center text-white font-medium">
                              {ratio}
                              {step.data.selected === url && <Check className="h-3 w-3 inline ml-1 text-violet-400" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata Display */}
                  {step.key === 'metadata' && step.data && (
                    <div className="space-y-2">
                      <div className="font-semibold text-violet-400">{step.data.title}</div>
                      <div className="text-xs text-slate-400 max-h-20 overflow-y-auto">
                        {step.data.description?.substring(0, 300)}...
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {(step.data.tags || []).slice(0, 8).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Display */}
                  {step.key === 'upload' && step.data && (
                    <div className="space-y-2">
                      {showMockWarning ? (
                        <div className="bg-red-950/20 border border-red-900 rounded p-3 text-sm text-red-400">
                          <AlertCircle className="h-4 w-4 inline mr-2" />
                          ⚠️ MOCK UPLOAD DETECTED - This is not a real YouTube upload. Please connect YouTube OAuth and re-upload.
                        </div>
                      ) : (
                        <div className="bg-green-950/20 border border-green-900 rounded p-3 space-y-2">
                          <div className="text-sm text-green-400 font-semibold flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Video uploaded to YouTube successfully!
                          </div>
                          <div className="text-xs text-slate-300 space-y-1">
                            <div><strong>Video ID:</strong> {project.youtube_video_id}</div>
                            {project.youtube_url && (
                              <div>
                                <strong>YouTube URL:</strong>{' '}
                                <a href={project.youtube_url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
                                  {project.youtube_url}
                                </a>
                              </div>
                            )}
                            {project.uploaded_at && (
                              <div><strong>Uploaded:</strong> {new Date(project.uploaded_at).toLocaleString()}</div>
                            )}
                            {youtubeStatus?.channel_info && (
                              <div><strong>Channel:</strong> {youtubeStatus.channel_info.title}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {showUploadBlock && (
                    <div className="bg-orange-950/20 border border-orange-900 rounded p-3 text-sm text-orange-400">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      YouTube not connected. Please complete OAuth in Integrations before uploading.
                    </div>
                  )}

                  {/* Schedule Confirmation */}
                  {step.key === 'schedule' && step.data && (
                    <div className="bg-blue-950/20 border border-blue-900 rounded p-3 text-sm text-blue-400">
                      <Calendar className="h-4 w-4 inline mr-2" />
                      Video scheduled for publishing on {project.schedule_date} at {project.schedule_time}
                    </div>
                  )}
                </CardContent>
              )}

              {/* Error Display */}
              {status === 'failed' && project.pipeline_state?.[step.key]?.error && (
                <CardContent>
                  <div className="bg-red-950/20 border border-red-900 rounded p-3 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    {project.pipeline_state[step.key].error}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ==================== SETTINGS VIEW ====================
function SettingsView({ user, settings, onBack, onSave }) {
  const [formSettings, setFormSettings] = useState(settings || {
    theme: 'dark',
    default_language: 'English',
    default_aspect_ratio: '16:9',
    default_publishing_mode: 'draft',
    default_avatar_id: null,
    default_voice_id: null
  });

  const handleSave = () => {
    onSave(formSettings);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-slate-400 text-sm">Manage your account and preferences</p>
        </div>
        <Button variant="ghost" onClick={onBack} className="text-slate-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-400">Email</Label>
            <Input value={user.email} disabled className="bg-slate-900 border-slate-700 text-slate-400 mt-2" />
          </div>
          <div>
            <Label className="text-slate-400">Name</Label>
            <Input value={user.name || ''} disabled className="bg-slate-900 border-slate-700 text-slate-400 mt-2" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Default Project Settings</CardTitle>
          <CardDescription>Set default values for new projects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-white">Default Language</Label>
            <Select value={formSettings.default_language} onValueChange={v => setFormSettings(p => ({ ...p, default_language: v }))}>
              <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white">Default Aspect Ratio</Label>
            <Select value={formSettings.default_aspect_ratio} onValueChange={v => setFormSettings(p => ({ ...p, default_aspect_ratio: v }))}>
              <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white">Default Publishing Mode</Label>
            <Select value={formSettings.default_publishing_mode} onValueChange={v => setFormSettings(p => ({ ...p, default_publishing_mode: v }))}>
              <SelectTrigger className="bg-slate-900 border-slate-700 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="immediate">Publish Immediately</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600">
            <Check className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
