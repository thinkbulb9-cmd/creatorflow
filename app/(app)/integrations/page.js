'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Eye, EyeOff, Loader2, CheckCircle2,
  ExternalLink, Trash2, RefreshCw, Check, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const COMING_SOON = ['Instagram', 'Facebook', 'LinkedIn', 'X (Twitter)'];

function StatusBadge({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
      connected
        ? 'bg-green-950/50 text-green-400 border-green-800'
        : 'bg-slate-800/50 text-slate-500 border-slate-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-600'}`} />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [keys, setKeys] = useState({});
  const [avatars, setAvatars] = useState([]);
  const [voices, setVoices] = useState([]);
  const [defaultAvatar, setDefaultAvatar] = useState(null);
  const [defaultVoice, setDefaultVoice] = useState(null);
  const [youtubeChannel, setYoutubeChannel] = useState(null);
  const [settingDefault, setSettingDefault] = useState(null);

  useEffect(() => {
    loadIntegrations();
    const params = new URLSearchParams(window.location.search);
    if (params.get('youtube') === 'connected') {
      toast.success('YouTube connected successfully!');
      window.history.replaceState({}, '', '/integrations');
    }
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      if (data.success) {
        setIntegrations(data.integrations || {});
        if (data.avatars?.length) setAvatars(data.avatars);
        if (data.voices?.length) setVoices(data.voices);
        if (data.default_avatar_id) setDefaultAvatar(data.default_avatar_id);
        if (data.default_voice_id) setDefaultVoice(data.default_voice_id);
        if (data.youtube_channel) setYoutubeChannel(data.youtube_channel);
        // Pre-fill masked keys
        const pre = {};
        if (data.integrations?.openai?.api_key) pre.openai = data.integrations.openai.api_key;
        if (data.integrations?.heygen?.api_key) pre.heygen = data.integrations.heygen.api_key;
        setKeys(pre);
      }
    } catch {
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (provider) => {
    const key = keys[provider];
    if (!key || key.includes('****')) {
      toast.error('Please enter your actual API key (not the masked value)');
      return;
    }
    setSaving(s => ({ ...s, [provider]: true }));
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key })
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(s => ({
          ...s,
          [provider]: { ...s[provider], ...data.config, is_connected: data.is_connected }
        }));
        if (data.avatars?.length) setAvatars(data.avatars);
        if (data.voices?.length) setVoices(data.voices);
        if (data.is_connected) {
          toast.success(`${provider === 'openai' ? 'OpenAI' : 'HeyGen'} connected!`);
        } else {
          toast.error(data.message || 'Key saved but connection failed — check your key.');
        }
      } else {
        toast.error(data.message || 'Failed to save');
      }
    } catch {
      toast.error('Network error — try again');
    } finally {
      setSaving(s => ({ ...s, [provider]: false }));
    }
  };

  const handleRefreshAssets = async () => {
    setSaving(s => ({ ...s, heygen_refresh: true }));
    try {
      await loadIntegrations();
      toast.success('Assets refreshed');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setSaving(s => ({ ...s, heygen_refresh: false }));
    }
  };

  const handleSetDefault = async (type, id) => {
    setSettingDefault(`${type}_${id}`);
    try {
      const endpoint = type === 'avatar' ? 'default-avatar' : 'default-voice';
      const body = type === 'avatar' ? { avatar_id: id } : { voice_id: id };
      const res = await fetch(`/api/integrations/heygen/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        if (type === 'avatar') setDefaultAvatar(id);
        else setDefaultVoice(id);
        toast.success(`Default ${type} updated`);
      } else {
        toast.error(data.message || `Failed to set default ${type}`);
      }
    } catch {
      toast.error(`Failed to set default ${type}`);
    } finally {
      setSettingDefault(null);
    }
  };

  const handleYoutubeConnect = async () => {
    const clientId = keys.youtube_client_id;
    const clientSecret = keys.youtube_client_secret;
    if (!clientId || !clientSecret) {
      toast.error('Enter both Client ID and Client Secret');
      return;
    }
    setSaving(s => ({ ...s, youtube: true }));
    try {
      const res = await fetch('/api/integrations/youtube/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
      });
      const data = await res.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast.error(data.message || 'Failed to start YouTube OAuth');
        setSaving(s => ({ ...s, youtube: false }));
      }
    } catch {
      toast.error('Error connecting YouTube');
      setSaving(s => ({ ...s, youtube: false }));
    }
  };

  const handleYoutubeDisconnect = async () => {
    if (!confirm('Disconnect YouTube? This will disable video publishing.')) return;
    try {
      const res = await fetch('/api/integrations/youtube', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setYoutubeChannel(null);
        setIntegrations(s => { const n = { ...s }; delete n.youtube; return n; });
        toast.success('YouTube disconnected');
      }
    } catch {
      toast.error('Error disconnecting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const openaiConnected = !!integrations.openai?.is_connected;
  const heygenConnected = !!integrations.heygen?.is_connected;
  const youtubeConnected = !!youtubeChannel;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Integrations</h1>
          <p className="text-slate-400 mt-1 text-sm">Connect your tools. API keys are encrypted and never exposed.</p>
        </div>

        {/* Status overview */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'OpenAI', connected: openaiConnected, icon: '🤖' },
            { label: 'HeyGen', connected: heygenConnected, icon: '🎭' },
            { label: 'YouTube', connected: youtubeConnected, icon: '▶️' }
          ].map(({ label, connected, icon }) => (
            <div key={label} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${connected ? 'border-green-800 bg-green-950/20' : 'border-slate-800 bg-slate-900/30'}`}>
              <span className="text-base">{icon}</span>
              <div>
                <p className="text-xs font-medium text-white">{label}</p>
                <p className={`text-xs ${connected ? 'text-green-400' : 'text-slate-500'}`}>
                  {connected ? '● Active' : '○ Not set'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── OpenAI ── */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base">🤖</div>
                <div>
                  <CardTitle className="text-white text-sm font-semibold">OpenAI</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Script, scenes, evaluation, metadata</CardDescription>
                </div>
              </div>
              <StatusBadge connected={openaiConnected} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-400 text-xs font-medium mb-2 block">API Key</Label>
              <div className="relative">
                <Input
                  type={showKeys.openai ? 'text' : 'password'}
                  placeholder="sk-proj-..."
                  value={keys.openai || ''}
                  onChange={e => setKeys(s => ({ ...s, openai: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 pr-10 h-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(s => ({ ...s, openai: !s.openai }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                {'→ '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
                  className="text-violet-400 hover:text-violet-300 hover:underline">
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
            <Button
              onClick={() => handleSave('openai')}
              disabled={saving.openai || !keys.openai || keys.openai.includes('****')}
              className="h-9 w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-sm font-medium"
            >
              {saving.openai
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...</>
                : openaiConnected
                ? <><Check className="h-3.5 w-3.5" /> Update Key</>
                : <><Zap className="h-3.5 w-3.5" /> Save & Connect</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* ── HeyGen ── */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base">🎭</div>
                <div>
                  <CardTitle className="text-white text-sm font-semibold">HeyGen</CardTitle>
                  <CardDescription className="text-xs text-slate-500">AI video avatars and voice synthesis</CardDescription>
                </div>
              </div>
              <StatusBadge connected={heygenConnected} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-400 text-xs font-medium mb-2 block">API Key</Label>
              <div className="relative">
                <Input
                  type={showKeys.heygen ? 'text' : 'password'}
                  placeholder="Your HeyGen API key"
                  value={keys.heygen || ''}
                  onChange={e => setKeys(s => ({ ...s, heygen: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 pr-10 h-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(s => ({ ...s, heygen: !s.heygen }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showKeys.heygen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                {'→ '}
                <a href="https://app.heygen.com/settings/api" target="_blank" rel="noreferrer"
                  className="text-violet-400 hover:text-violet-300 hover:underline">
                  app.heygen.com/settings/api
                </a>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleSave('heygen')}
                disabled={saving.heygen || !keys.heygen || keys.heygen.includes('****')}
                className="flex-1 h-9 gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-sm font-medium"
              >
                {saving.heygen
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...</>
                  : heygenConnected
                  ? <><Check className="h-3.5 w-3.5" /> Update Key</>
                  : <><Zap className="h-3.5 w-3.5" /> Save & Connect</>
                }
              </Button>
              {heygenConnected && (
                <Button variant="outline" size="sm" onClick={handleRefreshAssets} disabled={saving.heygen_refresh}
                  className="h-9 px-3 border-slate-700 text-slate-400 hover:text-white text-xs">
                  {saving.heygen_refresh ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>

            {/* Avatars & Voices */}
            {heygenConnected && (avatars.length > 0 || voices.length > 0) && (
              <div className="space-y-5 pt-1">
                <Separator className="bg-slate-800" />

                {avatars.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Avatars <span className="text-slate-600 font-normal normal-case ml-1">— click to set as default</span>
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {avatars.map(av => {
                        const id = av.avatar_id;
                        const isDefault = defaultAvatar === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSetDefault('avatar', id)}
                            disabled={settingDefault === `avatar_${id}`}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              isDefault
                                ? 'border-violet-500 ring-1 ring-violet-500/40'
                                : 'border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {av.preview_image ? (
                              <img src={av.preview_image} alt={av.avatar_name} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-slate-800 flex items-center justify-center text-xl">🎭</div>
                            )}
                            <div className="px-1.5 py-1 bg-slate-900/90">
                              <p className="text-xs text-white font-medium truncate leading-tight">{av.avatar_name}</p>
                            </div>
                            {isDefault && (
                              <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-violet-600 flex items-center justify-center shadow">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                            {settingDefault === `avatar_${id}` && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {voices.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Voices <span className="text-slate-600 font-normal normal-case ml-1">— click to set as default</span>
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {voices.map(v => {
                        const id = v.voice_id;
                        const isDefault = defaultVoice === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSetDefault('voice', id)}
                            disabled={settingDefault === `voice_${id}`}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                              isDefault
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-white font-medium truncate">{v.voice_name}</p>
                              <div className="flex gap-1.5 mt-0.5">
                                {v.language && <span className="text-xs text-slate-500">{v.language}</span>}
                                {v.language && v.gender && <span className="text-slate-700">·</span>}
                                {v.gender && <span className="text-xs text-slate-500 capitalize">{v.gender}</span>}
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-3">
                              {settingDefault === `voice_${id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                              ) : isDefault ? (
                                <div className="h-4 w-4 rounded-full bg-violet-600 flex items-center justify-center">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── YouTube ── */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#FF0000">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-white text-sm font-semibold">YouTube</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Publish and schedule to your channel</CardDescription>
                </div>
              </div>
              <StatusBadge connected={youtubeConnected} />
            </div>
          </CardHeader>
          <CardContent>
            {youtubeConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3.5 bg-slate-800/40 rounded-xl border border-slate-700">
                  {youtubeChannel.thumbnail ? (
                    <img src={youtubeChannel.thumbnail} alt={youtubeChannel.title} className="h-10 w-10 rounded-full border border-slate-600 object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-red-950/50 border border-red-900/50 flex items-center justify-center text-sm">▶</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{youtubeChannel.title}</p>
                    <p className="text-xs text-slate-500">
                      {youtubeChannel.subscriber_count != null
                        ? `${Number(youtubeChannel.subscriber_count).toLocaleString()} subscribers`
                        : `Channel ID: ${youtubeChannel.id}`}
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                </div>
                <Button
                  variant="outline"
                  onClick={handleYoutubeDisconnect}
                  className="w-full h-9 gap-2 border-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-950/20 text-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Disconnect YouTube
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="border-slate-700 bg-slate-800/30 py-3">
                  <AlertDescription className="text-slate-400 text-xs leading-relaxed">
                    Create a project in{' '}
                    <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                      Google Cloud Console
                    </a>{' '}
                    with <strong className="text-slate-300">YouTube Data API v3</strong> enabled. Add this redirect URI:
                    <div className="mt-1.5 p-2 bg-slate-900 rounded border border-slate-600 font-mono text-violet-300 text-xs break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/youtube/callback` : 'https://your-domain.com/api/youtube/callback'}
                    </div>
                  </AlertDescription>
                </Alert>
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs font-medium mb-2 block">Client ID</Label>
                    <Input
                      placeholder="1234567890-abc123.apps.googleusercontent.com"
                      value={keys.youtube_client_id || ''}
                      onChange={e => setKeys(s => ({ ...s, youtube_client_id: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs font-medium mb-2 block">Client Secret</Label>
                    <div className="relative">
                      <Input
                        type={showKeys.yt_secret ? 'text' : 'password'}
                        placeholder="GOCSPX-..."
                        value={keys.youtube_client_secret || ''}
                        onChange={e => setKeys(s => ({ ...s, youtube_client_secret: e.target.value }))}
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-10 pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys(s => ({ ...s, yt_secret: !s.yt_secret }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showKeys.yt_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleYoutubeConnect}
                  disabled={saving.youtube || !keys.youtube_client_id || !keys.youtube_client_secret}
                  className="w-full h-10 gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 font-medium"
                >
                  {saving.youtube
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting to Google...</>
                    : <><ExternalLink className="h-4 w-4" /> Connect with YouTube</>
                  }
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Coming Soon ── */}
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3">More platforms coming soon</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {COMING_SOON.map(name => (
              <div key={name} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800/50 bg-slate-900/20 opacity-40 select-none cursor-not-allowed">
                <span className="text-xs font-medium text-slate-500">{name}</span>
                <span className="text-xs text-slate-600 mt-1">Soon</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
