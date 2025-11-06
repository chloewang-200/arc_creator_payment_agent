'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { defaultPricing } from '@/data/pricing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { CreatorAgent } from '@/components/CreatorAgent';
import { PaywallBlock } from '@/components/PaywallBlock';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { UnlockAnimation } from '@/components/UnlockAnimation';
import { PaymentFlowInfo } from '@/components/PaymentFlowInfo';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ArrowLeft, Users, Wallet, FileText, Headphones, Video, Heart, Crown, Sparkles, Loader2 } from 'lucide-react';
import type { Creator, Post, SitePricing, PaymentIntent } from '@/types';

export default function CreatorPage() {
  const params = useParams();
  const creatorId = params.id as string;
  const { address, isConnected } = useAccount();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [creatorPosts, setCreatorPosts] = useState<Post[]>([]);
  const [postAccess, setPostAccess] = useState<Record<string, boolean>>({});
  const [hasSubscription, setHasSubscription] = useState(false);
  const [pricing, setPricing] = useState<SitePricing>(defaultPricing);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(null);

  useEffect(() => {
    const loadCreatorAndPosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to load creator profile by username first, then by ID (UUID)
        // This handles both /creator/alex-creator and /creator/uuid-here
        let profileResponse = await fetch(`/api/creators/profile?username=${encodeURIComponent(creatorId)}`);
        
        // If username lookup fails, try ID lookup (in case it's a UUID)
        if (!profileResponse.ok && creatorId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          profileResponse = await fetch(`/api/creators/profile?id=${encodeURIComponent(creatorId)}`);
        }

        if (!profileResponse.ok) {
          setError('Creator not found');
          setIsLoading(false);
          return;
        }

        const profileData = await profileResponse.json();

        if (profileData.creator) {
          // Merge pricing into creator object for easier access
          const creatorWithPricing = {
            ...profileData.creator,
            pricing: profileData.pricing || defaultPricing,
          };
          setCreator(creatorWithPricing);
          if (profileData.pricing) {
            setPricing(profileData.pricing);
          } else {
            setPricing(defaultPricing);
          }

          // Load posts by creator ID
          const postsResponse = await fetch(`/api/posts?creatorId=${profileData.creator.id}`);

          if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            if (postsData.posts) {
              setCreatorPosts(postsData.posts);
            }
          }
        }
      } catch (err) {
        console.error('Error loading creator:', err);
        setError('Failed to load creator');
      } finally {
        setIsLoading(false);
      }
    };

    loadCreatorAndPosts();
  }, [creatorId]);

  // Check access for all posts from database
  useEffect(() => {
    const checkPostAccess = async () => {
      if (creatorPosts.length === 0) return;

      // If not logged in, all paid posts are locked
      if (!isConnected || !address) {
        const access: Record<string, boolean> = {};
        creatorPosts.forEach(post => {
          access[post.id] = post.priceUSD === 0; // Only free posts accessible
        });
        setPostAccess(access);
        setHasSubscription(false);
        return;
      }

      // Check access for each post
      try {
        const accessChecks = await Promise.all(
          creatorPosts.map(async (post) => {
            // Free posts always accessible
            if (post.priceUSD === 0) {
              return { postId: post.id, hasAccess: true, isSubscription: false };
            }

            const response = await fetch(
              `/api/unlocks/check?postId=${post.id}&walletAddress=${address}`
            );
            const data = await response.json();
            return {
              postId: post.id,
              hasAccess: data.hasAccess || false,
              isSubscription: data.reason === 'subscription',
            };
          })
        );

        const access: Record<string, boolean> = {};
        let hasSub = false;
        accessChecks.forEach(({ postId, hasAccess, isSubscription }) => {
          access[postId] = hasAccess;
          if (isSubscription) hasSub = true;
        });

        setPostAccess(access);
        setHasSubscription(hasSub);
      } catch (error) {
        console.error('Error checking post access:', error);
        // On error, lock all paid posts
        const access: Record<string, boolean> = {};
        creatorPosts.forEach(post => {
          access[post.id] = post.priceUSD === 0;
        });
        setPostAccess(access);
      }
    };

    checkPostAccess();
  }, [creatorPosts, address, isConnected]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Creator not found</h1>
            <p className="text-muted-foreground mb-4">{error || "This creator doesn't exist."}</p>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'podcast':
        return <Headphones className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const handleUnlock = () => {
    // Re-check access after successful payment
    if (address && creatorPosts.length > 0) {
      Promise.all(
        creatorPosts.map(async (post) => {
          if (post.priceUSD === 0) return { postId: post.id, hasAccess: true };
          const response = await fetch(`/api/unlocks/check?postId=${post.id}&walletAddress=${address}`);
          const data = await response.json();
          return { postId: post.id, hasAccess: data.hasAccess || false };
        })
      ).then((results) => {
        const access: Record<string, boolean> = {};
        results.forEach(({ postId, hasAccess }) => {
          access[postId] = hasAccess;
        });
        setPostAccess(access);
      });
    }
  };

  const handleMonthly = () => {
    // Re-check access after successful payment
    handleUnlock();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to creators
          </Link>
        </Button>

        {/* Payment Flow Info */}
        <PaymentFlowInfo className="mb-6" />

        {/* Creator Profile Header */}
        <Card className="mb-8 border-primary/20">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-36 w-36 border-4 border-primary/20">
                {creator.avatar && (
                  <AvatarImage src={creator.avatar} alt={creator.name} />
                )}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-2xl font-bold">
                  {creator.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{creator.name}</h1>
                  {!creator.hasContent && (
                    <Badge variant="secondary">
                      <Heart className="w-3 h-3 mr-1" />
                      Tips Only
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mb-4">@{creator.username}</p>
                {creator.bio && (
                  <p className="text-foreground/80 leading-relaxed">{creator.bio}</p>
                )}
                {creator.stats && (
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{creator.stats.followers?.toLocaleString() || 0} followers</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="w-4 h-4" />
                      <span>${(creator.stats.totalEarnings || 0).toLocaleString()} earned</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support This Creator - Always shown first for all creators */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Support This Creator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {creator.pricing?.tipPresetsUSD && creator.pricing.tipPresetsUSD.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {creator.pricing.tipPresetsUSD.map((tip) => (
                    <Button
                      key={tip}
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      onClick={() => {
                        setSelectedIntent({
                          kind: 'tip',
                          amountUSD: tip,
                          creatorId: creator.id,
                          creatorAddress: creator.walletAddress as `0x${string}`,
                        });
                      }}
                    >
                      <Heart className="w-4 h-4" />
                      ${tip}
                    </Button>
                  ))}
                </div>
              )}
              {/* Recurring Support - Always show for all creators */}
              <div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Recurring Support
                  </h3>
                  <Button
                    variant="default"
                    size="lg"
                    className="gap-2"
                    onClick={() => {
                      const recurringAmount = creator.pricing?.recurringTipUSD || 10;
                      setSelectedIntent({
                        kind: 'recurringTip',
                        amountUSD: recurringAmount,
                        creatorId: creator.id,
                        creatorAddress: creator.walletAddress as `0x${string}`,
                      });
                    }}
                  >
                    <Crown className="w-4 h-4" />
                    ${creator.pricing?.recurringTipUSD || 10}/month
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Cancel anytime. Support this creator monthly.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Section */}
        {creator.hasContent && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Content</h2>
              {creator.pricing?.monthlyUSD && creator.pricing.monthlyUSD > 0 && (
                <Badge variant="secondary" className="gap-2">
                  <Crown className="w-3 h-3" />
                  ${creator.pricing.monthlyUSD}/month unlocks all
                </Badge>
              )}
            </div>

            {creatorPosts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No content available yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {creatorPosts.map((post) => {
                  const unlocked = postAccess[post.id] || false;
                  return (
                    <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getContentIcon(post.contentType)}
                              <Badge variant="outline" className="text-xs">
                                {post.contentType}
                              </Badge>
                              {hasSubscription && <SubscriptionBadge />}
                            </div>
                            <CardTitle className="text-xl mb-2">{post.title}</CardTitle>
                            <CardDescription className="line-clamp-2">
                              {post.intro}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            ${post.priceUSD.toFixed(2)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {unlocked ? (
                          <UnlockAnimation>
                            <div className="prose prose-slate max-w-none">
                              <Separator className="my-4" />
                              <div className="text-foreground/90 leading-relaxed whitespace-pre-line">
                                {post.body}
                              </div>
                            </div>
                          </UnlockAnimation>
                        ) : (
                          <PaywallBlock
                            post={post}
                            pricing={pricing}
                            creatorId={creator.id}
                            creatorAddress={creator.walletAddress}
                            onUnlock={handleUnlock}
                            onMonthly={handleMonthly}
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <CreatorAgent creatorName={creator.name} creatorId={creator.id} />

      {selectedIntent && (
        <CheckoutModal
          intent={selectedIntent}
          onClose={() => setSelectedIntent(null)}
          onSuccess={() => {
            setSelectedIntent(null);
            // Reload access state
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

