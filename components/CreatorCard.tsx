'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Users, Heart, Wallet, Crown } from 'lucide-react';
import { BlobAvatar } from '@/components/BlobAvatar';
import { CreatorChatButton } from '@/components/CreatorChatButton';
import type { Creator } from '@/types';

interface CreatorCardProps {
  creator: Creator;
}

export function CreatorCard({ creator }: CreatorCardProps) {
  const [showBlobbyTooltip, setShowBlobbyTooltip] = useState(false);

  return (
    <Card className="group gradient-card-hover overflow-visible relative">
      <CardHeader className="pb-3 relative overflow-visible">
        <div className="absolute top-7 left-68 z-50">
          <CreatorChatButton
            creatorId={creator.id}
            creatorName={creator.name}
            creatorUsername={creator.username}
          />
        </div>
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
          <div
            className="relative cursor-pointer hover:scale-110 transition-transform duration-200"
            onClick={() => {
              window.location.href = `/creator/${creator.username}?chat=true`;
            }}
            onMouseEnter={() => setShowBlobbyTooltip(true)}
            onMouseLeave={() => setShowBlobbyTooltip(false)}
          >
            <BlobAvatar
              className="h-20 w-20"
              size={70}
            />
            {showBlobbyTooltip && (
              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-foreground text-background rounded-lg shadow-lg text-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 z-[60]">
                Chat with {creator.name.split(' ')[0]}'s Bloby
                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
              </div>
            )}
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
              <span className="font-semibold text-primary">
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
  );
}

