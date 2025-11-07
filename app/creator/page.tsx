'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { posts } from '@/data/posts';
import { defaultPricing } from '@/data/pricing';
import { UniversalBalance } from '@/components/UniversalBalance';
import { PlatformEarnings } from '@/components/PlatformEarnings';
import { ConsolidateBalance } from '@/components/ConsolidateBalance';
import { CreatorAuthGuard } from '@/components/CreatorAuthGuard';
import { TransactionLog } from '@/components/TransactionLog';
import { PendingRefunds } from '@/components/PendingRefunds';
import { PrivyRefundWalletSetup } from '@/components/PrivyRefundWalletSetup';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/lib/auth-context';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft, Plus, Edit2, ExternalLink, DollarSign, Settings, User, Wallet, Heart,
  LogOut, TrendingUp, Users, FileText, Sparkles, BarChart3, CreditCard, Loader2,
  Mic, Headphones, Circle, Square, Copy
} from 'lucide-react';
import type { Post, SitePricing, Creator } from '@/types';

function CreatorDashboardContent() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { address: connectedAddress, isConnected } = useAccount();
  const [postsList, setPostsList] = useState<Post[]>(posts);
  const [pricing, setPricing] = useState<SitePricing>(defaultPricing);
  const [profile, setProfile] = useState<Partial<Creator>>({
    name: 'My Creator Name',
    username: 'my-creator',
    bio: 'Enter your bio here...',
    walletAddress: undefined,
    hasContent: true,
    avatar: '/images/avatars/creator1.jpg',
    voicePreviewEnabled: false,
    voiceCloneStatus: 'missing',
  });
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<Partial<Post>>({
    title: '',
    intro: '',
    body: '',
    priceUSD: 0.69,
    contentType: 'post',
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'settings' | 'transactions'>('overview');
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tempProfile, setTempProfile] = useState<Partial<Creator>>(profile);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState<string | null>(null);
  const [generatingPreviewPostId, setGeneratingPreviewPostId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [voiceScriptCopied, setVoiceScriptCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);
  const voicePreviewsEnabled =
    (tempProfile.voicePreviewEnabled ?? profile.voicePreviewEnabled) ?? false;
  const MAX_VOICE_SECONDS = 10;
  const sampleVoiceScript = `Hey, thanks for supporting my work on Arc! I'm testing my voice so you can hear short previews of my posts. Expect nerdy deep dives, honest takes, and plenty of practical tips. Appreciate you listening!`;

  useEffect(() => {
    return () => {
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl);
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [recordedPreviewUrl]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/creator/login');
    }
  }, [authLoading, user, router]);

  // Load profile and posts from database by email
  useEffect(() => {
    if (!user?.email || authLoading) return;

    const loadProfileAndPosts = async () => {
      setIsLoadingProfile(true);
      try {
        // Load profile
        if (!user.email) {
          console.error('User email not available');
          return;
        }
        const profileResponse = await fetch(`/api/creators/profile?email=${encodeURIComponent(user.email)}`);

        if (profileResponse.ok) {
          const data = await profileResponse.json();
          if (data.creator) {
            setProfile(data.creator);
            setTempProfile(data.creator);
            if (data.pricing) {
              setPricing({
                ...defaultPricing,
                ...data.pricing,
                refundConversationThreshold: data.pricing.refundConversationThreshold ?? 3,
                refundAutoThresholdUSD: data.pricing.refundAutoThresholdUSD ?? 1.00,
                refundContactEmail: data.pricing.refundContactEmail ?? null,
              });
            }
          }
        }

        // Load posts
        const postsResponse = await fetch(`/api/posts?creatorEmail=${encodeURIComponent(user.email)}`);
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          if (postsData.posts) {
            setPostsList(postsData.posts);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfileAndPosts();
  }, [user, authLoading]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/creator/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const savePricing = (updatedPricing: SitePricing) => {
    setPricing(updatedPricing);
    setHasUnsavedChanges(true); // Pricing is saved with profile
  };

  // Handle field changes (doesn't save immediately)
  const handleProfileChange = (updates: Partial<Creator>) => {
    setTempProfile({ ...tempProfile, ...updates });
    setHasUnsavedChanges(true);
  };

  const resetRecording = () => {
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
    }
    setRecordedBlob(null);
    setRecordedPreviewUrl(null);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
    setRecordingError(null);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const startRecording = async () => {
    if (isRecording) return;
    setRecordingError(null);
    resetRecording();

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setRecordingError('Could not capture audio. Please try again.');
          return;
        }
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedPreviewUrl(url);
        setRecordingDuration((prev) => (prev === 0 ? recordingDurationRef.current : prev));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = Math.min(MAX_VOICE_SECONDS, prev + 1);
          recordingDurationRef.current = next;
          if (next >= MAX_VOICE_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (error: unknown) {
      console.error('Failed to start recording:', error);
      setRecordingError((error as Error)?.message || 'Microphone permission denied.');
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleVoiceUpload = async (file: Blob, durationSeconds?: number) => {
    if (!profile.id) {
      alert('Please save your profile first before uploading a voice sample.');
      return;
    }

    setIsUploadingVoice(true);
    setVoiceStatusMessage(null);

    try {
      const formData = new FormData();
      const fileName = file instanceof File ? (file.name || 'voice-sample.webm') : 'recorded-voice.webm';
      const mimeType = file.type || 'audio/webm';
      const uploadFile = file instanceof File ? file : new File([file], fileName, { type: mimeType });

      formData.append('creatorId', profile.id);
      formData.append('voiceSample', uploadFile);
      if (durationSeconds !== undefined) {
        formData.append('durationSeconds', String(durationSeconds));
      }

      const response = await fetch('/api/creators/voice', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload voice sample');
      }

      setProfile((prev) => ({
        ...prev,
        voiceSampleUrl: data.voiceSampleUrl,
        voiceSampleDurationSeconds: data.durationSeconds,
        voicePreviewEnabled: true,
        voiceCloneStatus: 'ready',
        elevenLabsVoiceId: data.elevenLabsVoiceId,
      }));
      setTempProfile((prev) => ({
        ...prev,
        voiceSampleUrl: data.voiceSampleUrl,
        voiceSampleDurationSeconds: data.durationSeconds,
        voicePreviewEnabled: true,
        voiceCloneStatus: 'ready',
        elevenLabsVoiceId: data.elevenLabsVoiceId,
      }));

      setVoiceStatusMessage('Voice sample synced! Click Save to keep previews enabled.');
      if (recordedBlob) {
        resetRecording();
      }
    } catch (error: unknown) {
      console.error('Voice upload failed:', error);
      setVoiceStatusMessage((error as Error)?.message || 'Failed to upload voice sample.');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Save profile to database (called when Save button is clicked)
  const saveProfile = async () => {
    if (!user?.email) {
      console.error('No user email found');
      return;
    }

    setIsSaving(true);
    setProfile(tempProfile);

    // Save to database
    try {
      const response = await fetch('/api/creators/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          walletAddress: tempProfile.walletAddress || '0xB518B94b8496497B33Bf5357844184fCeA8aB926', // Alex Creator's wallet
          username: tempProfile.username || 'my-creator',
          name: tempProfile.name || 'My Creator',
          bio: tempProfile.bio,
          avatar: tempProfile.avatar,
          aiTone: tempProfile.aiTone,
          aiPersonality: tempProfile.aiPersonality,
          aiBackground: tempProfile.aiBackground,
          voicePreviewEnabled: tempProfile.voicePreviewEnabled ?? false,
          voiceSampleUrl: tempProfile.voiceSampleUrl,
          voiceSampleDurationSeconds: tempProfile.voiceSampleDurationSeconds,
          voiceCloneStatus: tempProfile.voiceCloneStatus,
          elevenLabsVoiceId: tempProfile.elevenLabsVoiceId,
          pricing: pricing,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save to database');
      }

      // Show saved feedback
      setShowSavedMessage(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setShowSavedMessage(false), 2000);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePrice = async (postId: string, newPrice: number) => {
    try {
      const response = await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          priceUSD: newPrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update price');
      }

      // Update local state
      const updated = postsList.map((p) =>
        p.id === postId ? { ...p, priceUSD: newPrice } : p
      );
      setPostsList(updated);
      setEditingPost(null);
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price. Please try again.');
    }
  };

  const handleGenerateVoicePreview = async (postId: string) => {
    if (!voicePreviewsEnabled) {
      alert('Enable voice previews and upload a sample before generating audio.');
      return;
    }

    setGeneratingPreviewPostId(postId);
    try {
      const response = await fetch('/api/posts/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate preview audio');
      }

      setPostsList((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                voicePreviewUrl: data.previewUrl,
                voicePreviewStatus: 'ready',
                voicePreviewDurationSeconds: data.durationSeconds,
              }
            : post
        )
      );
    } catch (error: unknown) {
      console.error('Failed to generate voice preview:', error);
      alert((error as Error)?.message || 'Failed to generate voice preview');
    } finally {
      setGeneratingPreviewPostId(null);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.intro || !newPost.body) {
      alert('Please fill in all fields');
      return;
    }

    if (!user?.email) {
      alert('You must be logged in to create a post');
      return;
    }

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorEmail: user.email,
          title: newPost.title,
          intro: newPost.intro,
          content: newPost.body,
          priceUSD: newPost.priceUSD || 0.69,
          contentType: newPost.contentType || 'post',
          includedInSubscription: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      const data = await response.json();

      // Add to local state
      setPostsList([...postsList, data.post]);
      setNewPost({ title: '', intro: '', body: '', priceUSD: 0.69, contentType: 'post' });
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    }
  };

  const totalEarnings = profile.stats?.totalEarnings || 0;
  const totalFollowers = profile.stats?.followers || 0;
  const totalPosts = postsList.length;

  // Show loading while auth or profile is loading
  if (authLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Don't render if no user (redirect will happen via useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Professional subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-100/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild size="sm">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-blue-100">
                  {profile.avatar && (
                    <AvatarImage src={profile.avatar} alt={profile.name} />
                  )}
                  <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold">
                    {profile.name?.split(' ').map(n => n[0]).join('') || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{profile.name || 'Creator'}</div>
                  <div className="text-xs text-slate-500">@{profile.username}</div>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Professional blue accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600"></div>
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total Earnings</p>
                  <p className="text-2xl font-bold text-slate-900">${totalEarnings.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Followers</p>
                  <p className="text-2xl font-bold text-slate-900">{totalFollowers.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total Posts</p>
                  <p className="text-2xl font-bold text-slate-900">{totalPosts}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <FileText className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">This Month</p>
                  <p className="text-2xl font-bold text-slate-900">${(totalEarnings * 0.15).toFixed(0)}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Connection for Consolidation */}
        {profile.walletAddress && (
          <Card className="mb-6 bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Wallet className="w-5 h-5 text-blue-600" />
                Connect Wallet for Consolidation
              </CardTitle>
              <CardDescription className="text-slate-600">
                Connect your creator wallet ({profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}) to consolidate balances from all chains to Arc Network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  {isConnected ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Wallet Connected</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)}
                      </div>
                      {connectedAddress?.toLowerCase() !== profile.walletAddress.toLowerCase() && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          ⚠️ Connected wallet doesn't match creator address. Please connect the correct wallet.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Connect your wallet to consolidate balances
                    </div>
                  )}
                </div>
                <WalletConnectButton />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Cards */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ErrorBoundary>
            {profile.id ? (
              <PlatformEarnings creatorId={profile.id} />
            ) : (
              <UniversalBalance creatorAddress={profile.walletAddress} />
            )}
          </ErrorBoundary>
          {profile.walletAddress && (
            <ErrorBoundary>
              <ConsolidateBalance
                creatorAddress={profile.walletAddress}
                creatorId={profile.id}
                onConsolidationComplete={() => {
                  // Refresh the page or trigger a balance refresh
                  window.location.reload();
                }}
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-slate-200">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('overview')}
              className={`rounded-b-none ${activeTab === 'overview' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              Overview
            </Button>
            <Button
              variant={activeTab === 'content' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('content')}
              className={`rounded-b-none ${activeTab === 'content' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              Content
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('settings')}
              className={`rounded-b-none ${activeTab === 'settings' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              Settings
            </Button>
            <Button
              variant={activeTab === 'transactions' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('transactions')}
              className={`rounded-b-none ${activeTab === 'transactions' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              Transactions
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Quick Actions</CardTitle>
                <CardDescription className="text-slate-600">Common tasks for managing your creator profile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300" onClick={() => setActiveTab('content')}>
                    <Plus className="w-6 h-6" />
                    <span>Create New Post</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300" onClick={() => setActiveTab('settings')}>
                    <Settings className="w-6 h-6" />
                    <span>Update Settings</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300" asChild>
                    <Link href={`/creator/${profile.username || 'my-creator'}`} target="_blank">
                      <ExternalLink className="w-6 h-6" />
                      <span>View Profile</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Create New Post */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Plus className="w-5 h-5 text-blue-600" />
                  Create New Post
                </CardTitle>
                <CardDescription className="text-slate-600">Add a new premium post to your collection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Post Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter post title"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contentType">Content Type</Label>
                    <select
                      id="contentType"
                      value={newPost.contentType || 'post'}
                      onChange={(e) => setNewPost({ ...newPost, contentType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="post">Post</option>
                      <option value="podcast">Podcast</option>
                      <option value="video">Video</option>
                      <option value="article">Article</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro">Intro (Free Preview)</Label>
                  <Textarea
                    id="intro"
                    placeholder="This is the free portion that everyone can see..."
                    value={newPost.intro}
                    onChange={(e) => setNewPost({ ...newPost, intro: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Body (Locked Content)</Label>
                  <Textarea
                    id="body"
                    placeholder="This is the premium content that requires payment..."
                    value={newPost.body}
                    onChange={(e) => setNewPost({ ...newPost, body: e.target.value })}
                    rows={6}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="price">Price (USDC)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        placeholder="0.69"
                        value={newPost.priceUSD}
                        onChange={(e) =>
                          setNewPost({ ...newPost, priceUSD: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreatePost} className="gap-2 mt-6 bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="w-4 h-4" />
                    Create {newPost.contentType || 'Post'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Existing Posts */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Your Posts</CardTitle>
                <CardDescription className="text-slate-600">Manage your published content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {postsList.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No posts yet. Create your first post above!</p>
                    </div>
                  ) : (
                    postsList.map((post) => (
                      <Card key={post.id} className="bg-slate-50 border-slate-200">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold text-lg">{post.title}</h3>
                                {editingPost === post.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={post.priceUSD}
                                      className="w-20 h-8"
                                      onBlur={(e) => handleUpdatePrice(post.id, parseFloat(e.target.value) || post.priceUSD)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleUpdatePrice(post.id, parseFloat(e.currentTarget.value) || post.priceUSD);
                                        } else if (e.key === 'Escape') {
                                          setEditingPost(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingPost(null)}
                                    >
                                      ✓
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant="secondary" className="shrink-0">
                                    ${post.priceUSD.toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.intro}</p>
                              <div className="flex items-center gap-4">
                                {editingPost !== post.id && (
                                  <Button
                                    onClick={() => setEditingPost(post.id)}
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Edit Price
                                  </Button>
                                )}
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/p/${post.id}`} target="_blank" className="gap-2">
                                    <ExternalLink className="w-3 h-3" />
                                    View Post
                                  </Link>
                                </Button>
                              </div>
                              <div className="mt-4 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold flex items-center gap-2 text-blue-900">
                                      <Headphones className="w-4 h-4" />
                                      10-second AI voice preview
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Status: {post.voicePreviewStatus || 'missing'}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="gap-2"
                                    disabled={!voicePreviewsEnabled || generatingPreviewPostId === post.id}
                                    onClick={() => handleGenerateVoicePreview(post.id)}
                                  >
                                    {generatingPreviewPostId === post.id ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        {post.voicePreviewStatus === 'ready' ? 'Regenerate' : 'Generate'} audio
                                      </>
                                    )}
                                  </Button>
                                </div>
                                {!voicePreviewsEnabled && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Enable voice previews and save your profile to activate this button.
                                  </p>
                                )}
                                {post.voicePreviewUrl && (
                                  <audio controls className="w-full mt-3" src={post.voicePreviewUrl}>
                                    Your browser does not support audio playback.
                                  </audio>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Profile Settings */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <User className="w-5 h-5 text-blue-600" />
                  Profile Settings
                </CardTitle>
                <CardDescription className="text-slate-600">Manage your public profile information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={tempProfile.name || ''}
                      onChange={(e) => handleProfileChange({ name: e.target.value })}
                      placeholder="Your creator name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={tempProfile.username || ''}
                      onChange={(e) => handleProfileChange({ username: e.target.value })}
                      placeholder="my-creator"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={tempProfile.bio || ''}
                    onChange={(e) => handleProfileChange({ bio: e.target.value })}
                    placeholder="Tell your audience about yourself..."
                    rows={3}
                  />
                </div>
                
                {/* AI Customization */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <Label className="text-base font-semibold">AI Avatar Customization</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Customize how your AI avatar talks and behaves. This helps make your AI feel more like you!
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="aiTone">AI Tone</Label>
                    <Input
                      id="aiTone"
                      value={tempProfile.aiTone || ''}
                      onChange={(e) => handleProfileChange({ aiTone: e.target.value })}
                      placeholder="e.g., friendly, professional, casual, enthusiastic"
                    />
                    <p className="text-xs text-muted-foreground">How should your AI sound? (e.g., "friendly and approachable", "professional and informative")</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aiPersonality">AI Personality</Label>
                    <Textarea
                      id="aiPersonality"
                      value={tempProfile.aiPersonality || ''}
                      onChange={(e) => handleProfileChange({ aiPersonality: e.target.value })}
                      placeholder="e.g., curious, helpful, passionate about web3"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">Key personality traits for your AI</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aiBackground">Additional Background</Label>
                    <Textarea
                      id="aiBackground"
                      value={tempProfile.aiBackground || ''}
                      onChange={(e) => handleProfileChange({ aiBackground: e.target.value })}
                      placeholder="Any additional context about you, your work, or your audience that the AI should know..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Extra context to help your AI understand your brand and audience better</p>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center gap-3 pt-4">
                    <Button
                      onClick={saveProfile}
                      disabled={!hasUnsavedChanges || isSaving}
                      className="gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Save AI Settings
                        </>
                      )}
                    </Button>
                    {showSavedMessage && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                        ✓ Saved to database
                      </Badge>
                    )}
                    {hasUnsavedChanges && !showSavedMessage && (
                      <span className="text-sm text-muted-foreground">You have unsaved changes</span>
                    )}
                  </div>
                </div>

                {/* Voice previews */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <Label className="text-base font-semibold">Voice Previews (10s via ElevenLabs)</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Upload a short voice sample to let your AI voice read up to 10 seconds of each locked post for unlocked supporters.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={profile.voiceCloneStatus === 'ready' ? 'default' : 'outline'}>
                      {profile.voiceCloneStatus === 'ready' ? 'Voice ready' : 'Voice missing'}
                    </Badge>
                    {voicePreviewsEnabled && (
                      <Badge variant="secondary">Enabled for paywall</Badge>
                    )}
                  </div>
                  {profile.voiceSampleUrl && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Current voice sample</Label>
                      <audio controls className="w-full" src={profile.voiceSampleUrl}>
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Sample script for recordings</p>
                        <p className="text-xs text-muted-foreground">Read this line to keep tone and pacing consistent.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={copySampleScript}
                      >
                        <Copy className="w-3 h-3" />
                        {voiceScriptCopied ? 'Copied!' : 'Copy text'}
                      </Button>
                    </div>
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {sampleVoiceScript}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Upload new sample (max 10 MB)</Label>
                    <Input
                      type="file"
                      accept="audio/*"
                      disabled={isUploadingVoice}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleVoiceUpload(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      We only play 10 seconds per post on the free ElevenLabs tier. Clear audio works best.
                    </p>
                    {isUploadingVoice && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading & syncing with ElevenLabs...
                      </p>
                    )}
                    {voiceStatusMessage && (
                      <p className="text-xs text-blue-600">{voiceStatusMessage}</p>
                    )}
                  </div>
                  <div className="space-y-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Record directly in browser</p>
                        <p className="text-xs text-muted-foreground">Capture up to {MAX_VOICE_SECONDS} seconds and upload automatically.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={isRecording}
                        onClick={startRecording}
                      >
                        <Circle className="w-3 h-3" />
                        Start recording
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2"
                        disabled={!isRecording}
                        onClick={stopRecording}
                      >
                        <Square className="w-3 h-3" />
                        Stop
                      </Button>
                      <span className="text-sm font-mono text-blue-900">
                        {recordingDuration.toString().padStart(2, '0')}s / {MAX_VOICE_SECONDS}s
                      </span>
                    </div>
                    {recordingError && (
                      <p className="text-xs text-red-500">{recordingError}</p>
                    )}
                    {recordedBlob && recordedPreviewUrl && (
                      <div className="space-y-2">
                        <audio controls className="w-full" src={recordedPreviewUrl}>
                          Your browser does not support audio playback.
                        </audio>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={resetRecording}
                          >
                            Discard
                          </Button>
                          <Button
                            size="sm"
                            className="gap-2"
                            onClick={() => handleVoiceUpload(recordedBlob, recordingDuration || undefined)}
                            disabled={isUploadingVoice}
                          >
                            Upload recording
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="voicePreviewEnabled"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={voicePreviewsEnabled}
                      onChange={(e) => handleProfileChange({ voicePreviewEnabled: e.target.checked })}
                    />
                    <Label htmlFor="voicePreviewEnabled" className="text-sm">
                      Enable AI voice previews on locked posts
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet">Wallet Address</Label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="wallet"
                      value={profile.walletAddress || ''}
                      onChange={(e) => {
                        const updated = { ...profile, walletAddress: e.target.value as `0x${string}` };
                        setProfile(updated);
                        localStorage.setItem('creator_profile', JSON.stringify(updated));
                      }}
                      placeholder="0x..."
                      className="pl-9 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">This address will receive all payments</p>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Settings */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Pricing Settings
                </CardTitle>
                <CardDescription className="text-slate-600">Configure your subscription and tip settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly">Monthly Subscription (USDC)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        id="monthly"
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricing.monthlyUSD === null || pricing.monthlyUSD === undefined ? '' : pricing.monthlyUSD}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow empty string while typing, save as null if empty (better than 0)
                          const numValue = value === '' ? null : (parseFloat(value) || null);
                          savePricing({ ...pricing, monthlyUSD: numValue });
                        }}
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tips">Tip Presets (USDC, comma-separated)</Label>
                    <Input
                      id="tips"
                      type="text"
                      value={pricing.tipPresetsUSD.join(', ')}
                      onChange={(e) => {
                        const values = e.target.value
                          .split(',')
                          .map((v) => parseFloat(v.trim()))
                          .filter((v) => !isNaN(v));
                        savePricing({ ...pricing, tipPresetsUSD: values });
                      }}
                      placeholder="1, 2, 5"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurring" className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Recurring Tip (USDC/month)
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="recurring"
                      type="number"
                      step="0.01"
                      value={pricing.recurringTipUSD || ''}
                      onChange={(e) =>
                        savePricing({ 
                          ...pricing, 
                          recurringTipUSD: e.target.value ? parseFloat(e.target.value) : undefined 
                        })
                      }
                      className="pl-9"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Refund Settings */}
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <Label className="text-base font-semibold">Refund Settings</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure how refunds are handled. Users must meet conversation threshold before requesting refunds.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="refundThreshold">Conversation Threshold</Label>
                      <Input
                        id="refundThreshold"
                        type="number"
                        min="0"
                        step="1"
                        value={pricing.refundConversationThreshold ?? 3}
                        onChange={(e) =>
                          savePricing({ 
                            ...pricing, 
                            refundConversationThreshold: parseInt(e.target.value) || 3
                          })
                        }
                        placeholder="3"
                      />
                      <p className="text-xs text-muted-foreground">Minimum conversations before refund eligibility</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refundAutoThreshold">Auto-Refund Threshold (USDC)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="refundAutoThreshold"
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricing.refundAutoThresholdUSD ?? 1.00}
                          onChange={(e) =>
                            savePricing({ 
                              ...pricing, 
                              refundAutoThresholdUSD: parseFloat(e.target.value) || 1.00
                            })
                          }
                          className="pl-9"
                          placeholder="1.00"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Amount under which refunds are auto-processed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refundEmail">Refund Contact Email</Label>
                      <Input
                        id="refundEmail"
                        type="email"
                        value={pricing.refundContactEmail || ''}
                        onChange={(e) =>
                          savePricing({ 
                            ...pricing, 
                            refundContactEmail: e.target.value || null
                          })
                        }
                        placeholder="refunds@example.com"
                      />
                      <p className="text-xs text-muted-foreground">For refunds above threshold (optional)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* Automated Refund Wallet Setup */}
            {profile.id && profile.walletAddress && (
              <PrivyRefundWalletSetup
                creatorId={profile.id}
                creatorWallet={profile.walletAddress as `0x${string}`}
              />
            )}

            {/* Manual Pending Refunds */}
            {profile.id && profile.walletAddress && (
              <PendingRefunds
                creatorId={profile.id}
                creatorWallet={profile.walletAddress as `0x${string}`}
              />
            )}

            {/* Transaction History */}
            <TransactionLog
              creatorId={profile.id}
              walletAddress={profile.walletAddress}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatorDashboard() {
  return (
    <ErrorBoundary>
      <CreatorAuthGuard>
        <CreatorDashboardContent />
      </CreatorAuthGuard>
    </ErrorBoundary>
  );
}
  const copySampleScript = async () => {
    try {
      await navigator.clipboard.writeText(sampleVoiceScript);
      setVoiceScriptCopied(true);
      setTimeout(() => setVoiceScriptCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy sample script:', error);
    }
  };
