'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Plus,
  TrendingUp,
  Video,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  PlayCircle,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, analyticsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/analytics')
      ]);

      const projectsData = await projectsRes.json();
      const analyticsData = await analyticsRes.json();

      if (projectsData.success) {
        setProjects(projectsData.projects || []);
      }

      if (analyticsData.success) {
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredProjects = () => {
    if (filter === 'all') return projects;
    return projects.filter(p => p.status === filter);
  };

  const filteredProjects = getFilteredProjects();

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'bg-slate-700 text-slate-100' },
      running: { label: 'Running', className: 'bg-blue-700 text-blue-100' },
      published: { label: 'Published', className: 'bg-green-700 text-green-100' },
      scheduled: { label: 'Scheduled', className: 'bg-orange-700 text-orange-100' },
      failed: { label: 'Failed', className: 'bg-red-700 text-red-100' }
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={`${config.className} border-0`}>{config.label}</Badge>;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <PlayCircle className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-orange-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">
            {greeting}
          </h1>
          <p className="text-slate-400 mt-1">
            Welcome back! Here's what's happening with your projects today.
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">
                Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {projects.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {projects.filter(p => p.status === 'draft').length} drafts
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {projects.filter(p => p.status === 'published').length}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ready to promote
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">
                Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {projects.filter(p => p.status === 'scheduled').length}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Pending publication
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                {projects.filter(p => p.status === 'running').length}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                In progress
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Your Projects</h2>
            <Link href="/projects/new">
              <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-slate-800/50 border border-slate-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-violet-600">
                All
              </TabsTrigger>
              <TabsTrigger value="draft" className="data-[state=active]:bg-violet-600">
                Drafts
              </TabsTrigger>
              <TabsTrigger value="running" className="data-[state=active]:bg-violet-600">
                Running
              </TabsTrigger>
              <TabsTrigger value="published" className="data-[state=active]:bg-violet-600">
                Published
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="data-[state=active]:bg-violet-600">
                Scheduled
              </TabsTrigger>
              <TabsTrigger value="failed" className="data-[state=active]:bg-violet-600">
                Failed
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-4">
              {filteredProjects.length === 0 ? (
                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
                  <CardContent className="pt-12 pb-12">
                    <div className="text-center">
                      <FolderOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-4">
                        No projects found in this category
                      </p>
                      <Link href="/projects/new">
                        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                          <Plus className="h-4 w-4" />
                          Create First Project
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map(project => (
                    <Card
                      key={project.id}
                      className="border-slate-800 bg-slate-900/50 backdrop-blur hover:bg-slate-900/70 transition-all cursor-pointer group"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base text-white group-hover:text-violet-400 transition-colors">
                              {project.concept}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              Created {new Date(project.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusIcon(project.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          {getStatusBadge(project.status)}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Progress</p>
                          <Progress
                            value={
                              project.pipeline_state?.progress || 0
                            }
                            className="h-2 bg-slate-800"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {Math.round(project.pipeline_state?.progress || 0)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
