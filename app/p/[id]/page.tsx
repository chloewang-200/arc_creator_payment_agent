'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { posts } from '@/data/posts';
import { creators } from '@/data/creators';
import { defaultPricing } from '@/data/pricing';
import { PaywallBlock } from '@/components/PaywallBlock';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { UnlockAnimation } from '@/components/UnlockAnimation';
import { CreatorAgent } from '@/components/CreatorAgent';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, User } from 'lucide-react';
import type { Post, SitePricing } from '@/types';

export default function PostPage() {
  const params = useParams();
  const postId = params.id as string;
  const { address, isConnected } = useAccount();
  const [post, setPost] = useState<Post | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessReason, setAccessReason] = useState<string>('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [pricing, setPricing] = useState<SitePricing>(defaultPricing);
  const [creator, setCreator] = useState(creators[0]);

  useEffect(() => {
    const foundPost = posts.find((p) => p.id === postId);
    if (foundPost) {
      setPost(foundPost);
      const foundCreator = creators.find((c) => c.id === foundPost.creatorId);
      if (foundCreator) {
        setCreator(foundCreator);
        setPricing(foundCreator.pricing);
      }
    }
  }, [postId]);

  // Check access from database
  useEffect(() => {
    const checkAccess = async () => {
      if (!post) return;

      // Free posts are always accessible
      if (post.priceUSD === 0) {
        setHasAccess(true);
        setAccessReason('free');
        setIsCheckingAccess(false);
        return;
      }

      // If not logged in, locked
      if (!isConnected || !address) {
        setHasAccess(false);
        setAccessReason('not_logged_in');
        setIsCheckingAccess(false);
        return;
      }

      setIsCheckingAccess(true);
      try {
        const response = await fetch(
          `/api/unlocks/check?postId=${post.id}&walletAddress=${address}`
        );
        const data = await response.json();
        setHasAccess(data.hasAccess || false);
        setAccessReason(data.reason || 'locked');
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
        setAccessReason('error');
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkAccess();
  }, [post, address, isConnected]);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Post not found</h1>
            <p className="text-muted-foreground mb-4">The post you're looking for doesn't exist.</p>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasSubscription = accessReason === 'subscription';

  const handleUnlock = () => {
    // Re-check access after successful payment
    if (address && post) {
      fetch(`/api/unlocks/check?postId=${post.id}&walletAddress=${address}`)
        .then(res => res.json())
        .then(data => {
          setHasAccess(data.hasAccess || false);
          setAccessReason(data.reason || 'locked');
        });
    }
  };

  const handleMonthly = () => {
    // Re-check access after successful payment
    handleUnlock();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>
        </Button>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                {post.title}
              </h1>
              
              <div className="flex items-center gap-3 mb-6">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{creator.name}</div>
                  <div className="text-xs text-muted-foreground">Creator</div>
                </div>
                {hasSubscription && <SubscriptionBadge />}
              </div>

              <Separator className="mb-6" />
            </div>

            {/* Free Intro */}
            <div className="prose prose-slate max-w-none mb-8">
              <div className="text-lg leading-relaxed text-foreground/90">
                {post.intro}
              </div>
            </div>

            {/* Locked Content or Unlocked Body */}
            {isCheckingAccess ? (
              <div className="text-center py-8 text-muted-foreground">
                Checking access...
              </div>
            ) : hasAccess ? (
              <UnlockAnimation>
                <div className="prose prose-slate max-w-none">
                  <Separator className="my-8" />
                  <div className="text-lg leading-relaxed text-foreground/90 whitespace-pre-line">
                    {post.body}
                  </div>
                </div>
              </UnlockAnimation>
            ) : (
              <PaywallBlock
                post={post}
                pricing={pricing}
                onUnlock={handleUnlock}
                onMonthly={handleMonthly}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <CreatorAgent creatorName={creator.name} creatorId={creator.id} />
    </div>
  );
}
