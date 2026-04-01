'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, Video, Globe, Loader2, Play, CheckCircle2, AlertCircle, 
  RefreshCw, Image as ImageIcon, Upload, Calendar, Award, AlertTriangle, 
  Lightbulb, ArrowRight, User, Music, Film, LogOut, Edit, TrendingUp,
  Mic, UserCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Wizard Steps
const STEPS = {
  CREATE: 'create',
  VALIDATE: 'validate',
  VOICE: 'voice',
  PIPELINE: 'pipeline'
};

export default function App() {
  const { data: session, status } = useSession();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(STEPS.CREATE);
  const [project, setProject] = useState(null);
  
  // Form state
  const [concept, setConcept] = useState('');
  const [duration, setDuration] = useState(60);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [language, setLanguage] = useState('English');
  const [contentStyle, setContentStyle] = useState('professional');
  const [publishingMode, setPublishingMode] = useState('draft');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  // Validation state
  const [evaluation, setEvaluation] = useState(null);
  const [editingConcept, setEditingConcept] = useState(false);
  const [editedConcept, setEditedConcept] = useState('');
  
  // Voice & Avatar state
  const [voices, setVoices] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  
  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  
  // Loading state
  const [loading, setLoading] = useState(false);
  
  // Auth state
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  // API helper
  const api = async (endpoint, options = {}) => {
    const res = await fetch(`/api/${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return res.json();
  };

  // ==================== AUTH FUNCTIONS ====================
  
  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    
    const data = await api('register', {
      method: 'POST',
      body: JSON.stringify(authForm)
    });
    
    if (data.success) {
      toast.success('Account created! Please sign in.');
      setAuthMode('signin');
      setAuthForm({ name: '', email: '', password: '' });
    } else {
      toast.error(data.message || 'Signup failed');
    }
    setAuthLoading(false);
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    
    const result = await signIn('credentials', {
      email: authForm.email,
      password: authForm.password,
      redirect: false
    });
    
    if (result?.error) {
      toast.error('Invalid credentials');
    } else {
      toast.success('Welcome back!');
    }
    setAuthLoading(false);
  };

  const handleGoogleSignin = () => {
    signIn('google', { callbackUrl: '/' });
  };

  // ==================== STEP 1: CREATE PROJECT ====================
  
  const handleCreateProject = async () => {
    if (!concept.trim()) {
      toast.error('Please enter a video concept');
      return;
    }
    
    setLoading(true);
    const data = await api('projects', {
      method: 'POST',
      body: JSON.stringify({
        concept,
        duration_seconds: duration,
        aspect_ratio: aspectRatio,
        language,
        content_style: contentStyle,
        publishing_mode: publishingMode,
        schedule_date: scheduleDate,
        schedule_time: scheduleTime
      })
    });
    
    if (data.success) {
      setProject(data.project);
      setCurrentStep(STEPS.VALIDATE);
      toast.success('Concept created! Now validating...');
      // Auto-run validation
      setTimeout(() => runIdeaValidation(data.project._id), 500);
    } else {
      toast.error(data.message || 'Failed to create project');
    }
    setLoading(false);
  };

  // ==================== STEP 2: IDEA VALIDATION ====================
  
  const runIdeaValidation = async (projectId) => {
    setLoading(true);
    const data = await api(`projects/${projectId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ regenerate: false })
    });
    
    if (data.success) {
      setEvaluation(data.evaluation);
      setProject(prev => ({ ...prev, idea_evaluation: data.evaluation }));
      toast.success('Idea evaluated!');
    } else {
      toast.error(data.message || 'Validation failed');
    }
    setLoading(false);
  };

  const handleUpdateConcept = async (newConcept) => {
    setLoading(true);
    const data = await api(`projects/${project._id}/update-concept`, {
      method: 'PATCH',
      body: JSON.stringify({ concept: newConcept })
    });
    
    if (data.success) {
      setProject(data.project);
      setConcept(newConcept);
      setEvaluation(null);
      setEditingConcept(false);
      toast.success('Concept updated! Re-evaluating...');
      setTimeout(() => runIdeaValidation(data.project._id), 500);
    } else {
      toast.error(data.message || 'Update failed');
    }
    setLoading(false);
  };

  const handleApplySuggestedTopic = async (topic) => {
    if (confirm(`Replace concept with: "${topic}"?`)) {
      await handleUpdateConcept(topic);
    }
  };

  const handleApproveAndContinue = () => {
    setCurrentStep(STEPS.VOICE);
    toast.success('Moving to voice selection...');
    loadVoicesAndAvatars();
  };

  // ==================== STEP 3: VOICE & AVATAR SELECTION ====================
  
  const loadVoicesAndAvatars = async () => {
    setLoadingVoices(true);
    
    // Load voices
    const voicesData = await api('heygen/voices');
    if (voicesData.success) {
      setVoices(voicesData.voices || []);
    } else {
      toast.error('Failed to load voices: ' + (voicesData.message || 'Unauthorized. Please add HeyGen API key in integrations.'));
    }
    
    // Load avatars
    const avatarsData = await api('heygen/avatars');
    if (avatarsData.success) {
      setAvatars(avatarsData.avatars || []);
    } else {
      toast.error('Failed to load avatars');
    }
    
    setLoadingVoices(false);
  };

  const handleStartProduction = async () => {
    if (!selectedVoice || !selectedAvatar) {
      toast.error('Please select both voice and avatar');
      return;
    }
    
    // Update project with selections
    setProject(prev => ({
      ...prev,
      selected_voice_id: selectedVoice,
      selected_avatar_id: selectedAvatar
    }));
    
    setCurrentStep(STEPS.PIPELINE);
    toast.success('Starting production pipeline...');
    
    // Auto-start pipeline
    setTimeout(() => runFullPipeline(), 500);
  };

  // ==================== STEP 4: PIPELINE EXECUTION ====================
  
  const runFullPipeline = async () => {
    setPipelineRunning(true);
    const data = await api(`projects/${project._id}/run-pipeline`, { method: 'POST' });
    
    if (data.success) {
      toast.success('Pipeline started! This will take 5-10 minutes...');
      
      // Poll for updates
      const pollInterval = setInterval(async () => {
        const updated = await api(`projects/${project._id}`);
        if (updated.success) {
          setProject(updated.project);
          setPipelineStatus(updated.project.pipeline_status);
          
          if (updated.project.pipeline_status === 'completed') {
            clearInterval(pollInterval);
            setPipelineRunning(false);
            toast.success('🎉 Video created successfully!');
          } else if (updated.project.pipeline_status === 'failed') {
            clearInterval(pollInterval);
            setPipelineRunning(false);
            toast.error('Pipeline failed: ' + (updated.project.pipeline_error || 'Unknown error'));
          }
        }
      }, 3000);
      
      // Timeout after 15 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setPipelineRunning(false);
      }, 900000);
    } else {
      setPipelineRunning(false);
      toast.error(data.message || 'Failed to start pipeline');
    }
  };

  const handleStartNewProject = () => {
    setCurrentStep(STEPS.CREATE);
    setProject(null);
    setEvaluation(null);
    setConcept('');
    setSelectedVoice('');
    setSelectedAvatar('');
    setPipelineStatus(null);
    toast.info('Starting new project...');
  };

  const getScoreColor = (score) => {
    if (score >= 9) return 'text-yellow-500';
    if (score >= 7) return 'text-green-500';
    if (score >= 5) return 'text-orange-500';
    return 'text-red-500';
  };

  // ==================== RENDER ====================

  // Show auth screen if not logged in
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">CreatorFlow AI</CardTitle>
            <CardDescription className="text-slate-300">Automate your YouTube content pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={setAuthMode} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={authLoading}>
                    {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your Name"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-slate-400">Minimum 6 characters</p>
                  </div>
                  <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={authLoading}>
                    {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleSignin}
              variant="outline"
              className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>

            <p className="text-center text-xs text-slate-400 mt-4">
              Test credentials: testuser@creatorflow.ai / TestPassword123!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main App - Wizard Flow
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CreatorFlow AI</h1>
              <p className="text-xs text-slate-400">AI-Powered YouTube Content Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <User className="h-4 w-4" />
              {session.user?.name || session.user?.email}
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-slate-400">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { key: STEPS.CREATE, label: 'Create Concept', icon: Edit },
            { key: STEPS.VALIDATE, label: 'Validate Idea', icon: Award },
            { key: STEPS.VOICE, label: 'Select Voice', icon: Mic },
            { key: STEPS.PIPELINE, label: 'Production', icon: Video }
          ].map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.key;
            const isPast = Object.values(STEPS).indexOf(currentStep) > index;
            const isCurrent = Object.values(STEPS).indexOf(currentStep) === index;
            
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isCurrent ? 'bg-violet-600 text-white' :
                  isPast ? 'bg-green-600 text-white' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  <StepIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                {index < 3 && (
                  <ArrowRight className={`h-4 w-4 mx-2 ${isPast ? 'text-green-500' : 'text-slate-600'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          {/* STEP 1: CREATE CONCEPT */}
          {currentStep === STEPS.CREATE && (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Create Your Video Concept</CardTitle>
                <CardDescription className="text-slate-400">
                  Describe your video idea and we'll help you create professional content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="concept" className="text-white">Video Concept *</Label>
                  <Input
                    id="concept"
                    placeholder="e.g., How AI is transforming HR in 2026"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white"
                    required
                  />
                  <p className="text-xs text-slate-400">Be specific and clear about your video topic</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration" className="text-white">Duration</Label>
                    <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                      <SelectTrigger className="bg-slate-900 border-slate-700">
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

                  <div className="space-y-2">
                    <Label htmlFor="aspect" className="text-white">Aspect Ratio</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger className="bg-slate-900 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 (YouTube)</SelectItem>
                        <SelectItem value="9:16">9:16 (Shorts)</SelectItem>
                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language" className="text-white">Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="bg-slate-900 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                        <SelectItem value="German">German</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="style" className="text-white">Content Style</Label>
                    <Select value={contentStyle} onValueChange={setContentStyle}>
                      <SelectTrigger className="bg-slate-900 border-slate-700">
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

                <div className="space-y-2">
                  <Label htmlFor="publishing" className="text-white">Publishing Mode</Label>
                  <Select value={publishingMode} onValueChange={setPublishingMode}>
                    <SelectTrigger className="bg-slate-900 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Save Only)</SelectItem>
                      <SelectItem value="instant">Instant Publish</SelectItem>
                      <SelectItem value="scheduled">Schedule Publishing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {publishingMode === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-white">Schedule Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time" className="text-white">Schedule Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleCreateProject}
                  disabled={loading || !concept.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-lg py-6"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating & Validating...
                    </>
                  ) : (
                    <>
                      Next: Validate Idea
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: IDEA VALIDATION */}
          {currentStep === STEPS.VALIDATE && (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Idea Validation</CardTitle>
                <CardDescription className="text-slate-400">
                  AI analysis of your video concept with trend insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading && !evaluation && (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-violet-400 mx-auto mb-4" />
                    <p className="text-slate-300">Analyzing your concept with AI and trending data...</p>
                  </div>
                )}

                {evaluation && (
                  <div className="space-y-6">
                    {/* Score Display */}
                    <div className="flex items-start gap-6">
                      <div className={`text-6xl font-bold ${getScoreColor(evaluation.score)}`}>
                        {evaluation.score}/10
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2 flex-wrap">
                          {evaluation.opportunity_level && (
                            <Badge variant="secondary" className="bg-blue-950 text-blue-300">
                              Opportunity: {evaluation.opportunity_level}
                            </Badge>
                          )}
                          {evaluation.competition_level && (
                            <Badge variant="secondary" className="bg-orange-950 text-orange-300">
                              Competition: {evaluation.competition_level}
                            </Badge>
                          )}
                          {evaluation.virality_potential && (
                            <Badge variant="secondary" className="bg-violet-950 text-violet-300">
                              Virality: {evaluation.virality_potential}
                            </Badge>
                          )}
                        </div>

                        {/* Current Concept - Editable */}
                        <div className="bg-slate-900/50 p-4 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm text-slate-400">Current Concept</Label>
                            {!editingConcept && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingConcept(true);
                                  setEditedConcept(concept);
                                }}
                                className="text-xs h-7"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                          
                          {editingConcept ? (
                            <div className="space-y-2">
                              <Input
                                value={editedConcept}
                                onChange={(e) => setEditedConcept(e.target.value)}
                                className="bg-slate-800 border-slate-700"
                                placeholder="Enter new concept..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateConcept(editedConcept)}
                                  disabled={loading || !editedConcept.trim()}
                                  className="bg-violet-600 hover:bg-violet-700"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Save & Re-validate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingConcept(false);
                                    setEditedConcept('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-200">{concept}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Suggested Alternative Topics */}
                    {evaluation.suggested_topics && evaluation.suggested_topics.length > 0 && evaluation.score < 7 && (
                      <div className="bg-amber-950/20 border border-amber-800/30 p-4 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-amber-400">
                          <TrendingUp className="h-5 w-5" />
                          <h4 className="font-semibold">Better Trending Topics (Click to Use)</h4>
                        </div>
                        <p className="text-xs text-slate-400">
                          These alternatives are based on current trends and may perform better
                        </p>
                        <div className="space-y-2">
                          {evaluation.suggested_topics.map((topic, i) => (
                            <button
                              key={i}
                              onClick={() => handleApplySuggestedTopic(topic)}
                              className="w-full text-left bg-slate-900/50 hover:bg-slate-900/80 p-3 rounded-lg transition-colors border border-slate-700 hover:border-amber-500"
                            >
                              <div className="text-sm text-slate-200 font-medium flex items-center gap-2">
                                <span className="text-amber-500">→</span>
                                {topic}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strengths */}
                    {evaluation.strengths && evaluation.strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" /> Strengths
                        </h4>
                        <ul className="space-y-1">
                          {evaluation.strengths.map((strength, i) => (
                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-green-500">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> Weaknesses
                        </h4>
                        <ul className="space-y-1">
                          {evaluation.weaknesses.map((weakness, i) => (
                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-orange-500">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {evaluation.recommendations && evaluation.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-violet-400 mb-2 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" /> Recommendations
                        </h4>
                        <div className="space-y-2">
                          {evaluation.recommendations.map((rec, i) => (
                            <div key={i} className="bg-slate-900/50 p-3 rounded-lg">
                              <div className="text-sm text-slate-200 font-medium">{rec.text || rec}</div>
                              {rec.why && <div className="text-xs text-slate-400 mt-1">Why: {rec.why}</div>}
                              {rec.impact && <div className="text-xs text-violet-400 mt-1">Impact: {rec.impact}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleApproveAndContinue}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-lg py-6"
                      >
                        Approve & Continue to Voice Selection
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                      <Button
                        onClick={() => runIdeaValidation(project._id)}
                        variant="outline"
                        className="px-6 border-slate-700"
                        disabled={loading}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-validate
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 3: VOICE & AVATAR SELECTION */}
          {currentStep === STEPS.VOICE && (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Select Voice & Avatar</CardTitle>
                <CardDescription className="text-slate-400">
                  Choose the AI voice and avatar for your video
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingVoices ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-violet-400 mx-auto mb-4" />
                    <p className="text-slate-300">Loading available voices and avatars...</p>
                  </div>
                ) : (
                  <>
                    {/* Voice Selection */}
                    <div className="space-y-3">
                      <Label className="text-white text-lg">Select Voice</Label>
                      {voices.length === 0 ? (
                        <div className="bg-red-950/20 border border-red-800/30 p-4 rounded-lg">
                          <p className="text-red-400 text-sm">
                            ⚠️ No voices available. Please add your HeyGen API key in the integrations settings.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                          {voices.map((voice) => (
                            <button
                              key={voice.voice_id}
                              onClick={() => setSelectedVoice(voice.voice_id)}
                              className={`p-4 rounded-lg border-2 transition-all text-left ${
                                selectedVoice === voice.voice_id
                                  ? 'border-violet-500 bg-violet-950/30'
                                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Mic className="h-5 w-5 text-violet-400" />
                                <div>
                                  <p className="font-medium text-white">{voice.name}</p>
                                  <p className="text-xs text-slate-400">{voice.language || 'English'} • {voice.gender || 'Neutral'}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Avatar Selection */}
                    <div className="space-y-3">
                      <Label className="text-white text-lg">Select Avatar</Label>
                      {avatars.length === 0 ? (
                        <div className="bg-red-950/20 border border-red-800/30 p-4 rounded-lg">
                          <p className="text-red-400 text-sm">
                            ⚠️ No avatars available. Please add your HeyGen API key in the integrations settings.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                          {avatars.map((avatar) => (
                            <button
                              key={avatar.avatar_id}
                              onClick={() => setSelectedAvatar(avatar.avatar_id)}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                selectedAvatar === avatar.avatar_id
                                  ? 'border-violet-500 bg-violet-950/30'
                                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                              }`}
                            >
                              {avatar.preview_image_url ? (
                                <img
                                  src={avatar.preview_image_url}
                                  alt={avatar.name}
                                  className="w-full aspect-square object-cover rounded-lg mb-2"
                                />
                              ) : (
                                <div className="w-full aspect-square bg-slate-800 rounded-lg flex items-center justify-center mb-2">
                                  <UserCircle className="h-12 w-12 text-slate-600" />
                                </div>
                              )}
                              <p className="text-xs font-medium text-white text-center">{avatar.name}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleStartProduction}
                        disabled={!selectedVoice || !selectedAvatar}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-lg py-6"
                      >
                        Start Production Pipeline
                        <Play className="h-5 w-5 ml-2" />
                      </Button>
                      <Button
                        onClick={() => setCurrentStep(STEPS.VALIDATE)}
                        variant="outline"
                        className="px-6 border-slate-700"
                      >
                        Back
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 4: PIPELINE EXECUTION */}
          {currentStep === STEPS.PIPELINE && (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Production Pipeline</CardTitle>
                <CardDescription className="text-slate-400">
                  Your video is being created automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {pipelineRunning && (
                  <div className="text-center py-8">
                    <Loader2 className="h-16 w-16 animate-spin text-violet-400 mx-auto mb-4" />
                    <p className="text-lg text-white font-medium">Pipeline Running...</p>
                    <p className="text-sm text-slate-400 mt-2">This may take 5-10 minutes. Please wait.</p>
                  </div>
                )}

                {project && (
                  <div className="space-y-4">
                    {/* Pipeline Steps */}
                    {[
                      { key: 'script', name: 'Script Generation', icon: Sparkles },
                      { key: 'scenes', name: 'Scene Creation', icon: Film },
                      { key: 'video', name: 'Video Generation', icon: Video },
                      { key: 'thumbnail', name: 'Thumbnail Creation', icon: ImageIcon },
                      { key: 'metadata', name: 'Metadata Generation', icon: Globe },
                      { key: 'upload', name: 'YouTube Upload', icon: Upload, conditional: project.publishing_mode !== 'draft' },
                      { key: 'schedule', name: 'Schedule Publishing', icon: Calendar, conditional: project.publishing_mode === 'scheduled' }
                    ].filter(step => !step.conditional || step.conditional).map((step) => {
                      const StepIcon = step.icon;
                      const stepState = project.pipeline_state?.[step.key];
                      const status = stepState?.status || 'pending';
                      
                      return (
                        <div key={step.key} className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg">
                          <div className={`p-2 rounded-lg ${
                            status === 'completed' ? 'bg-green-600' :
                            status === 'running' ? 'bg-blue-600' :
                            status === 'failed' ? 'bg-red-600' :
                            'bg-slate-700'
                          }`}>
                            {status === 'running' ? (
                              <Loader2 className="h-5 w-5 text-white animate-spin" />
                            ) : status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-white" />
                            ) : status === 'failed' ? (
                              <AlertCircle className="h-5 w-5 text-white" />
                            ) : (
                              <StepIcon className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-white">{step.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{status}</p>
                          </div>
                          {status === 'completed' && (
                            <Badge variant="secondary" className="bg-green-950 text-green-300">
                              ✓ Done
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {pipelineStatus === 'completed' && (
                  <div className="bg-green-950/20 border border-green-800/30 p-6 rounded-lg text-center space-y-4">
                    <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">🎉 Video Created Successfully!</h3>
                      <p className="text-slate-300">Your video has been generated and is ready.</p>
                    </div>
                    {project?.youtube_video_id && (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-400">YouTube Video ID: {project.youtube_video_id}</p>
                        {project.youtube_url && (
                          <a
                            href={project.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-violet-400 hover:text-violet-300"
                          >
                            View on YouTube →
                          </a>
                        )}
                      </div>
                    )}
                    <Button
                      onClick={handleStartNewProject}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      Create Another Video
                    </Button>
                  </div>
                )}

                {pipelineStatus === 'failed' && (
                  <div className="bg-red-950/20 border border-red-800/30 p-6 rounded-lg text-center space-y-4">
                    <AlertCircle className="h-16 w-16 text-red-400 mx-auto" />
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Pipeline Failed</h3>
                      <p className="text-slate-300">{project?.pipeline_error || 'An unknown error occurred'}</p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Button
                        onClick={() => runFullPipeline()}
                        variant="outline"
                        className="border-slate-700"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Pipeline
                      </Button>
                      <Button
                        onClick={handleStartNewProject}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        Start New Project
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
