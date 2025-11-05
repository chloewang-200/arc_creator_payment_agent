'use client';

import type { Post, SitePricing } from '@/types';
import { AvatarOverlay } from './AvatarOverlay';
import { Card } from '@/components/ui/card';
import { Lock } from 'lucide-react';

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
            <p className="text-lg font-semibold mb-2 text-muted-foreground/70">Premium Content</p>
            <p className="text-sm text-muted-foreground/60">Unlock to read the full post</p>
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
