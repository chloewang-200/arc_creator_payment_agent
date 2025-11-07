'use client';

import type { Post, SitePricing } from '@/types';
import { AvatarOverlay } from './AvatarOverlay';
import { Card } from '@/components/ui/card';
import { Lock, Sparkles } from 'lucide-react';

interface PaywallBlockProps {
  post: Post;
  pricing: SitePricing;
  creatorId?: string;
  creatorAddress?: `0x${string}`;
  onUnlock: () => void;
  onMonthly: () => void;
}

export function PaywallBlock({ post, pricing, creatorId, creatorAddress, onUnlock, onMonthly }: PaywallBlockProps) {
  return (
    <div className="relative">
      <Card className="border-dashed border-2 border-border/50 bg-muted/30 backdrop-blur-sm">
        <div className="blur-sm select-none pointer-events-none min-h-[300px] flex items-center justify-center">
          <div className="text-center py-12 px-6">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 mb-3">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <p className="text-lg font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Premium Content
              </p>
            </div>
            <p className="text-sm text-muted-foreground/60 font-medium">Unlock to read the full post</p>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <AvatarOverlay
            postId={post.id}
            postTitle={post.title}
            postPriceUSD={post.priceUSD}
            monthlyUSD={pricing.monthlyUSD}
            creatorId={creatorId}
            creatorAddress={creatorAddress}
            onUnlock={onUnlock}
            onMonthly={onMonthly}
          />
        </div>
      </Card>
    </div>
  );
}
