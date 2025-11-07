'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, ArrowRight, Check, Zap, DollarSign, Wallet, TrendingUp, Loader2 } from 'lucide-react';
import { BlobAvatar } from '@/components/BlobAvatar';
import { ForFansContent } from '@/components/ForFansContent';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { ChainSelector } from '@/components/ChainSelector';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('creators');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'fans') {
      setActiveTab('fans');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Soft pastel background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[800px] h-[800px] pastel-yellow rounded-full blur-3xl animate-float" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-1/3 -left-32 w-[900px] h-[900px] pastel-blue rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
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
                <h1 className="text-xl font-bold text-foreground">Bloby</h1>
                <p className="text-xs text-muted-foreground">Creator Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ChainSelector />
              <WalletConnectButton />
              <Button variant="ghost" asChild>
                <Link href="/creator/login">Creator Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Tabs */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="creators" className="text-base font-semibold">
                For Creators
              </TabsTrigger>
              <TabsTrigger value="fans" className="text-base font-semibold">
                For Fans
              </TabsTrigger>
            </TabsList>
          </div>

          {/* For Creators Tab */}
          <TabsContent value="creators" className="mt-8">
            <div className="text-center mb-20">
              <Badge variant="secondary" className="mb-6 px-3 py-1 text-xs">
                <TrendingUp className="w-3 h-3 mr-1.5" />
                Powered by Arc Network
              </Badge>
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-foreground">
                Get paid the moment<br />someone consumes your work
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
                Launch your pay-per-content business in minutes, accept feeless USDC payments worldwide, and keep ownership of your audience.
                <br/>
                All powered by <span className="bg-blue-200/60 dark:bg-yellow-900/40 text-foreground px-1 py-0.5 font-medium">
                  USDC on <Link href="https://www.arc.network/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Arc</Link>
                </span>.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Button 
                  variant="outline"
                  size="lg" 
                  className="text-lg px-8 py-2 h-auto border-primary text-primary hover:bg-primary/10"
                  onClick={() => setActiveTab('fans')}
                >
                  Browse Creators
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-2 h-auto"
                  onClick={() => router.push('/creator/login')}
                >
                  Start Publishing
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>

            {/* Key Features */}
            <div className="grid md:grid-cols-3 gap-6 mb-24">
              <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Instant earnings per piece</h3>
                  <p className="text-muted-foreground">Paid directly in USDC. No waiting, no delays.</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Fans pay only for what they consume</h3>
                  <p className="text-muted-foreground">No subscriptions required. Pay-per-content model.</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Earn through sales and tips</h3>
                  <p className="text-muted-foreground">Multiple revenue streams from content unlocks and fan tips.</p>
                </CardContent>
              </Card>
            </div>

            {/* Bloby Section */}
            <div className="relative w-full mb-24">
              <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
                <div className="relative flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                    <BlobAvatar
                      className="h-32 w-32 md:h-40 md:w-40 relative z-10"
                      size={160}
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-4">
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                        Meet Bloby
                      </h2>
                      <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                      Your AI assistant that handles all payment transactions seamlessly. Bloby helps you manage earnings, process tips, and facilitate content unlocks—so you can focus on creating great content.
                    </p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-border/50 shadow-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Automatic Payment Processing</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-border/50 shadow-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">24/7 Customer Support</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-border/50 shadow-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Multi-Chain USDC</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="mb-24">
              <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">How Bloby Works</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Create Your Profile</h3>
                  <p className="text-muted-foreground">Set up your creator profile in minutes. Connect your wallet and start publishing.</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Publish Content</h3>
                  <p className="text-muted-foreground">Create and publish your content (articles, music, videos). Set your price per piece or enable tips.</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Get Paid Instantly</h3>
                  <p className="text-muted-foreground">Bloby handles all payments. Earnings arrive in your wallet immediately in USDC.</p>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className="bg-muted/30 rounded-3xl p-8 md:p-12 mb-24">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">Platform Stats</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">24</div>
                  <p className="text-muted-foreground">Content (7d)</p>
                  <p className="text-sm text-muted-foreground mt-1">New content published in the last 7 days</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">23</div>
                  <p className="text-muted-foreground">Comments + Tips (7d)</p>
                  <p className="text-sm text-muted-foreground mt-1">Fan engagement from the past 7 days</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">$146.19</div>
                  <p className="text-muted-foreground">Creator Earnings (all-time)</p>
                  <p className="text-sm text-muted-foreground mt-1">Feeless tips and paid unlocks delivered to creators</p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Start Earning?</h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join creators who are already earning from their content. Bloby handles all the payment complexity so you can focus on what you do best.
              </p>
              <Button 
                size="lg" 
                className="text-lg px-8 py-2 h-auto"
                onClick={() => router.push('/creator/login')}
              >
                Start Publishing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* For Fans Tab */}
          <TabsContent value="fans" className="mt-8">
            <ForFansContent />
          </TabsContent>
        </Tabs>
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

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
