'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState('signin');

  // Sign In form states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');

  // Sign Up form states
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState('');

  // Social login loading
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSignInError('');
    setSignInLoading(true);

    try {
      const result = await signIn('credentials', {
        email: signInEmail,
        password: signInPassword,
        redirect: false
      });

      if (result?.ok) {
        toast.success('Signed in successfully!');
        router.push('/dashboard');
      } else {
        setSignInError(result?.error || 'Invalid email or password');
      }
    } catch (error) {
      setSignInError('An error occurred. Please try again.');
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setSignUpError('');

    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError('Passwords do not match');
      return;
    }

    if (signUpPassword.length < 6) {
      setSignUpError('Password must be at least 6 characters');
      return;
    }

    setSignUpLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpName,
          email: signUpEmail,
          password: signUpPassword
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Account created successfully! Signing you in...');

        const signInResult = await signIn('credentials', {
          email: signUpEmail,
          password: signUpPassword,
          redirect: false
        });

        if (signInResult?.ok) {
          router.push('/dashboard');
        } else {
          setSignUpError('Account created, but auto-sign-in failed. Please sign in manually.');
          setAuthMode('signin');
          setSignInEmail(signUpEmail);
        }
      } else {
        setSignUpError(data.message || 'Failed to create account');
      }
    } catch (error) {
      setSignUpError('An error occurred. Please try again.');
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      toast.error('Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">CreatorFlow AI</CardTitle>
              <CardDescription className="text-slate-400">Premium YouTube Content Studio</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={authMode} onValueChange={setAuthMode} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
              <TabsTrigger value="signin" className="text-white data-[state=active]:bg-violet-600">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-white data-[state=active]:bg-violet-600">
                Sign Up
              </TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label className="text-white text-sm">Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-white text-sm">Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>

                {signInError && (
                  <div className="text-sm text-red-400 bg-red-950/20 border border-red-900 rounded p-3">
                    {signInError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={signInLoading}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium"
                >
                  {signInLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-xs text-slate-500 text-center">
                  Test credentials: testuser@creatorflow.ai / TestPassword123!
                </div>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-slate-900/50 text-slate-400">Or continue with</span>
                </div>
              </div>

              <Button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label className="text-white text-sm">Full Name</Label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-white text-sm">Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-white text-sm">Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-white text-sm">Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>

                {signUpError && (
                  <div className="text-sm text-red-400 bg-red-950/20 border border-red-900 rounded p-3">
                    {signUpError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={signUpLoading}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium"
                >
                  {signUpLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-slate-900/50 text-slate-400">Or sign up with</span>
                </div>
              </div>

              <Button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
