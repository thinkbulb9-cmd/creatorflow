'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      router.replace('/dashboard');
    } else {
      router.replace('/auth');
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
    </div>
  );
}
