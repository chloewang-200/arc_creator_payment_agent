'use client';

// Using direct HTTP fetch instead of WebSocket-based agents SDK
// import { useAgentChat } from 'agents/ai-react';
// import { useAgent } from 'agents/react';
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlobAvatar } from '@/components/BlobAvatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';
import { getAIName, getAIGreeting } from '@/lib/ai-names';
import { useAccount } from 'wagmi';
import { isAgentEnabled, AGENT_CONFIG } from '@/lib/agent-config';
import type { PaymentIntent, Creator, Post } from '@/types';

interface CreatorAgentWithCloudflareProps {
  creatorName: string;
  creatorId: string;
  autoOpen?: boolean;
}

export function CreatorAgentWithCloudflare({ creatorName, creatorId, autoOpen = false }: CreatorAgentWithCloudflareProps) {
  const { isConnected, address } = useAccount();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [creatorPosts, setCreatorPosts] = useState<Post[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const aiName = getAIName(creatorName);
  const agentInitialized = useRef(false);

  // Fetch creator and posts from database
  useEffect(() => {
    const loadCreatorData = async () => {
      setIsLoadingData(true);
      try {
        // Try username first, then ID
        let profileResponse = await fetch(`/api/creators/profile?username=${encodeURIComponent(creatorId)}`);

        if (!profileResponse.ok && creatorId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          profileResponse = await fetch(`/api/creators/profile?id=${encodeURIComponent(creatorId)}`);
        }

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log('📊 Creator profile loaded:', profileData);

          if (profileData.creator && profileData.pricing) {
            // Load posts FIRST before setting creator
            const postsResponse = await fetch(`/api/posts?creatorId=${profileData.creator.id}`);
            let loadedPosts: Post[] = [];

            if (postsResponse.ok) {
              const postsData = await postsResponse.json();
              loadedPosts = postsData.posts || [];
              console.log('📝 Posts loaded:', loadedPosts.length, 'posts', loadedPosts);
            } else {
              console.error('❌ Failed to load posts:', postsResponse.status, postsResponse.statusText);
            }

            // Set both at the same time to avoid double initialization
            setCreatorPosts(loadedPosts);
            setCreator({
              ...profileData.creator,
              pricing: profileData.pricing,
            });
          }
        } else {
          console.error('❌ Failed to load creator profile:', profileResponse.status, profileResponse.statusText);
        }
      } catch (err) {
        console.error('Error loading creator data:', err);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadCreatorData();
  }, [creatorId]);

  // Get pricing info for greeting
  const pricingInfo = {
    monthlyUSD: creator?.pricing?.monthlyUSD || 5,
    postPrice: creatorPosts[0]?.priceUSD || 0.69,
  };
  const greeting = getAIGreeting(creatorName, creator?.bio, pricingInfo);

  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(null);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [showTooltip, setShowTooltip] = useState(false);

  // Note: We're using direct HTTP fetch instead of WebSocket
  // The useAgent hook tries to use WebSocket which requires special routing
  // For now, we'll use HTTP POST for all communication
  // const agentConnection = useAgent({
  //   agent: AGENT_CONFIG.agentName,
  //   name: creatorId,
  //   host: AGENT_CONFIG.host,
  // });

  // Use the chat hook - simplified for now
  // Note: useAgentChat may have different API, using agentConnection directly for now
  const [aiMessages, setAiMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: greeting,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // We're using HTTP fetch instead of WebSocket, so no need for message listeners

  const sendMessage = async (text: string) => {
    if (!text.trim() || !creator) return;

    // Track conversation
    if (address && creator.id) {
      try {
        await fetch('/api/conversations/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId: creator.id,
            userWalletAddress: address,
          }),
        });
      } catch (err) {
        console.error('Failed to track conversation:', err);
      }
    }

    // Add user message
    setAiMessages((prev) => [...prev, {
      role: 'user',
      content: text,
    }]);
    setIsLoading(true);
    setError(undefined);

    // Send to agent - use the chat endpoint
    try {
      // Use fetch to call the agent's chat endpoint - use creator.id (UUID)
      const response = await fetch(`https://${AGENT_CONFIG.host}/agent/${creator.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'chat',
          message: text,
          userWalletAddress: address, // Pass user wallet for refund intent tracking
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent error: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '');
              try {
                const data = JSON.parse(jsonStr);
                
                // Handle payment actions
                if (data.type === 'payment_action') {
                  const { action, params } = data;
                  let paymentIntent: PaymentIntent | null = null;

                  // Ensure amount is a number
                  const amount = typeof params.amount === 'number'
                    ? params.amount
                    : parseFloat(params.amount);

                  if (action === 'unlock' && creator) {
                    paymentIntent = {
                      kind: 'unlock',
                      postId: params.postId,
                      creatorId: creator.id,
                      creatorAddress: creator.walletAddress,
                      amountUSD: amount,
                      title: creatorPosts.find(p => p.id === params.postId)?.title,
                    };
                  } else if (action === 'subscribe' && creator) {
                    paymentIntent = {
                      kind: 'subscription',
                      creatorId: creator.id,
                      creatorAddress: creator.walletAddress,
                      amountUSD: amount,
                    };
                  } else if (action === 'tip' && creator) {
                    paymentIntent = {
                      kind: 'tip',
                      creatorId: creator.id,
                      creatorAddress: creator.walletAddress,
                      amountUSD: amount,
                    };
                  } else if (action === 'recurringTip' && creator) {
                    paymentIntent = {
                      kind: 'recurringTip',
                      creatorId: creator.id,
                      creatorAddress: creator.walletAddress,
                      amountUSD: amount,
                    };
                  }

                  if (paymentIntent) {
                    console.log('💳 Opening checkout with:', paymentIntent);
                    setSelectedIntent(paymentIntent);
                  }
                }
                
                // Handle refund requests
                if (data.type === 'refund_request') {
                  const { transactionId, refundType, amountUSD, chainId } = data;
                  
                  if (!address) {
                    setAiMessages((prev) => [...prev, {
                      role: 'assistant',
                      content: 'Please connect your wallet to request a refund.',
                    }]);
                    setIsLoading(false);
                    return;
                  }

                  try {
                    const refundResponse = await fetch('/api/refunds', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        creatorId: creator.id,
                        userWalletAddress: address,
                        transactionId,
                        refundType,
                        amountUSD,
                        chainId,
                      }),
                    });

                    const refundData = await refundResponse.json();

                    if (refundResponse.ok) {
                      // Clear entitlements from localStorage if refund was for unlock/subscription
                      if (refundType === 'unlock' && transactionId) {
                        // Remove post from unlocked posts in localStorage
                        // Note: transactionId might be postId, post_unlocks.id, or transaction_hash
                        // We'll try to clear it from localStorage using the postId
                        // The API will handle the database deletion
                        try {
                          const stored = localStorage.getItem('arc_entitlements');
                          if (stored) {
                            const entitlements = JSON.parse(stored);
                            if (entitlements.postsUnlocked) {
                              // Try transactionId as postId first
                              if (entitlements.postsUnlocked[transactionId]) {
                                delete entitlements.postsUnlocked[transactionId];
                              }
                              // Also check all posts and clear if needed (in case transactionId is not postId)
                              // This is a fallback - the API should handle the actual database deletion
                              localStorage.setItem('arc_entitlements', JSON.stringify(entitlements));
                            }
                          }
                        } catch (e) {
                          console.error('Error clearing localStorage entitlements:', e);
                        }
                      } else if (refundType === 'subscription') {
                        // Clear subscription from localStorage
                        try {
                          const stored = localStorage.getItem('arc_entitlements');
                          if (stored) {
                            const entitlements = JSON.parse(stored);
                            entitlements.subscriptionActiveUntil = undefined;
                            localStorage.setItem('arc_entitlements', JSON.stringify(entitlements));
                          }
                        } catch (e) {
                          console.error('Error clearing subscription from localStorage:', e);
                        }
                      } else if (refundType === 'recurringTip' && creator.id) {
                        // Clear recurring tip from localStorage
                        try {
                          const stored = localStorage.getItem('arc_entitlements');
                          if (stored) {
                            const entitlements = JSON.parse(stored);
                            if (entitlements.recurringTips && entitlements.recurringTips[creator.id]) {
                              delete entitlements.recurringTips[creator.id];
                              localStorage.setItem('arc_entitlements', JSON.stringify(entitlements));
                            }
                          }
                        } catch (e) {
                          console.error('Error clearing recurring tip from localStorage:', e);
                        }
                      }
                      
                      setAiMessages((prev) => [...prev, {
                        role: 'assistant',
                        content: refundData.refund.message || `Refund of $${refundData.refund.refundAmount.toFixed(2)} is being processed. The creator will review and approve it. Access has been revoked.`,
                      }]);
                    } else {
                      // Check if it's a rejection
                      if (refundData.error?.includes('rejected') || refundData.status === 'rejected') {
                        setAiMessages((prev) => [...prev, {
                          role: 'assistant',
                          content: 'It seems like the refund request was rejected. You can contact the creator directly if you have questions about this decision.',
                        }]);
                      } else {
                        setAiMessages((prev) => [...prev, {
                          role: 'assistant',
                          content: refundData.reason || refundData.error || 'Unable to process refund at this time.',
                        }]);
                      }
                    }
                  } catch (err) {
                    console.error('Refund error:', err);
                    setAiMessages((prev) => [...prev, {
                      role: 'assistant',
                      content: 'Sorry, there was an error processing your refund request. Please try again later.',
                    }]);
                  }
                }
                
                // Handle messages
                if (data.type === 'message' && data.content) {
                  setAiMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === 'assistant') {
                      // Append to existing message
                      return [...prev.slice(0, -1), {
                        ...lastMsg,
                        content: lastMsg.content + data.content,
                      }];
                    }
                    return [...prev, {
                      role: 'assistant',
                      content: data.content,
                    }];
                  });
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
        setIsLoading(false);
      }
    } catch (e: any) {
      setError(e as Error);
      setIsLoading(false);
    }
  };

  // Initialize agent with creator data (via HTTP POST for reliability)
  useEffect(() => {
    // Only initialize once when all data is loaded
    if (creator && !isLoadingData && !agentInitialized.current) {
      const postsData = creatorPosts.map(p => ({
        id: p.id,
        title: p.title,
        priceUSD: p.priceUSD,
        contentType: p.contentType,
      }));

      const initData = {
        type: 'init',
        creatorId: creator.id,
        creatorName,
        creatorBio: creator.bio,
        walletAddress: creator.walletAddress,
        pricing: creator.pricing,
        posts: postsData,
        hasContent: creator.hasContent ?? (postsData.length > 0),
        aiTone: creator.aiTone,
        aiBackground: creator.aiBackground,
        aiPersonality: creator.aiPersonality,
      };

      // Debug: Log what we're sending to the agent
      console.log('🤖 Initializing AI agent with:', {
        creatorId: creator.id,
        creatorName,
        postsCount: postsData.length,
        hasContent: initData.hasContent,
        posts: postsData,
        pricing: creator.pricing,
      });

      // Mark as initialized to prevent re-initialization
      agentInitialized.current = true;

      // Initialize via HTTP POST (more reliable than WebSocket)
      // Use creator.id (UUID) for the agent instance
      fetch(`https://${AGENT_CONFIG.host}/agent/${creator.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initData),
      })
        .then(response => {
          console.log('✅ Agent initialized successfully');
          return response.json();
        })
        .then(data => {
          console.log('📥 Agent init response:', data);
          if (data.debug) {
            console.log('🔍 Worker confirms storage:', data.debug);
          }
        })
        .catch(err => {
          console.error('❌ Failed to initialize agent:', err);
          // Reset the flag so we can retry if there was an error
          agentInitialized.current = false;
        });
    }
  }, [creator, creatorName, creatorPosts, isLoadingData]);

  // Convert AI messages to our format
  const messages = aiMessages.map((msg: any, idx: number) => ({
    id: idx.toString(),
    text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    timestamp: new Date(),
    sender: msg.role === 'user' ? 'user' : 'avatar',
  }));

  if (!isOpen) {
    const firstName = creatorName.split(' ')[0];
    return (
      <div
        className="fixed bottom-4 right-4 z-50"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-foreground text-background rounded-lg shadow-lg text-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
            Chat with {firstName}'s agent
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
          </div>
        )}
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-110"
          size="icon"
        >
          <span className="text-2xl">👋</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="fixed bottom-4 right-4 w-96 h-[600px] shadow-2xl border-primary/20 flex flex-col z-50 overflow-hidden pt-0">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground pb-4 pt-4 rounded-t-xl">
          <div className="flex items-center gap-3">
            <BlobAvatar
              creatorId={creatorId}
              creatorName={creatorName}
              className="h-10 w-10"
              size={40}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{aiName}</span>
                <Badge variant="secondary" className="text-xs bg-primary-foreground/20 text-primary-foreground">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Avatar
                </Badge>
              </div>
              <div className="text-xs opacity-90">Always online • {creatorName}'s AI</div>
            </div>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
          <div className="flex-1 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                      <p className="text-sm">{message.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 text-destructive text-xs p-2 rounded">
                Error: {error.message}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    sendMessage(input);
                    setInput('');
                  }
                }
              }}
              placeholder={`Chat with ${aiName}...`}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={() => {
                if (input.trim() && !isLoading) {
                  sendMessage(input);
                  setInput('');
                }
              }}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedIntent && (
        <CheckoutModal
          intent={selectedIntent}
          onClose={() => setSelectedIntent(null)}
          onSuccess={() => setSelectedIntent(null)}
        />
      )}
    </>
  );
}

