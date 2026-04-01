'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Video, Globe, Eye, EyeOff, Check, Loader2, Plus, Play, Trash2, Calendar, Clock, BarChart3, TrendingUp, Users, Share2, PlayCircle, CheckCircle2, AlertCircle, RefreshCw, Image as ImageIcon, Upload, Instagram, Facebook, Linkedin, Twitter, Award, Target, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function App() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('7d');
  const [languages, setLanguages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [avatars, setAvatars] = useState([]);
  
  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Form states
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
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
      // Fetch voices and avatars if HeyGen is connected
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
    setLoading(true);
    const data = await api('projects', { method: 'POST', body: JSON.stringify(projectForm) });
    if (data.success) {
      toast.success('Project created!');
      setShowNewProject(false);
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
      toast.success('Thumbnail selected!');
      refreshProject(projectId);
    }
  };

  const deleteProject = async (id) => {
    if (!confirm('Delete this project?')) return;
    const data = await api(`projects/${id}`, { method: 'DELETE' });
    if (data.success) {
      toast.success('Project deleted');
      fetchProjects();
      if (selectedProject?._id === id) setSelectedProject(null);
    }
  };

  const handleSaveIntegration = async (provider, config) => {
    setSaving(provider);
    const data = await api('integrations', {
      method: 'POST',
      body: JSON.stringify({ provider, config_json: config })
    });
    if (data.success) {
      toast.success(data.message || 'Saved!');
      fetchIntegrations();
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

  // Calculate progress
  const calculateProgress = (project) => {
    if (!project?.pipeline_state) return { completed: 0, total: 8, percentage: 0 };
    
    const steps = Object.values(project.pipeline_state || {});
    const completed = steps.filter(s => s.status === 'completed').length;
    const total = steps.length || 8;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  };

  // Get current step info
  const getCurrentStep = (project) => {
    if (!project?.pipeline_state) return { name: 'Not started', status: 'pending' };
    
    const stepOrder = ['evaluate', 'script', 'scenes', 'video', 'thumbnail', 'metadata', 'upload', 'schedule'];
    for (const stepKey of stepOrder) {
      const step = project.pipeline_state[stepKey];
      if (!step || step.status !== 'completed') {
        return {
          key: stepKey,
          name: stepKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status: step?.status || 'pending'
        };
      }
    }
    return { name: 'Completed', status: 'completed' };
  };

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 9) return 'text-yellow-500';
    if (score >= 7) return 'text-green-500';
    if (score >= 5) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBadgeVariant = (score) => {
    if (score >= 9) return 'default';
    if (score >= 7) return 'default';
    if (score >= 5) return 'secondary';
    return 'destructive';
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
      // Successful login - NextAuth will handle the session
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">CreatorFlow AI</h1>
                <p className="text-xs text-slate-400">Automate YouTube content</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 hidden sm:block">{session.user.email}</span>
              <Button onClick={() => signOut()} variant="outline" size="sm" className="border-slate-700">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-violet-600">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-violet-600">
              <Video className="h-4 w-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-violet-600">
              <Globe className="h-4 w-4 mr-2" />
              Integrations
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Analytics Timeframe */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
                <p className="text-slate-400 text-sm">Track your content performance</p>
              </div>
              <Select value={analyticsTimeframe} onValueChange={setAnalyticsTimeframe}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
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
              </>
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Projects</h2>
                <p className="text-slate-400 text-sm">Manage your content projects</p>
              </div>
              <Button
                onClick={() => setShowNewProject(true)}
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
                    className="bg-slate-800/50 border-slate-700 hover:border-violet-500 transition-all cursor-pointer"
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-lg line-clamp-2">{project.concept}</CardTitle>
                          <CardDescription className="mt-1">
                            {project.aspect_ratio} • {project.duration_seconds}s • {project.language}
                          </CardDescription>
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
                          <span>{progress.percentage}%</span>
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
                  <p className="text-slate-400">No projects yet. Create your first project!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Integrations</h2>
              <p className="text-slate-400 text-sm">Connect your services to enable AI-powered content generation</p>
            </div>

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
                      onClick={() => handleSaveIntegration('openai', { api_key: keys.openai })}
                      disabled={!keys.openai || saving === 'openai'}
                      className="flex-1 bg-violet-600 hover:bg-violet-700"
                    >
                      {saving === 'openai' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestIntegration('openai')}
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
                      onClick={() => handleSaveIntegration('heygen', { api_key: keys.heygen })}
                      disabled={!keys.heygen || saving === 'heygen'}
                      className="flex-1 bg-violet-600 hover:bg-violet-700"
                    >
                      {saving === 'heygen' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestIntegration('heygen')}
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
                    <Badge variant={integrations.find(i => i.provider === 'youtube')?.is_connected ? 'default' : 'secondary'}>
                      {integrations.find(i => i.provider === 'youtube')?.is_connected ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">Client ID</Label>
                      <Input
                        placeholder="Google OAuth Client ID"
                        value={keys.yt_client_id || ''}
                        onChange={e => setKeys(p => ({ ...p, yt_client_id: e.target.value }))}
                        className="bg-slate-900 border-slate-700"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Client Secret</Label>
                      <Input
                        type="password"
                        placeholder="Client Secret"
                        value={keys.yt_client_secret || ''}
                        onChange={e => setKeys(p => ({ ...p, yt_client_secret: e.target.value }))}
                        className="bg-slate-900 border-slate-700"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSaveIntegration('youtube', { client_id: keys.yt_client_id, client_secret: keys.yt_client_secret })}
                    disabled={!keys.yt_client_id || saving === 'youtube'}
                    className="w-full bg-violet-600 hover:bg-violet-700"
                  >
                    {saving === 'youtube' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                    Save
                  </Button>
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

              {/* Coming Soon - Facebook */}
              <Card className="bg-slate-800/30 border-slate-700 opacity-60">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Facebook className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white">Facebook</CardTitle>
                      <CardDescription className="text-xs">Schedule posts and videos</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-slate-600">Coming Soon</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">Future support for Facebook video publishing</p>
                </CardContent>
              </Card>

              {/* Coming Soon - LinkedIn */}
              <Card className="bg-slate-800/30 border-slate-700 opacity-60">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                      <Linkedin className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white">LinkedIn</CardTitle>
                      <CardDescription className="text-xs">Share professional content</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-slate-600">Coming Soon</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">Future support for LinkedIn video posts</p>
                </CardContent>
              </Card>

              {/* Coming Soon - X (Twitter) */}
              <Card className="bg-slate-800/30 border-slate-700 opacity-60">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                      <Twitter className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white">X (Twitter)</CardTitle>
                      <CardDescription className="text-xs">Post short-form videos</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-slate-600">Coming Soon</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">Future support for X video publishing</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Project Modal */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Configure your AI-powered content project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Video Concept *</Label>
              <Input
                placeholder="e.g., 5 productivity tips for remote workers"
                value={projectForm.concept}
                onChange={e => setProjectForm(p => ({ ...p, concept: e.target.value }))}
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration</Label>
                <Select value={String(projectForm.duration_seconds)} onValueChange={v => setProjectForm(p => ({ ...p, duration_seconds: parseInt(v) }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
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
                <Label>Aspect Ratio</Label>
                <Select value={projectForm.aspect_ratio} onValueChange={v => setProjectForm(p => ({ ...p, aspect_ratio: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Language</Label>
                <Select value={projectForm.language} onValueChange={v => setProjectForm(p => ({ ...p, language: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
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
                <Label>Content Style</Label>
                <Select value={projectForm.content_style} onValueChange={v => setProjectForm(p => ({ ...p, content_style: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="entertaining">Entertaining</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {voices.length > 0 && (
              <div>
                <Label>Voice (Optional)</Label>
                <Select value={projectForm.selected_voice_id || undefined} onValueChange={v => setProjectForm(p => ({ ...p, selected_voice_id: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Auto-select from language" />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label>Avatar (Optional)</Label>
                <Select value={projectForm.selected_avatar_id || undefined} onValueChange={v => setProjectForm(p => ({ ...p, selected_avatar_id: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Auto-select first available" />
                  </SelectTrigger>
                  <SelectContent>
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
              <Label>Publishing Mode</Label>
              <Select value={projectForm.publishing_mode} onValueChange={v => setProjectForm(p => ({ ...p, publishing_mode: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (Save only)</SelectItem>
                  <SelectItem value="immediate">Publish Immediately</SelectItem>
                  <SelectItem value="scheduled">Schedule for Later</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {projectForm.publishing_mode === 'scheduled' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Schedule Date</Label>
                  <Input
                    type="date"
                    value={projectForm.schedule_date}
                    onChange={e => setProjectForm(p => ({ ...p, schedule_date: e.target.value }))}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label>Schedule Time</Label>
                  <Input
                    type="time"
                    value={projectForm.schedule_time}
                    onChange={e => setProjectForm(p => ({ ...p, schedule_time: e.target.value }))}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={createProject}
                disabled={!projectForm.concept || loading}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Project
              </Button>
              <Button variant="outline" onClick={() => setShowNewProject(false)} className="border-slate-700">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Detail Modal - Continued in next part due to length */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onDelete={deleteProject}
          onRunStep={runPipelineStep}
          onSelectThumbnail={selectThumbnail}
          loading={loading}
          pollingVideo={pollingVideo}
        />
      )}
    </div>
  );
}

// Project Detail Modal Component (continuation)
function ProjectDetailModal({ project, onClose, onDelete, onRunStep, onSelectThumbnail, loading, pollingVideo }) {
  const progress = calculateProgress(project);
  const pipelineSteps = [
    { key: 'evaluate', name: 'Idea Evaluation', endpoint: 'evaluate', icon: Award, data: project.idea_evaluation },
    { key: 'script', name: 'Script Generation', endpoint: 'generate-script', icon: Sparkles, data: project.script_data },
    { key: 'scenes', name: 'Scene Creation', endpoint: 'generate-scenes', icon: Video, data: project.scenes },
    { key: 'video', name: 'Video Generation', endpoint: 'generate-video', icon: PlayCircle, data: project.video_url },
    { key: 'thumbnail', name: 'Thumbnail', endpoint: 'generate-thumbnail', icon: ImageIcon, data: project.thumbnail_data },
    { key: 'metadata', name: 'Metadata', endpoint: 'generate-metadata', icon: Globe, data: project.metadata },
    { key: 'upload', name: 'Upload', endpoint: 'publish-youtube', icon: Upload, data: project.youtube_video_id },
    { key: 'schedule', name: 'Schedule', endpoint: 'schedule-youtube', icon: Calendar, data: project.status === 'scheduled' }
  ];

  function calculateProgress(proj) {
    const steps = Object.values(proj.pipeline_state || {});
    const completed = steps.filter(s => s.status === 'completed').length;
    return { completed, total: steps.length || 8, percentage: Math.round((completed / (steps.length || 8)) * 100) };
  }

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

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl">{project.concept}</DialogTitle>
              <DialogDescription className="mt-1">
                {project.aspect_ratio} • {project.duration_seconds}s • {project.language}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(project._id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{progress.completed} of {progress.total} steps completed</span>
            <span className="font-semibold text-violet-400">{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} className="h-3" />
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-4">
          {pipelineSteps.map((step, index) => {
            const status = getStepStatus(step.key);
            const StepIcon = step.icon;
            const isLocked = index > 0 && getStepStatus(pipelineSteps[index - 1].key) !== 'completed';

            return (
              <Card key={step.key} className={`bg-slate-800/50 border-slate-700 ${isLocked ? 'opacity-50' : ''}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status)}
                    <StepIcon className="h-5 w-5 text-violet-400" />
                    <div className="flex-1">
                      <CardTitle className="text-base">{step.name}</CardTitle>
                      <CardDescription className="text-xs capitalize">{status}</CardDescription>
                    </div>
                    {!isLocked && status !== 'running' && (
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
                        <div className="bg-slate-900/50 p-3 rounded text-sm text-slate-300 max-h-40 overflow-y-auto">
                          {step.data.full_script}
                        </div>
                        <div className="text-xs text-slate-500">{step.data.word_count} words</div>
                      </div>
                    )}

                    {/* Scenes Display */}
                    {step.key === 'scenes' && step.data && (
                      <div className="space-y-2">
                        {(Array.isArray(step.data) ? step.data : step.data.scenes || []).slice(0, 3).map((scene, i) => (
                          <div key={i} className="bg-slate-900/50 p-2 rounded text-xs">
                            <div className="font-semibold text-violet-400">Scene {scene.scene_number}</div>
                            <div className="text-slate-300">{scene.speaker_text?.substring(0, 100)}...</div>
                          </div>
                        ))}
                        <div className="text-xs text-slate-500">{(Array.isArray(step.data) ? step.data : step.data.scenes || []).length} scenes total</div>
                      </div>
                    )}

                    {/* Video Display */}
                    {step.key === 'video' && step.data && (
                      <div className="space-y-2">
                        <video src={step.data} controls className="w-full rounded-lg" />
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
                        <div className="grid grid-cols-3 gap-3">
                          {Object.entries(step.data.images).map(([ratio, url]) => (
                            <div
                              key={ratio}
                              className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                step.data.selected === url ? 'border-violet-500' : 'border-slate-700 hover:border-slate-600'
                              }`}
                              onClick={() => onSelectThumbnail(project._id, url)}
                            >
                              <img src={url} alt={ratio} className="w-full h-auto" />
                              <div className="bg-slate-900/80 p-2 text-xs text-center">
                                {ratio}
                                {step.data.selected === url && <CheckCircle2 className="h-3 w-3 inline ml-1 text-violet-500" />}
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
                          {step.data.description?.substring(0, 200)}...
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {(step.data.tags || []).slice(0, 5).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}

                {/* Error Display */}
                {status === 'failed' && project.pipeline_state?.[step.key]?.error && (
                  <CardContent>
                    <div className="bg-red-950/20 border border-red-900 rounded p-3 text-sm text-red-400">
                      {project.pipeline_state[step.key].error}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
