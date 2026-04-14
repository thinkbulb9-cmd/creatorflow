'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const ASPECT_RATIOS = [
  { label: '16:9 (YouTube)', value: '16:9' },
  { label: '9:16 (Shorts)', value: '9:16' },
  { label: '1:1 (Square)', value: '1:1' },
  { label: '4:3 (Classic)', value: '4:3' }
];

const CONTENT_STYLES = [
  'Professional',
  'Casual',
  'Educational',
  'Entertainment',
  'News',
  'Tutorial',
  'Comedy',
  'Motivational'
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Hindi',
  'Arabic'
];

export default function CreateProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [avatars, setAvatars] = useState([]);
  const [voices, setVoices] = useState([]);

  const [form, setForm] = useState({
    concept: '',
    topic: '',
    language: 'English',
    duration_seconds: 60,
    aspect_ratio: '16:9',
    content_style: 'Professional',
    publishing_mode: 'draft',
    schedule_date: '',
    schedule_time: '',
    selected_avatar_id: '',
    selected_voice_id: ''
  });

  const [validationWarnings, setValidationWarnings] = useState([]);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      if (data.success) {
        if (data.avatars) setAvatars(data.avatars);
        if (data.voices) setVoices(data.voices);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (form.selected_avatar_id && form.selected_voice_id) {
      const avatar = avatars.find(a => a.avatar_id === form.selected_avatar_id);
      const voice = voices.find(v => v.voice_id === form.selected_voice_id);

      const warnings = [];
      if (
        avatar?.gender &&
        voice?.gender &&
        avatar.gender.toLowerCase() !== voice.gender.toLowerCase()
      ) {
        warnings.push(
          `Avatar gender (${avatar.gender}) doesn't match voice gender (${voice.gender}). This may affect video quality.`
        );
      }
      setValidationWarnings(warnings);
    } else {
      setValidationWarnings([]);
    }
  }, [form.selected_avatar_id, form.selected_voice_id, avatars, voices]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.concept.trim()) {
      toast.error('Project concept is required');
      return;
    }

    if (form.publishing_mode === 'scheduled') {
      if (!form.schedule_date || !form.schedule_time) {
        toast.error('Schedule date and time are required for scheduled publishing');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration_seconds: parseInt(form.duration_seconds)
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Project created successfully!');
        router.push(`/projects/${data.project.id}`);
      } else {
        toast.error(data.message || 'Failed to create project');
      }
    } catch (error) {
      toast.error('Error creating project');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-white">Create New Project</h1>
          <p className="text-slate-400 mt-1">
            Set up your video content with AI-powered automation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Basic Information</CardTitle>
                <CardDescription>Tell us about your video concept</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white">Project Concept</Label>
                  <Input
                    placeholder="e.g., How to Build a Personal Brand in 2024"
                    value={form.concept}
                    onChange={(e) => handleInputChange('concept', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-2"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white">Topic / Idea (Optional)</Label>
                  <Textarea
                    placeholder="Additional details about your video idea..."
                    value={form.topic}
                    onChange={(e) => handleInputChange('topic', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-2 min-h-24"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Video Settings */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Video Settings</CardTitle>
                <CardDescription>Configure your video output</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-white">Duration</Label>
                    <span className="text-sm text-violet-400 font-medium">
                      {form.duration_seconds}s
                    </span>
                  </div>
                  <Slider
                    value={[form.duration_seconds]}
                    onValueChange={(value) =>
                      handleInputChange('duration_seconds', value[0])
                    }
                    min={30}
                    max={600}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    30 seconds to 10 minutes
                  </p>
                </div>

                <div>
                  <Label className="text-white">Aspect Ratio</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {ASPECT_RATIOS.map(ratio => (
                      <button
                        key={ratio.value}
                        type="button"
                        onClick={() => handleInputChange('aspect_ratio', ratio.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          form.aspect_ratio === ratio.value
                            ? 'border-violet-600 bg-violet-600/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-sm font-medium text-white">
                          {ratio.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-white">Content Style</Label>
                  <Select value={form.content_style} onValueChange={(value) => handleInputChange('content_style', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {CONTENT_STYLES.map(style => (
                        <SelectItem key={style} value={style} className="text-white">
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white">Language</Label>
                  <Select value={form.language} onValueChange={(value) => handleInputChange('language', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang} value={lang} className="text-white">
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Publishing Options */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Publishing Options</CardTitle>
                <CardDescription>Choose when to publish your video</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={form.publishing_mode}
                  onValueChange={(value) => handleInputChange('publishing_mode', value)}
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer transition-colors">
                    <RadioGroupItem value="draft" id="draft" />
                    <Label htmlFor="draft" className="text-white cursor-pointer flex-1 m-0">
                      <div className="font-medium">Save as Draft</div>
                      <div className="text-xs text-slate-500">
                        Generate and review before publishing
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer transition-colors">
                    <RadioGroupItem value="instant" id="instant" />
                    <Label htmlFor="instant" className="text-white cursor-pointer flex-1 m-0">
                      <div className="font-medium">Publish Instantly</div>
                      <div className="text-xs text-slate-500">
                        Auto-publish to YouTube after generation
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer transition-colors">
                    <RadioGroupItem value="scheduled" id="scheduled" />
                    <Label htmlFor="scheduled" className="text-white cursor-pointer flex-1 m-0">
                      <div className="font-medium">Schedule for Later</div>
                      <div className="text-xs text-slate-500">
                        Publish at a specific date and time
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {form.publishing_mode === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg mt-4">
                    <div>
                      <Label className="text-white text-sm">Publish Date</Label>
                      <Input
                        type="date"
                        value={form.schedule_date}
                        onChange={(e) =>
                          handleInputChange('schedule_date', e.target.value)
                        }
                        className="bg-slate-700 border-slate-600 text-white mt-2"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-white text-sm">Publish Time</Label>
                      <Input
                        type="time"
                        value={form.schedule_time}
                        onChange={(e) =>
                          handleInputChange('schedule_time', e.target.value)
                        }
                        className="bg-slate-700 border-slate-600 text-white mt-2"
                        required
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Avatar & Voice Selection */}
          <div className="space-y-6">
            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
              <Card className="border-orange-900 bg-orange-950/30 backdrop-blur">
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-400 mb-1">
                        Warning
                      </p>
                      {validationWarnings.map((warning, idx) => (
                        <p key={idx} className="text-xs text-orange-300">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Avatar Selection */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white text-base">Avatar</CardTitle>
                <CardDescription className="text-xs">
                  Choose a presenter for your video
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                  </div>
                ) : avatars.length === 0 ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 mb-3">
                      No avatars available. Connect HeyGen to get started.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/integrations')}
                      className="border-slate-700 text-slate-400 hover:text-white"
                    >
                      Go to Integrations
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {avatars.map(avatar => (
                      <button
                        key={avatar.avatar_id}
                        type="button"
                        onClick={() =>
                          handleInputChange('selected_avatar_id', avatar.avatar_id)
                        }
                        className={`p-2 rounded-lg border-2 transition-all ${
                          form.selected_avatar_id === avatar.avatar_id
                            ? 'border-violet-600 bg-violet-600/20'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {avatar.preview_image && (
                          <img
                            src={avatar.preview_image}
                            alt={avatar.avatar_name}
                            className="w-full h-20 rounded object-cover mb-1"
                          />
                        )}
                        <p className="text-xs font-medium text-white truncate">
                          {avatar.avatar_name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Voice Selection */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white text-base">Voice</CardTitle>
                <CardDescription className="text-xs">
                  Choose a voice for your video
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                  </div>
                ) : voices.length === 0 ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 mb-3">
                      No voices available. Connect HeyGen to get started.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/integrations')}
                      className="border-slate-700 text-slate-400 hover:text-white"
                    >
                      Go to Integrations
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {voices.map(voice => (
                      <button
                        key={voice.voice_id}
                        type="button"
                        onClick={() =>
                          handleInputChange('selected_voice_id', voice.voice_id)
                        }
                        className={`w-full p-2 rounded-lg border-2 text-left transition-all ${
                          form.selected_voice_id === voice.voice_id
                            ? 'border-violet-600 bg-violet-600/20'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-xs font-medium text-white">
                          {voice.voice_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {voice.gender && (
                            <Badge variant="outline" className="text-xs">
                              {voice.gender}
                            </Badge>
                          )}
                          {voice.language && (
                            <Badge variant="outline" className="text-xs">
                              {voice.language}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="space-y-2 sticky bottom-4">
              <Button
                type="submit"
                disabled={loading || !form.concept.trim()}
                className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
              <Button
                type="button"
                onClick={() => router.back()}
                variant="outline"
                className="w-full border-slate-700 text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
