'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { ChainSelector } from '@/components/ChainSelector';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreatorCard } from '@/components/CreatorCard';
import { Sparkles, TrendingUp, Heart, Wallet, Loader2, MessageCircle } from 'lucide-react';
import { BlobAvatar } from '@/components/BlobAvatar';
import type { Creator } from '@/types';

export function ForFansContent() {
  const { isConnected } = useAccount();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCreators = async () => {
      try {
        const response = await fetch('/api/creators/list');
        if (response.ok) {
          const data = await response.json();
          const creatorsList = data.creators || [];
          
          // Reorder: alex-creator and sam developer first
          const priorityUsernames = ['alex-creator', 'sam-dev'];
          const sortedCreators = [...creatorsList].sort((a, b) => {
            const aIndex = priorityUsernames.indexOf(a.username);
            const bIndex = priorityUsernames.indexOf(b.username);
            
            // If both are in priority list, maintain their order
            if (aIndex !== -1 && bIndex !== -1) {
              return aIndex - bIndex;
            }
            // If only a is in priority list, a comes first
            if (aIndex !== -1) return -1;
            // If only b is in priority list, b comes first
            if (bIndex !== -1) return 1;
            // Neither is in priority list, maintain original order
            return 0;
          });
          
          setCreators(sortedCreators);
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
    <>
      {/* Hero Section */}
      <div className="text-center mb-20">
        <Badge variant="secondary" className="mb-6 px-3 py-1 text-xs">
          <TrendingUp className="w-3 h-3 mr-1.5" />
          Powered by Arc Network
        </Badge>
        <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-foreground">
          Discover Creators,<br />Support Creators
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
          Explore creators, unlock premium content (articles, music, videos), subscribe monthly, or send tips.{' '}
          <br/>
          All powered by <span className="bg-blue-200/60 dark:bg-yellow-900/40 text-foreground px-1 py-0.5 font-medium">
            USDC on <Link href="https://www.arc.network/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Arc</Link>
          </span>.
        </p>

        {/* Bloby Introduction Section */}
        <div className="relative w-full mb-16">
          <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
            <div className="relative flex flex-col md:flex-row items-center gap-8 p-8 md:p-10">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                <BlobAvatar
                  className="h-28 w-28 md:h-36 md:w-36 relative z-10"
                  size={144}
                />
              </div>
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <h3 className="text-3xl md:text-4xl font-bold text-foreground">
                    Meet Bloby
                  </h3>
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed">
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
    </>
  );
}

