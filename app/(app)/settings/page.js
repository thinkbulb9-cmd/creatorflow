'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: session?.user?.name || ''
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [preferences, setPreferences] = useState({
    default_language: 'English',
    default_duration: '60',
    notifications_enabled: true
  });

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Profile updated successfully!');
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Password changed successfully!');
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
      } else {
        toast.error(data.message || 'Failed to change password');
      }
    } catch (error) {
      toast.error('Error changing password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Preferences saved successfully!');
      } else {
        toast.error(data.message || 'Failed to save preferences');
      }
    } catch (error) {
      toast.error('Error saving preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you absolutely sure you want to delete your account? This action cannot be undone. All your projects will be permanently deleted.'
    );

    if (!confirmed) return;

    const doubleConfirmed = window.prompt(
      'Type your email address to confirm account deletion:'
    );

    if (doubleConfirmed !== session?.user?.email) {
      toast.error('Email does not match');
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Account deleted. Signing you out...');
        setTimeout(() => {
          signOut({ callbackUrl: '/auth' });
        }, 1500);
      } else {
        toast.error(data.message || 'Failed to delete account');
      }
    } catch (error) {
      toast.error('Error deleting account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-2xl font-semibold text-white">
                {session?.user?.name?.[0]?.toUpperCase() ||
                  session?.user?.email?.[0]?.toUpperCase() ||
                  'U'}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {session?.user?.name}
                </p>
                <p className="text-sm text-slate-500">{session?.user?.email}</p>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            {/* Name */}
            <div>
              <Label className="text-white">Full Name</Label>
              <Input
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm(prev => ({ ...prev, name: e.target.value }))
                }
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-2"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <Label className="text-white">Email</Label>
              <Input
                type="email"
                value={session?.user?.email || ''}
                disabled
                className="bg-slate-800 border-slate-700 text-slate-400 mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Email cannot be changed. Contact support for assistance.
              </p>
            </div>

            <Separator className="bg-slate-800" />

            {/* Save Button */}
            <Button
              onClick={handleSaveProfile}
              disabled={loading || profileForm.name === session?.user?.name}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Security</CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <Label className="text-white">Current Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm(prev => ({
                        ...prev,
                        current_password: e.target.value
                      }))
                    }
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPasswords ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <Label className="text-white">New Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm(prev => ({
                        ...prev,
                        new_password: e.target.value
                      }))
                    }
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <Label className="text-white">Confirm New Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm(prev => ({
                        ...prev,
                        confirm_password: e.target.value
                      }))
                    }
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                  />
                </div>
              </div>

              <Separator className="bg-slate-800" />

              <Button
                type="submit"
                disabled={
                  passwordLoading ||
                  !passwordForm.current_password ||
                  !passwordForm.new_password ||
                  !passwordForm.confirm_password
                }
                className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Change Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Preferences</CardTitle>
            <CardDescription>Customize your default settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Language */}
            <div>
              <Label className="text-white">Default Language</Label>
              <Select
                value={preferences.default_language}
                onValueChange={(value) =>
                  setPreferences(prev => ({
                    ...prev,
                    default_language: value
                  }))
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="English" className="text-white">
                    English
                  </SelectItem>
                  <SelectItem value="Spanish" className="text-white">
                    Spanish
                  </SelectItem>
                  <SelectItem value="French" className="text-white">
                    French
                  </SelectItem>
                  <SelectItem value="German" className="text-white">
                    German
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Duration */}
            <div>
              <Label className="text-white">Default Video Duration</Label>
              <Select
                value={preferences.default_duration}
                onValueChange={(value) =>
                  setPreferences(prev => ({
                    ...prev,
                    default_duration: value
                  }))
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="30" className="text-white">
                    30 seconds
                  </SelectItem>
                  <SelectItem value="60" className="text-white">
                    60 seconds
                  </SelectItem>
                  <SelectItem value="120" className="text-white">
                    2 minutes
                  </SelectItem>
                  <SelectItem value="300" className="text-white">
                    5 minutes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-slate-800" />

            <Button
              onClick={handleSavePreferences}
              disabled={loading}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-900 bg-red-950/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-red-400">Danger Zone</CardTitle>
            <CardDescription className="text-red-300/70">
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="border-red-900 bg-red-950/30 mb-4">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-300 ml-2">
                Deleting your account is permanent. All projects will be permanently deleted.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
              variant="destructive"
              className="w-full gap-2"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
