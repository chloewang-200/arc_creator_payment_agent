'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function CreatorAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Wait a bit for OAuth callback to process
    const timeoutId = setTimeout(() => {
      if (!loading && !user) {
        console.log('[AuthGuard] No user after timeout, redirecting to login');
        router.push('/creator/login');
      }
      setHasChecked(true);
    }, 2000); // Wait 2 seconds for OAuth session

    return () => clearTimeout(timeoutId);
  }, [loading, user, router]);

  // Show loading while checking auth or waiting for OAuth
  if (loading || !hasChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-64">
          <CardContent className="pt-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}

