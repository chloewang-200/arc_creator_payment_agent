'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { ChainSelector } from '@/components/ChainSelector';
import { UniversalBalance } from '@/components/UniversalBalance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreatorCard } from '@/components/CreatorCard';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Users, TrendingUp, Heart, Wallet, Crown, Loader2, MessageCircle, Bot } from 'lucide-react';
import { BlobAvatar } from '@/components/BlobAvatar';
import type { Creator } from '@/types';

export default function BrowsePage() {
  const { isConnected } = useAccount();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCreators = async () => {
      try {
        const response = await fetch('/api/creators/list');
        if (response.ok) {
          const data = await response.json();
          setCreators(data.creators || []);
        }
      } catch (error) {
        console.error('Error loading creators:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCreators();
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Soft pastel background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Yellow - top right (large, prominent) */}
        <div className="absolute -top-32 -right-32 w-[800px] h-[800px] pastel-yellow rounded-full blur-3xl animate-float" style={{ animationDelay: '0s' }}></div>
        {/* Blue - middle left (large, prominent) */}
        <div className="absolute top-1/3 -left-32 w-[900px] h-[900px] pastel-blue rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        {/* Pink - bottom right (large, prominent) */}
        <div className="absolute -bottom-32 -right-24 w-[850px] h-[850px] pastel-pink rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Bloby
                </h1>
                <p className="text-xs text-muted-foreground">Creator Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/">For Creators</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/creator/login">Creator Dashboard</Link>
              </Button>
              <ChainSelector />
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="text-center mb-20">
          <Badge variant="secondary" className="mb-6 px-3 py-1 text-xs">
            <TrendingUp className="w-3 h-3 mr-1.5" />
            Powered by Arc Network
          </Badge>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-foreground">
            Discover Creators,<br />Support Creators
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            Explore creators, unlock premium content, subscribe monthly, or send tips.{' '}
            <br/>
            All powered by <span className="bg-yellow-200/40 dark:bg-yellow-900/40 text-foreground px-1 py-0.5 font-medium">
              USDC on <Link href="https://www.arc.network/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Arc</Link>
            </span>.
          </p>

          {/* Bloby Introduction Section */}
          <div className="relative max-w-5xl mx-auto mb-16">
            <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
              <div className="relative flex flex-col md:flex-row items-center gap-8 p-8 md:p-10">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                  <BlobAvatar
                    className="h-28 w-28 md:h-36 md:w-36 relative z-10"
                    size={144}
                  />
                </div>
                <div className="flex-1 text-center md:text-left space-y-4">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h3 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      Meet Bloby
                    </h3>
                    <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    Each creator has their own <span className="font-semibold text-foreground">Bloby</span> representing them. Bloby is your AI assistant that helps you discover content, answer questions, and handle all payment transactions seamlessly.
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-border/50 shadow-sm">
                      <MessageCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">AI Chat Assistant</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-border/50 shadow-sm">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Content Discovery</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-border/50 shadow-sm">
                      <Wallet className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Payment Handling</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground pt-2">
                    💡 <span className="font-medium">Tip:</span> Click creator's Bloby to start chatting!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Creators Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}

            {creators.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground mb-4">No creators available yet.</p>
                  <Button asChild>
                    <Link href="/creator">Become a creator →</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span>Powered by Arc Network</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Payments in USDC • Secure & Decentralized
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

