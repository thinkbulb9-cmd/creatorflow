'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  ExternalLink,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(null);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.concept.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.language && p.language.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-slate-700 text-slate-100',
      running: 'bg-blue-700 text-blue-100',
      published: 'bg-green-700 text-green-100',
      scheduled: 'bg-orange-700 text-orange-100',
      failed: 'bg-red-700 text-red-100'
    };
    return colors[status] || colors.draft;
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        setProjects(projects.filter(p => p.id !== id));
        toast.success('Project deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete project');
      }
    } catch (error) {
      toast.error('Error deleting project');
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="text-slate-400 mt-1">
              Manage and create your content projects
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search projects by name or language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Projects Table */}
        {filteredProjects.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">
                  {searchQuery
                    ? 'No projects match your search'
                    : 'No projects yet. Create your first one!'}
                </p>
                <Link href="/projects/new">
                  <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-800/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Project</TableHead>
                  <TableHead className="text-slate-400">Language</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Progress</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map(project => (
                  <TableRow
                    key={project.id}
                    className="border-slate-800 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <TableCell className="text-white font-medium">
                      {project.concept}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {project.language || 'English'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(project.status)} border-0`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={project.pipeline_state?.progress || 0}
                          className="w-16 h-2 bg-slate-700"
                        />
                        <span className="text-xs text-slate-500 w-8">
                          {Math.round(project.pipeline_state?.progress || 0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/projects/${project.id}`)}
                          className="text-slate-400 hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(project.id)}
                          disabled={deleteLoading === project.id}
                          className="text-slate-400 hover:text-red-400"
                        >
                          {deleteLoading === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Stats Footer */}
        {filteredProjects.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="pt-4">
                <p className="text-sm text-slate-400">Total</p>
                <p className="text-2xl font-bold text-white">
                  {filteredProjects.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="pt-4">
                <p className="text-sm text-slate-400">Published</p>
                <p className="text-2xl font-bold text-green-500">
                  {filteredProjects.filter(p => p.status === 'published').length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="pt-4">
                <p className="text-sm text-slate-400">Drafts</p>
                <p className="text-2xl font-bold text-slate-400">
                  {filteredProjects.filter(p => p.status === 'draft').length}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
