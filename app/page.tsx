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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Users, TrendingUp, Heart, Wallet, Crown, Loader2 } from 'lucide-react';
import type { Creator } from '@/types';

export default function Home() {
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
                  Arc Creator
                </h1>
                <p className="text-xs text-muted-foreground">Creator Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore creators, unlock premium content, subscribe monthly, or send tips.{' '}
            <br/>
            All powered by <span className="bg-blue-200/60 dark:bg-yellow-900/40 text-foreground px-1 py-0.5 font-medium">
              USDC on Arc
            </span>.
          </p>
        </div>

        {/* Creators Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {creators.map((creator) => (
            <Card key={creator.id} className="group gradient-card-hover overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-28 w-28 border border-border/60 shadow-sm">
                    {creator.avatar && (
                      <AvatarImage src={creator.avatar} alt={creator.name} />
                    )}
                    <AvatarFallback className="bg-muted text-foreground text-lg font-semibold">
                      {creator.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1 font-semibold text-foreground">
                      {creator.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      @{creator.username}
                    </CardDescription>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 text-sm">
                  {creator.bio || 'No description available.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {creator.hasContent && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
                      <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                      <span className="font-semibold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                        Premium Content
                      </span>
                    </div>
                    {creator.pricing.monthlyUSD && creator.pricing.monthlyUSD > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-100/50 via-yellow-50/30 to-transparent border border-yellow-200/30">
                        <Crown className="w-3.5 h-3.5 text-yellow-600" />
                        <span className="font-semibold text-yellow-700">${creator.pricing.monthlyUSD}/mo</span>
                      </div>
                    )}
                  </div>
                )}
                
                {!creator.hasContent && (
                  <Badge variant="outline" className="w-full justify-center py-1.5">
                    <Heart className="w-3 h-3 mr-1.5" />
                    Tips Only
                  </Badge>
                )}

                {creator.stats && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      <span>{creator.stats.followers?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3 h-3" />
                      <span>${(creator.stats.totalEarnings || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <Separator />
              </CardContent>
              <div className="px-6 pb-4">
                <Button asChild className="w-full" variant="default">
                  <Link href={`/creator/${creator.username}`}>
                    View Creator
                  </Link>
                </Button>
              </div>
            </Card>
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
