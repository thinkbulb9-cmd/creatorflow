'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  LayoutDashboard, PlusCircle, FolderKanban, CalendarClock,
  Plug, Settings, LogOut, Lightbulb, FileText, Film,
  Video, Tag, Upload, Clock, Loader2, Eye, EyeOff,
  Zap, Sparkles, Trash2, RefreshCw, Check, X,
  ChevronLeft, Rocket, Globe, Send, Play, ChevronRight,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

async function api(path, options = {}) {
  try {
    const res = await fetch(`/api/${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
    return await res.json();
  } catch (err) { return { success: false, message: err.message }; }
}

const STATUS_ORDER = ['submitted','idea_evaluated','script_ready','scenes_ready','video_generating','video_ready','metadata_ready','youtube_uploaded','scheduled'];
const STATUS_LABELS = { submitted:'Submitted', idea_evaluated:'Evaluated', script_ready:'Script Ready', scenes_ready:'Scenes Ready', video_generating:'Generating Video', video_ready:'Video Ready', metadata_ready:'Metadata Ready', youtube_uploaded:'Uploaded', scheduled:'Scheduled', failed:'Failed' };
const STATUS_COLORS = { submitted:'bg-gray-500', idea_evaluated:'bg-blue-500', script_ready:'bg-blue-600', scenes_ready:'bg-indigo-500', video_generating:'bg-yellow-500', video_ready:'bg-purple-500', metadata_ready:'bg-violet-500', youtube_uploaded:'bg-green-500', scheduled:'bg-emerald-500', failed:'bg-red-500' };
const PIPELINE_STEPS = [
  { key:'evaluate', label:'Evaluate', completedAt:'idea_evaluated', icon: Lightbulb, action:'evaluate' },
  { key:'script', label:'Script', completedAt:'script_ready', icon: FileText, action:'generate-script' },
  { key:'scenes', label:'Scenes', completedAt:'scenes_ready', icon: Film, action:'generate-scenes' },
  { key:'video', label:'Video', completedAt:'video_ready', icon: Video, action:'generate-video' },
  { key:'metadata', label:'Metadata', completedAt:'metadata_ready', icon: Tag, action:'generate-metadata' },
  { key:'upload', label:'Upload', completedAt:'youtube_uploaded', icon: Upload, action:'publish-youtube' },
  { key:'schedule', label:'Schedule', completedAt:'scheduled', icon: Clock, action:'schedule-youtube' },
];

function getStepStatus(projectStatus, step) {
  if (projectStatus === 'failed') return 'failed';
  const ci = STATUS_ORDER.indexOf(projectStatus);
  const si = STATUS_ORDER.indexOf(step.completedAt);
  if (ci >= si) return 'completed';
  if (ci === si - 1 || (step.completedAt === 'video_ready' && projectStatus === 'video_generating')) return 'current';
  return 'pending';
}

// ======================== LOGIN ========================
function LoginPage() {
  const [isReg, setIsReg] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('error')) { toast.error('Social login not configured. Use email/password.'); window.history.replaceState({}, '', '/'); }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setErr('');
    if (isReg) {
      const res = await api('register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      if (!res.success) { setErr(res.message); setLoading(false); return; }
    }
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) setErr(isReg ? 'Registration succeeded but login failed. Try signing in.' : 'Invalid email or password.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600"><Sparkles className="h-6 w-6 text-white" /></div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">CreatorFlow AI</h1>
          </div>
          <p className="text-muted-foreground">Automate your YouTube content pipeline</p>
        </div>
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle>{isReg ? 'Create Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>{isReg ? 'Start creating amazing content' : 'Sign in to your account'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isReg && <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required /></div>}
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required /></div>
              {err && <p className="text-sm text-red-400 bg-red-400/10 p-2 rounded">{err}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{isReg ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
            <div className="relative my-6"><Separator /><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">Or continue with</span></div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => signIn('google')} className="h-10">
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </Button>
              <Button variant="outline" onClick={() => signIn('github')} className="h-10">
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              {isReg ? 'Already have an account?' : "Don't have an account?"}
              <button onClick={() => { setIsReg(!isReg); setErr(''); }} className="ml-1 text-violet-400 hover:underline font-medium">{isReg ? 'Sign in' : 'Create one'}</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ======================== SIDEBAR ========================
function Sidebar({ currentView, onNavigate, session }) {
  const items = [
    { key:'dashboard', label:'Dashboard', icon: LayoutDashboard },
    { key:'new-project', label:'New Project', icon: PlusCircle },
    { key:'projects', label:'Projects', icon: FolderKanban },
    { key:'scheduled', label:'Scheduled', icon: CalendarClock },
    { key:'integrations', label:'Integrations', icon: Plug },
    { key:'settings', label:'Settings', icon: Settings },
  ];
  return (
    <div className="w-64 h-screen flex flex-col border-r border-border/50 bg-card/50 backdrop-blur">
      <div className="p-5 flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600"><Sparkles className="h-4 w-4 text-white" /></div>
        <span className="font-bold text-lg bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">CreatorFlow</span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {items.map(item => (
          <button key={item.key} onClick={() => onNavigate(item.key)}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              currentView === item.key ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-400 border border-violet-500/20" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
            <item.icon className="h-4 w-4" />{item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-border"><AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xs">{session?.user?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{session?.user?.name}</p><p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p></div>
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-8 w-8 text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

// ======================== DASHBOARD ========================
function DashboardView({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('dashboard/stats').then(d => { if (d.success) { setStats(d.stats); setRecent(d.recent_projects || []); } setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>;

  const cards = [
    { title:'Total Projects', value: stats?.total || 0, icon: FolderKanban, gradient:'from-violet-500 to-purple-600' },
    { title:'In Progress', value: stats?.in_progress || 0, icon: Loader2, gradient:'from-blue-500 to-cyan-600' },
    { title:'Completed', value: stats?.completed || 0, icon: Check, gradient:'from-green-500 to-emerald-600' },
    { title:'Scheduled', value: stats?.scheduled || 0, icon: CalendarClock, gradient:'from-amber-500 to-orange-600' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div><h2 className="text-2xl font-bold">Dashboard</h2><p className="text-muted-foreground">Your content pipeline at a glance</p></div>
        <Button onClick={() => onNavigate('new-project')} className="bg-gradient-to-r from-violet-600 to-indigo-600"><PlusCircle className="h-4 w-4 mr-2" />New Project</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <Card key={c.title} className="border-border/50 hover:border-violet-500/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-muted-foreground">{c.title}</p><p className="text-3xl font-bold mt-1">{c.value}</p></div>
                <div className={cn("p-3 rounded-xl bg-gradient-to-br", c.gradient)}><c.icon className="h-5 w-5 text-white" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-lg">Recent Projects</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No projects yet. Create your first one!</p>
              <Button variant="outline" onClick={() => onNavigate('new-project')} className="mt-3"><PlusCircle className="h-4 w-4 mr-2" />New Project</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(p => (
                <button key={p._id} onClick={() => onNavigate('project-detail', p._id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[p.status])} />
                    <div className="min-w-0"><p className="font-medium truncate">{p.concept}</p><p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{STATUS_LABELS[p.status]}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== NEW PROJECT ========================
function NewProjectView({ onNavigate }) {
  const [concept, setConcept] = useState('');
  const [duration, setDuration] = useState('60');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [language, setLanguage] = useState('English');
  const [contentStyle, setContentStyle] = useState('professional');
  const [publishingMode, setPublishingMode] = useState('draft');
  const [scheduleAt, setScheduleAt] = useState('');
  const [autoRun, setAutoRun] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!concept.trim()) { toast.error('Please enter a concept'); return; }
    setLoading(true);
    const data = await api('projects', { method: 'POST', body: JSON.stringify({
      concept: concept.trim(), duration_seconds: parseInt(duration), aspect_ratio: aspectRatio,
      language, content_style: contentStyle, publishing_mode: publishingMode, schedule_at: scheduleAt || null
    })});
    if (data.success) {
      toast.success('Project created!');
      if (autoRun) {
        toast.info('Running pipeline...');
        await api(`projects/${data.project._id}/run-pipeline`, { method: 'POST' });
        toast.success('Pipeline completed!');
      }
      onNavigate('project-detail', data.project._id);
    } else { toast.error(data.message || 'Failed to create'); }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6"><h2 className="text-2xl font-bold">New Project</h2><p className="text-muted-foreground">Define your video concept and let AI do the rest</p></div>
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2"><Label>Video Concept *</Label><Textarea placeholder="Describe your video idea in detail... e.g., 'How AI is revolutionizing content creation for small businesses'" value={concept} onChange={e => setConcept(e.target.value)} rows={4} className="resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="30">30 seconds</SelectItem><SelectItem value="60">60 seconds</SelectItem><SelectItem value="180">3 minutes</SelectItem><SelectItem value="480">8 minutes</SelectItem>
              </SelectContent></Select></div>
            <div className="space-y-2"><Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="16:9">16:9 Landscape</SelectItem><SelectItem value="9:16">9:16 Portrait</SelectItem><SelectItem value="1:1">1:1 Square</SelectItem>
              </SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Language</Label><Input value={language} onChange={e => setLanguage(e.target.value)} placeholder="English" /></div>
            <div className="space-y-2"><Label>Content Style</Label>
              <Select value={contentStyle} onValueChange={setContentStyle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="professional">Professional</SelectItem><SelectItem value="casual">Casual</SelectItem><SelectItem value="educational">Educational</SelectItem>
                <SelectItem value="entertaining">Entertaining</SelectItem><SelectItem value="storytelling">Storytelling</SelectItem>
              </SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Publishing Mode</Label>
              <Select value={publishingMode} onValueChange={setPublishingMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="draft">Draft</SelectItem><SelectItem value="immediate">Immediate</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent></Select></div>
            {publishingMode === 'scheduled' && <div className="space-y-2"><Label>Schedule Date & Time</Label><Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} /></div>}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-border/50">
            <Switch checked={autoRun} onCheckedChange={setAutoRun} /><div><Label className="cursor-pointer">Run full pipeline automatically</Label><p className="text-xs text-muted-foreground">Evaluate, script, scenes, video, metadata, and publish in one go</p></div>
          </div>
          <Button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 h-11" onClick={handleCreate} disabled={!concept.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== PROJECTS LIST ========================
function ProjectsListView({ onNavigate, filterScheduled }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(() => {
    api('projects').then(d => { if (d.success) setProjects(d.projects || []); setLoading(false); });
  }, []);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    const d = await api(`projects/${id}`, { method: 'DELETE' });
    if (d.success) { toast.success('Project deleted'); fetchProjects(); }
  };

  const filtered = filterScheduled ? projects.filter(p => p.status === 'scheduled') : projects;

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold">{filterScheduled ? 'Scheduled' : 'Projects'}</h2><p className="text-muted-foreground">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</p></div>
        <Button onClick={() => onNavigate('new-project')} className="bg-gradient-to-r from-violet-600 to-indigo-600"><PlusCircle className="h-4 w-4 mr-2" />New Project</Button>
      </div>
      {filtered.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-12 text-center text-muted-foreground">
          <FolderKanban className="h-16 w-16 mx-auto mb-4 opacity-20" /><p className="text-lg mb-2">No {filterScheduled ? 'scheduled ' : ''}projects yet</p>
          <Button variant="outline" onClick={() => onNavigate('new-project')}><PlusCircle className="h-4 w-4 mr-2" />Create Project</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(p => (
            <Card key={p._id} className="border-border/50 hover:border-violet-500/30 transition-all cursor-pointer group" onClick={() => onNavigate('project-detail', p._id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", STATUS_COLORS[p.status])} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.concept}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{p.duration_seconds}s</span>
                      <span className="text-xs text-muted-foreground">{p.aspect_ratio}</span>
                      <span className="text-xs text-muted-foreground">{p.language}</span>
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{STATUS_LABELS[p.status]}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={e => handleDelete(e, p._id)}><Trash2 className="h-4 w-4" /></Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================== PIPELINE TRACKER ========================
function PipelineTracker({ project, onRunStep, actionLoading }) {
  return (
    <Card className="border-border/50 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {PIPELINE_STEPS.map((step, i) => {
            const status = getStepStatus(project.status, step);
            const StepIcon = step.icon;
            const isLoading = actionLoading === step.action;
            return (
              <Fragment key={step.key}>
                <button onClick={() => onRunStep(step.action)} disabled={!!actionLoading}
                  className={cn("flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all min-w-[70px] hover:bg-accent/50",
                    status === 'failed' && "opacity-50")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                    status === 'completed' && "border-green-400 bg-green-400/10",
                    status === 'current' && "border-violet-400 bg-violet-400/10 animate-pulse",
                    status === 'pending' && "border-muted-foreground/20 bg-muted",
                    status === 'failed' && "border-red-400 bg-red-400/10")}>
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" /> :
                     status === 'completed' ? <Check className="h-3.5 w-3.5 text-green-400" /> :
                     status === 'failed' ? <X className="h-3.5 w-3.5 text-red-400" /> :
                     <StepIcon className={cn("h-3.5 w-3.5", status === 'current' ? "text-violet-400" : "text-muted-foreground")} />}
                  </div>
                  <span className={cn("text-[10px] font-medium",
                    status === 'completed' ? "text-green-400" : status === 'current' ? "text-violet-400" : "text-muted-foreground")}>{step.label}</span>
                </button>
                {i < PIPELINE_STEPS.length - 1 && <div className={cn("flex-1 h-0.5 min-w-[12px] rounded", status === 'completed' ? "bg-green-400/40" : "bg-border")} />}
              </Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ======================== PROJECT DETAIL ========================
function ProjectDetailView({ projectId, onNavigate }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const fetchProject = useCallback(async () => {
    const d = await api(`projects/${projectId}`);
    if (d.success) setProject(d.project); setLoading(false);
  }, [projectId]);
  useEffect(() => { fetchProject(); }, [fetchProject]);

  const runStep = async (action) => {
    setActionLoading(action);
    const d = await api(`projects/${projectId}/${action}`, { method: 'POST' });
    if (d.success) toast.success(`${action} completed`);
    else toast.error(d.message || 'Step failed');
    await fetchProject();
    setActionLoading('');
  };

  const runPipeline = async () => {
    setActionLoading('pipeline');
    const d = await api(`projects/${projectId}/run-pipeline`, { method: 'POST' });
    if (d.success) toast.success('Pipeline completed!');
    else toast.error(d.message || 'Pipeline failed');
    await fetchProject();
    setActionLoading('');
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>;
  if (!project) return <div className="p-8 text-center"><p className="text-muted-foreground">Project not found</p><Button variant="outline" onClick={() => onNavigate('projects')} className="mt-4">Back to Projects</Button></div>;

  const sc = Array.isArray(project.scenes) ? project.scenes : (project.scenes?.scenes || []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => onNavigate('projects')} className="h-9 w-9"><ChevronLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{project.concept}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{project.duration_seconds}s</Badge>
            <Badge variant="outline" className="text-xs">{project.aspect_ratio}</Badge>
            <Badge variant="outline" className="text-xs">{project.language}</Badge>
            <Badge variant="outline" className="text-xs">{project.content_style}</Badge>
            <Badge className={cn("text-xs text-white", STATUS_COLORS[project.status])}>{STATUS_LABELS[project.status]}</Badge>
            
          </div>
        </div>
        <Button onClick={runPipeline} disabled={!!actionLoading} className="bg-gradient-to-r from-violet-600 to-indigo-600">
          {actionLoading === 'pipeline' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}Run Pipeline
        </Button>
      </div>

      <PipelineTracker project={project} onRunStep={runStep} actionLoading={actionLoading} />

      {project.error_message && <Card className="border-red-500/30 bg-red-500/5 mb-6"><CardContent className="p-4 flex items-center gap-3"><X className="h-5 w-5 text-red-400 flex-shrink-0" /><div><p className="font-medium text-red-400">Pipeline Error</p><p className="text-sm text-muted-foreground">{project.error_message}</p></div></CardContent></Card>}

      <div className="space-y-4">
        {project.idea_evaluation && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-400" />Idea Evaluation</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-accent/30"><p className="text-xs text-muted-foreground">Score</p><p className="text-xl font-bold text-violet-400">{project.idea_evaluation.score}/10</p></div>
                <div className="p-3 rounded-lg bg-accent/30"><p className="text-xs text-muted-foreground">Market</p><p className="text-sm font-semibold capitalize">{project.idea_evaluation.market_potential}</p></div>
                <div className="p-3 rounded-lg bg-accent/30"><p className="text-xs text-muted-foreground">Competition</p><p className="text-sm font-semibold capitalize">{project.idea_evaluation.competition_level}</p></div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{project.idea_evaluation.feedback}</p>
              {project.idea_evaluation.suggestions?.length > 0 && <div><p className="text-xs font-medium mb-1.5">Suggestions:</p><ul className="space-y-1">{project.idea_evaluation.suggestions.map((s,i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-violet-400">•</span>{s}</li>)}</ul></div>}
            </CardContent>
          </Card>
        )}

        {project.script && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" />Script<Badge variant="outline" className="ml-auto text-xs">{project.script.word_count} words</Badge></CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Hook</p><div className="text-sm bg-accent/30 p-3 rounded-lg border border-border/50">{project.script.hook}</div></div>
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Full Script</p><div className="text-sm bg-accent/30 p-3 rounded-lg border border-border/50 whitespace-pre-wrap max-h-48 overflow-y-auto">{project.script.full_script}</div></div>
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Call to Action</p><div className="text-sm bg-accent/30 p-3 rounded-lg border border-border/50">{project.script.cta}</div></div>
            </CardContent>
          </Card>
        )}

        {sc.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4 text-indigo-400" />Scenes<Badge variant="outline" className="ml-auto text-xs">{sc.length} scenes</Badge></CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {sc.map((s, i) => (
                <div key={i} className="p-3 rounded-lg bg-accent/30 border border-border/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium">Scene {s.scene_number || i + 1}</span>
                    <div className="flex gap-1.5"><Badge variant="outline" className="text-[10px] px-1.5">{s.duration_sec}s</Badge><Badge variant="outline" className="text-[10px] px-1.5">{s.visual_type}</Badge></div>
                  </div>
                  <p className="text-sm mb-1">{s.speaker_text}</p>
                  <p className="text-xs text-muted-foreground">{s.background_prompt}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(project.video_url || project.status === 'video_generating') && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Video className="h-4 w-4 text-purple-400" />Video</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {project.status === 'video_generating' && !project.video_url ? (
                <div className="flex items-center gap-3 p-4 bg-accent/30 rounded-lg"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /><span className="text-sm">Generating video...</span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => runStep('poll')} disabled={!!actionLoading}><RefreshCw className="h-3 w-3 mr-1" />Poll</Button></div>
              ) : project.video_url ? (
                <div className="rounded-lg overflow-hidden bg-black/50 border border-border/50"><video controls className="w-full max-h-80" src={project.video_url} /></div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {project.metadata && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-pink-400" />Metadata</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Title</p><p className="font-medium">{project.metadata.title}</p></div>
              {project.metadata.alt_titles?.length > 0 && <div><p className="text-xs font-medium text-muted-foreground mb-1">Alternatives</p>{project.metadata.alt_titles.map((t,i) => <p key={i} className="text-sm text-muted-foreground">• {t}</p>)}</div>}
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Description</p><div className="text-sm bg-accent/30 p-3 rounded-lg border border-border/50 whitespace-pre-wrap max-h-40 overflow-y-auto">{project.metadata.description}</div></div>
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Tags</p><div className="flex flex-wrap gap-1.5">{(project.metadata.tags || []).map((t,i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}</div></div>
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Hashtags</p><div className="flex flex-wrap gap-1.5">{(project.metadata.hashtags || []).map((h,i) => <Badge key={i} variant="outline" className="text-xs text-violet-400">{h}</Badge>)}</div></div>
              {project.metadata.thumbnail_prompt && <div><p className="text-xs font-medium text-muted-foreground mb-1">Thumbnail Prompt</p><div className="text-sm bg-accent/30 p-3 rounded-lg border border-border/50">{project.metadata.thumbnail_prompt}</div></div>}
            </CardContent>
          </Card>
        )}

        {(project.youtube_video_id || project.status === 'youtube_uploaded' || project.status === 'scheduled') && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-red-400" />YouTube</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3"><Badge className={project.status === 'scheduled' ? 'bg-emerald-500' : 'bg-green-500'}>{project.status === 'scheduled' ? 'Scheduled' : 'Uploaded'}</Badge>
                {project.youtube_video_id && <span className="text-sm text-muted-foreground">ID: {project.youtube_video_id}</span>}
                {project.schedule_at && <span className="text-sm text-muted-foreground">Scheduled: {new Date(project.schedule_at).toLocaleString()}</span>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ======================== INTEGRATIONS ========================
function IntegrationsView() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [testing, setTesting] = useState('');
  const [keys, setKeys] = useState({ openai: '', heygen: '', heygen_avatar_id: '', yt_client_id: '', yt_client_secret: '' });
  const [showKeys, setShowKeys] = useState({});
  const [avatars, setAvatars] = useState([]);

  const fetchIntegrations = useCallback(async () => {
    const d = await api('integrations'); if (d.success) setIntegrations(d.integrations || []); setLoading(false);
  }, []);
  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const isConnected = (p) => integrations.find(i => i.provider === p)?.is_connected;

  const handleSave = async (provider, config) => {
    setSaving(provider);
    const d = await api('integrations', { method: 'POST', body: JSON.stringify({ provider, config_json: config }) });
    if (d.success) {
      if (d.connected) {
        toast.success(`${provider}: ${d.message || 'Connected successfully!'}`);
        if (d.avatars) setAvatars(d.avatars);
      }
      else { toast.error(`${provider}: ${d.message || 'Key saved but validation failed. Not marked as connected.'}`); }
      fetchIntegrations();
    } else toast.error(d.message);
    setSaving('');
  };

  const handleTest = async (provider) => {
    setTesting(provider);
    const d = await api('integrations/test', { method: 'POST', body: JSON.stringify({ provider }) });
    if (d.success && d.connected) toast.success(`${provider}: ${d.message}`);
    else toast.error(`${provider}: ${d.message || 'Connection failed'}`);
    fetchIntegrations();
    setTesting('');
  };

  const handleDisconnect = async (provider) => {
    await api(`integrations/${provider}`, { method: 'DELETE' });
    toast.success(`${provider} disconnected`); fetchIntegrations();
  };

  const handleYoutubeAuth = async () => {
    const d = await api('youtube/auth');
    if (d.success && d.auth_url) window.open(d.auth_url, '_blank');
    else toast.error(d.message || 'YouTube not configured');
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>;

  const providers = [
    { key: 'openai', name: 'OpenAI', desc: 'AI-powered idea evaluation, script generation, scenes, and metadata', gradient: 'from-green-500 to-emerald-600', icon: <Sparkles className="h-5 w-5 text-white" />,
      fields: (
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">API Key</Label>
            <div className="relative"><Input type={showKeys.openai ? 'text' : 'password'} placeholder="sk-..." value={keys.openai} onChange={e => setKeys(p => ({...p, openai: e.target.value}))} className="pr-10" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKeys(p => ({...p, openai: !p.openai}))}>{showKeys.openai ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleSave('openai', { api_key: keys.openai })} disabled={!keys.openai || saving === 'openai'} className="flex-1">{saving === 'openai' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}Save</Button>
            <Button size="sm" variant="outline" onClick={() => handleTest('openai')} disabled={testing === 'openai'}>{testing === 'openai' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}</Button>
          </div>
        </div>
      )},
    { key: 'heygen', name: 'HeyGen', desc: 'AI avatar video generation from scripts and scenes', gradient: 'from-purple-500 to-violet-600', icon: <Video className="h-5 w-5 text-white" />,
      fields: (
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">API Key</Label>
            <div className="relative"><Input type={showKeys.heygen ? 'text' : 'password'} placeholder="Your HeyGen API key" value={keys.heygen} onChange={e => setKeys(p => ({...p, heygen: e.target.value}))} className="pr-10" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKeys(p => ({...p, heygen: !p.heygen}))}>{showKeys.heygen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
          <div className="space-y-1.5"><Label className="text-xs">Avatar ID <span className="text-muted-foreground">(auto-detected on save, or paste your own)</span></Label>
            <div className="flex gap-2">
              <Input placeholder="Auto-detected from your account" value={keys.heygen_avatar_id} onChange={e => setKeys(p => ({...p, heygen_avatar_id: e.target.value}))} className="flex-1" />
              <Button size="sm" variant="outline" onClick={async () => {
                const d = await api('heygen/avatars');
                if (d.success && d.avatars?.length > 0) {
                  setAvatars(d.avatars);
                  if (!keys.heygen_avatar_id) setKeys(p => ({...p, heygen_avatar_id: d.avatars[0].avatar_id}));
                  toast.success(`${d.avatars.length} avatar(s) found`);
                } else { toast.error(d.message || 'No avatars found'); }
              }}>Load</Button>
            </div>
            {avatars.length > 0 && (
              <Select value={keys.heygen_avatar_id} onValueChange={v => setKeys(p => ({...p, heygen_avatar_id: v}))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select avatar" /></SelectTrigger>
                <SelectContent>{avatars.map(a => <SelectItem key={a.avatar_id} value={a.avatar_id}>{a.avatar_name} ({a.avatar_id})</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleSave('heygen', { api_key: keys.heygen, ...(keys.heygen_avatar_id ? { avatar_id: keys.heygen_avatar_id } : {}) })} disabled={!keys.heygen || saving === 'heygen'} className="flex-1">{saving === 'heygen' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}Save</Button>
            <Button size="sm" variant="outline" onClick={() => handleTest('heygen')} disabled={testing === 'heygen'}>{testing === 'heygen' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}</Button>
          </div>
        </div>
      )},
    { key: 'youtube', name: 'YouTube', desc: 'Upload videos and schedule publishing via YouTube Data API', gradient: 'from-red-500 to-rose-600', icon: <Globe className="h-5 w-5 text-white" />,
      fields: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Client ID</Label><Input placeholder="Google OAuth Client ID" value={keys.yt_client_id} onChange={e => setKeys(p => ({...p, yt_client_id: e.target.value}))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Client Secret</Label>
              <div className="relative"><Input type={showKeys.youtube ? 'text' : 'password'} placeholder="Client Secret" value={keys.yt_client_secret} onChange={e => setKeys(p => ({...p, yt_client_secret: e.target.value}))} className="pr-10" />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKeys(p => ({...p, youtube: !p.youtube}))}>{showKeys.youtube ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleSave('youtube', { client_id: keys.yt_client_id, client_secret: keys.yt_client_secret })} disabled={(!keys.yt_client_id && !keys.yt_client_secret) || saving === 'youtube'} className="flex-1">{saving === 'youtube' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}Save</Button>
            <Button size="sm" variant="outline" onClick={handleYoutubeAuth}><Send className="h-3 w-3 mr-1" />Connect OAuth</Button>
          </div>
        </div>
      )},
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6"><h2 className="text-2xl font-bold">Integrations</h2><p className="text-muted-foreground">Connect your services to enable real AI-powered content generation</p></div>
      <div className="space-y-4">
        {providers.map(p => (
          <Card key={p.key} className={cn("border-border/50 transition-all", isConnected(p.key) && "border-green-500/30")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br", p.gradient)}>{p.icon}</div>
                  <div><CardTitle className="text-base">{p.name}</CardTitle><CardDescription className="text-xs">{p.desc}</CardDescription></div>
                </div>
                <Badge variant={isConnected(p.key) ? 'default' : 'outline'} className={cn("text-xs", isConnected(p.key) ? 'bg-green-500 hover:bg-green-600' : '')}>{isConnected(p.key) ? 'Connected' : 'Not Connected'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {p.fields}
              {isConnected(p.key) && <Button variant="outline" size="sm" className="mt-3 text-red-400 border-red-400/30 hover:bg-red-400/10" onClick={() => handleDisconnect(p.key)}><Trash2 className="h-3 w-3 mr-1" />Disconnect</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50 mt-6 bg-accent/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Live Mode</p>
              <p className="text-xs text-muted-foreground mt-1">All integrations run against real APIs. Connect your API keys above to enable each pipeline step. Steps will fail with a clear error if the required integration is not connected.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== SETTINGS ========================
function SettingsView({ session }) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6"><h2 className="text-2xl font-bold">Settings</h2><p className="text-muted-foreground">Manage your account</p></div>
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div><Label className="text-xs text-muted-foreground">Name</Label><p className="font-medium">{session?.user?.name}</p></div>
          <div><Label className="text-xs text-muted-foreground">Email</Label><p className="font-medium">{session?.user?.email}</p></div>
          <Separator />
          <Button variant="destructive" onClick={() => signOut()}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== MAIN APP ========================
export default function App() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const handleNavigate = useCallback((view, projectId = null) => {
    setCurrentView(view);
    if (projectId) setSelectedProjectId(projectId);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600"><Sparkles className="h-8 w-8 text-white animate-pulse" /></div>
          <p className="text-sm text-muted-foreground">Loading CreatorFlow AI...</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} session={session} />
      <main className="flex-1 overflow-auto">
        {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
        {currentView === 'new-project' && <NewProjectView onNavigate={handleNavigate} />}
        {currentView === 'projects' && <ProjectsListView onNavigate={handleNavigate} />}
        {currentView === 'project-detail' && <ProjectDetailView projectId={selectedProjectId} onNavigate={handleNavigate} />}
        {currentView === 'integrations' && <IntegrationsView />}
        {currentView === 'scheduled' && <ProjectsListView onNavigate={handleNavigate} filterScheduled />}
        {currentView === 'settings' && <SettingsView session={session} />}
      </main>
    </div>
  );
}
