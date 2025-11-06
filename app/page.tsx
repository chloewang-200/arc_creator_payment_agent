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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <TrendingUp className="w-3 h-3 mr-1" />
            Powered by Arc Network
          </Badge>
          <h2 className="text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            Discover Creators, Support Creators
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore creators, unlock premium content, subscribe monthly, or send tips. All powered by USDC on Arc.
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
            <Card key={creator.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-28 w-28 border-2 border-primary/20">
                    {creator.avatar && (
                      <AvatarImage src={creator.avatar} alt={creator.name} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-lg font-semibold">
                      {creator.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1 group-hover:text-primary transition-colors">
                      {creator.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      @{creator.username}
                    </CardDescription>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {creator.bio || 'No description available.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {creator.hasContent && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      <span>Premium Content</span>
                    </div>
                    {creator.pricing.monthlyUSD > 0 && (
                      <div className="flex items-center gap-1">
                        <Crown className="w-4 h-4" />
                        <span>${creator.pricing.monthlyUSD}/mo</span>
                      </div>
                    )}
                  </div>
                )}
                
                {!creator.hasContent && (
                  <Badge variant="outline" className="w-full justify-center">
                    <Heart className="w-3 h-3 mr-1" />
                    Tips Only
                  </Badge>
                )}

                {creator.stats && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{creator.stats.followers?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      <span>${(creator.stats.totalEarnings || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <Separator />
              </CardContent>
              <div className="px-6 pb-3">
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
      <footer className="border-t border-border/40 mt-16">
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
