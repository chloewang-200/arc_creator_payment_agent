'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { defaultPricing } from '@/data/pricing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { BlobAvatar } from '@/components/BlobAvatar';
import { Separator } from '@/components/ui/separator';
import { CreatorAgent } from '@/components/CreatorAgent';
import { PaywallBlock } from '@/components/PaywallBlock';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { UnlockAnimation } from '@/components/UnlockAnimation';
import { PaymentFlowInfo } from '@/components/PaymentFlowInfo';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ArrowLeft, Users, Wallet, FileText, Headphones, Video, Heart, Crown, Sparkles, Loader2, Volume2, Pause } from 'lucide-react';
import type { Creator, Post, SitePricing, PaymentIntent } from '@/types';

function CreatorPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const creatorId = params.id as string;
  const shouldOpenChat = searchParams.get('chat') === 'true';
  const { address, isConnected } = useAccount();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [creatorPosts, setCreatorPosts] = useState<Post[]>([]);
  const [postAccess, setPostAccess] = useState<Record<string, boolean>>({});
  const [hasSubscription, setHasSubscription] = useState(false);
  const [pricing, setPricing] = useState<SitePricing>(defaultPricing);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(null);
  const [showBlobbyTooltip, setShowBlobbyTooltip] = useState(false);
  const [audioState, setAudioState] = useState<Record<string, {
    isGenerating: boolean;
    isPlaying: boolean;
    audioUrl: string | null;
    audioElement: HTMLAudioElement | null;
  }>>({});

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

  const handleListen = async (postId: string, postContent: string, postIntro: string) => {
    if (!address) return;

    const state = audioState[postId] || { isGenerating: false, isPlaying: false, audioUrl: null, audioElement: null };

    // If audio already playing, pause it
    if (state.isPlaying && state.audioElement) {
      state.audioElement.pause();
      setAudioState({
        ...audioState,
        [postId]: { ...state, isPlaying: false },
      });
      return;
    }

    // If we already have audio, play it
    if (state.audioUrl && state.audioElement) {
      state.audioElement.play();
      setAudioState({
        ...audioState,
        [postId]: { ...state, isPlaying: true },
      });
      return;
    }

    // Generate new audio
    setAudioState({
      ...audioState,
      [postId]: { ...state, isGenerating: true },
    });

    try {
      const response = await fetch(
        `/api/posts/${postId}/audio?walletAddress=${address}`
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to generate audio');
        return;
      }

      // Create blob URL from response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Create audio element
      const audio = new Audio(url);
      audio.addEventListener('ended', () => {
        setAudioState(prev => ({
          ...prev,
          [postId]: { ...prev[postId], isPlaying: false },
        }));
      });
      audio.addEventListener('pause', () => {
        setAudioState(prev => ({
          ...prev,
          [postId]: { ...prev[postId], isPlaying: false },
        }));
      });
      audio.addEventListener('play', () => {
        setAudioState(prev => ({
          ...prev,
          [postId]: { ...prev[postId], isPlaying: true },
        }));
      });

      // Play audio
      await audio.play();

      setAudioState({
        ...audioState,
        [postId]: {
          isGenerating: false,
          isPlaying: true,
          audioUrl: url,
          audioElement: audio,
        },
      });
    } catch (error) {
      console.error('Error generating audio:', error);
      alert('Failed to generate audio. Please try again.');
      setAudioState({
        ...audioState,
        [postId]: { ...state, isGenerating: false },
      });
    }
  };

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/?tab=fans">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to creators
          </Link>
        </Button>

        {/* Payment Flow Info */}
        <PaymentFlowInfo className="mb-6" />

        {/* Creator Profile Header */}
        <Card className="mb-8 gradient-card-hover border border-border/60 relative overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-36 w-36 border border-border/60 shadow-sm">
                {creator.avatar && (
                  <AvatarImage src={creator.avatar} alt={creator.name} />
                )}
                <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold">
                  {creator.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-3xl font-bold text-foreground">{creator.name}</h1>
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
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative cursor-pointer hover:scale-110 transition-transform duration-200"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('chat', 'true');
                    window.location.href = url.toString();
                  }}
                  onMouseEnter={() => setShowBlobbyTooltip(true)}
                  onMouseLeave={() => setShowBlobbyTooltip(false)}
                >
                  <BlobAvatar
                    className="h-36 w-36"
                    size={144}
                  />
                  {showBlobbyTooltip && (
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-foreground text-background rounded-lg shadow-lg text-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 z-[60]">
                      Chat with {creator.name.split(' ')[0]}'s Bloby
                      <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
                    </div>
                  )}
                </div>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity group"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('chat', 'true');
                    window.location.href = url.toString();
                  }}
                >
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Talk to {creator.name.split(' ')[0]}'s agent Bloby
                  </span>
                </div>
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
                              {/* Listen Button */}
                              <div className="not-prose mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                  <Button
                                    onClick={() => handleListen(post.id, post.body, post.intro)}
                                    disabled={audioState[post.id]?.isGenerating}
                                    variant="outline"
                                    className="gap-2"
                                  >
                                    {audioState[post.id]?.isGenerating ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating audio...
                                      </>
                                    ) : audioState[post.id]?.isPlaying ? (
                                      <>
                                        <Pause className="w-4 h-4" />
                                        Pause
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-4 h-4" />
                                        Listen to this post
                                      </>
                                    )}
                                  </Button>
                                  {audioState[post.id]?.audioUrl && !audioState[post.id]?.isGenerating && (
                                    <span className="text-sm text-muted-foreground">
                                      {creator.name}'s voice
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-amber-600">
                                  ⚠️ Demo limitation: Only first ~5 seconds as using ElevenLabs starter tier. Thanks for not spamming! :)
                                </p>
                              </div>

                              {post.voicePreviewUrl && (
                                <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <Headphones className="w-4 h-4" />
                                    Listen to a {Math.min(10, post.voicePreviewDurationSeconds || 10)}s AI narration
                                  </div>
                                  <audio controls preload="none" className="w-full mt-2" src={post.voicePreviewUrl}>
                                    Your browser does not support audio playback.
                                  </audio>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Generated from {creator.name}'s voice sample via ElevenLabs.
                                  </p>
                                </div>
                              )}
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
                            creatorName={creator.name}
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

      <CreatorAgent creatorName={creator.name} creatorId={creator.id} autoOpen={shouldOpenChat} />

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

export default function CreatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading creator page...</p>
        </div>
      </div>
    }>
      <CreatorPageContent />
    </Suspense>
  );
}
