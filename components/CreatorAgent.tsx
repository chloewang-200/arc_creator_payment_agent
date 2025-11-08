'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlobAvatar } from '@/components/BlobAvatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';
import { getAIName, getAIGreeting } from '@/lib/ai-names';
import { creators } from '@/data/creators';
import { posts } from '@/data/posts';
import { useAccount } from 'wagmi';
import { isAgentEnabled } from '@/lib/agent-config';
import { CreatorAgentWithCloudflare } from './CreatorAgentWithCloudflare';
import type { AvatarMessage, PaymentIntent } from '@/types';

interface CreatorAgentProps {
  creatorName: string;
  creatorId: string;
  autoOpen?: boolean;
}

export function CreatorAgent({ creatorName, creatorId, autoOpen = false }: CreatorAgentProps) {
  // Use Cloudflare Agents if enabled, otherwise use mock AI
  if (isAgentEnabled()) {
    return <CreatorAgentWithCloudflare creatorName={creatorName} creatorId={creatorId} autoOpen={autoOpen} />;
  }

  // Fallback to mock AI (current implementation)
  const creator = creators.find(c => c.id === creatorId);
  const creatorPosts = posts.filter(p => p.creatorId === creatorId);
  const { isConnected } = useAccount();
  const aiName = getAIName(creatorName);
  const greeting = getAIGreeting(creatorName, creator?.bio);
  
  const [messages, setMessages] = useState<AvatarMessage[]>([
    {
      id: '1',
      text: greeting,
      timestamp: new Date(),
      sender: 'avatar',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(null);
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [showTooltip, setShowTooltip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for tip events from creator page
  useEffect(() => {
    const handleTip = (e: CustomEvent) => {
      const { amount, creatorId: tipCreatorId, creatorAddress } = e.detail;
      if (tipCreatorId === creatorId) {
        setSelectedIntent({
          kind: 'tip',
          creatorId: tipCreatorId,
          creatorAddress,
          amountUSD: amount,
        });
      }
    };

    const handleRecurringTip = (e: CustomEvent) => {
      const { amount, creatorId: tipCreatorId, creatorAddress } = e.detail;
      if (tipCreatorId === creatorId) {
        setSelectedIntent({
          kind: 'recurringTip',
          creatorId: tipCreatorId,
          creatorAddress,
          amountUSD: amount,
        });
      }
    };

    window.addEventListener('creatorTip' as any, handleTip);
    window.addEventListener('creatorRecurringTip' as any, handleRecurringTip);

    return () => {
      window.removeEventListener('creatorTip' as any, handleTip);
      window.removeEventListener('creatorRecurringTip' as any, handleRecurringTip);
    };
  }, [creatorId]);

  // Detect payment intent from user message
  const detectPaymentIntent = (message: string): PaymentIntent | null => {
    const lowerMessage = message.toLowerCase();
    
    // Check for unlock requests
    const unlockMatch = lowerMessage.match(/unlock (post|article|podcast|video) (\d+)/i) || 
                       lowerMessage.match(/unlock "([^"]+)"/i);
    if (unlockMatch) {
      const postId = unlockMatch[2] || creatorPosts.find(p => 
        p.title.toLowerCase().includes(unlockMatch[1]?.toLowerCase() || '')
      )?.id;
      if (postId) {
        const post = creatorPosts.find(p => p.id === postId);
        if (post) {
          return {
            kind: 'unlock',
            postId: post.id,
            creatorId,
            creatorAddress: creator?.walletAddress,
            amountUSD: post.priceUSD,
            title: post.title,
          };
        }
      }
    }

    // Check for subscription requests
    if (lowerMessage.match(/subscribe|monthly subscription|monthly/i)) {
      if (creator?.pricing.monthlyUSD && creator.pricing.monthlyUSD > 0) {
        return {
          kind: 'subscription',
          creatorId,
          creatorAddress: creator.walletAddress,
          amountUSD: creator.pricing.monthlyUSD,
        };
      }
    }

    // Check for tip requests
    const tipMatch = lowerMessage.match(/(?:tip|send|give) (?:me|us|you)?\s*\$?(\d+(?:\.\d+)?)/i);
    if (tipMatch) {
      const amount = parseFloat(tipMatch[1]);
      if (amount > 0) {
        return {
          kind: 'tip',
          creatorId,
          creatorAddress: creator?.walletAddress,
          amountUSD: amount,
        };
      }
    }

    // Check for recurring tip
    if (lowerMessage.match(/recurring|monthly tip|auto tip/i)) {
      if (creator?.pricing.recurringTipUSD) {
        return {
          kind: 'recurringTip',
          creatorId,
          creatorAddress: creator.walletAddress,
          amountUSD: creator.pricing.recurringTipUSD,
        };
      }
    }

    return null;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: AvatarMessage = {
      id: Date.now().toString(),
      text: input,
      timestamp: new Date(),
      sender: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsTyping(true);

    // Check if user wants to make a payment
    const paymentIntent = detectPaymentIntent(userInput);
    
    if (paymentIntent) {
      // Check if wallet is connected
      if (!isConnected) {
        const aiMessage: AvatarMessage = {
          id: (Date.now() + 1).toString(),
          text: `I'd love to help you with that! But first, you'll need to connect your wallet. Click the "Connect Wallet" button in the top right corner, then come back and we can complete the payment. 💼`,
          timestamp: new Date(),
          sender: 'avatar',
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
        return;
      }

      // Show payment intent
      setTimeout(() => {
        let responseText = '';
        if (paymentIntent.kind === 'unlock') {
          responseText = `Perfect! I'll unlock "${paymentIntent.title}" for $${paymentIntent.amountUSD.toFixed(2)}. You'll need to confirm the transaction in your wallet.`;
        } else if (paymentIntent.kind === 'subscription') {
          responseText = `Great! I'll set up a monthly subscription for $${paymentIntent.amountUSD.toFixed(2)}/month. You'll need to confirm the transaction in your wallet.`;
        } else if (paymentIntent.kind === 'recurringTip') {
          responseText = `Awesome! I'll set up a recurring tip of $${paymentIntent.amountUSD.toFixed(2)}/month. You'll need to confirm the transaction in your wallet.`;
        } else {
          responseText = `Perfect! I'll send a tip of $${paymentIntent.amountUSD.toFixed(2)}. You'll need to confirm the transaction in your wallet.`;
        }

        const aiMessage: AvatarMessage = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          timestamp: new Date(),
          sender: 'avatar',
        };

        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
        
        // Open checkout modal after a brief delay
        setTimeout(() => {
          setSelectedIntent(paymentIntent);
        }, 500);
      }, 1000);
      return;
    }

    // Regular conversation
    setTimeout(() => {
      const firstName = creatorName.split(' ')[0];
      const responses = [
        `Great question! ${firstName} would love that you asked. Let me help you with that.`,
        `Oh that's interesting! Based on ${firstName}'s content, here's what I know...`,
        `Thanks for asking! ${firstName} talks about this a lot. Here's what they'd say...`,
        `That's a popular question! ${firstName} has covered this before. Here's the answer...`,
        `I'm glad you asked! ${firstName} would be happy to help with this.`,
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const aiMessage: AvatarMessage = {
        id: (Date.now() + 1).toString(),
        text: randomResponse,
        timestamp: new Date(),
        sender: 'avatar',
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    const firstName = creatorName.split(' ')[0];
    return (
      <div
        className="fixed bottom-4 right-8 z-50"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-foreground text-background rounded-lg shadow-lg text-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
            Chat with {firstName}'s bloby
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
          </div>
        )}
        <div
          onClick={() => setIsOpen(true)}
          className="cursor-pointer hover:scale-110 transition-transform duration-200"
        >
          <BlobAvatar
            className="h-20 w-20"
            size={150}
          />
        </div>
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
                  AI Bloby
                </Badge>
              </div>
              <div className="text-xs opacity-90">Always online • {creatorName}'s Bloby</div>
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
            {isTyping && (
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
            <div ref={messagesEndRef} />
          </div>

          <Separator />
          
          {/* Quick Action Buttons */}
          {creator?.hasContent && creatorPosts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const firstPost = creatorPosts[0];
                  if (firstPost) {
                    const paymentIntent: PaymentIntent = {
                      kind: 'unlock',
                      postId: firstPost.id,
                      creatorId,
                      creatorAddress: creator.walletAddress,
                      amountUSD: firstPost.priceUSD,
                      title: firstPost.title,
                    };
                    if (!isConnected) {
                      setMessages((prev) => [...prev, {
                        id: Date.now().toString(),
                        text: 'Please connect your wallet first! 💼',
                        timestamp: new Date(),
                        sender: 'avatar',
                      }]);
                      return;
                    }
                    setSelectedIntent(paymentIntent);
                  }
                }}
                className="text-xs"
              >
                Unlock Latest Post
              </Button>
              {creator.pricing.monthlyUSD && creator.pricing.monthlyUSD > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isConnected) {
                      setMessages((prev) => [...prev, {
                        id: Date.now().toString(),
                        text: 'Please connect your wallet first! 💼',
                        timestamp: new Date(),
                        sender: 'avatar',
                      }]);
                      return;
                    }
                    setSelectedIntent({
                      kind: 'subscription',
                      creatorId,
                      creatorAddress: creator.walletAddress,
                      amountUSD: creator.pricing.monthlyUSD!,
                    });
                  }}
                  className="text-xs"
                >
                  Subscribe Monthly
                </Button>
              )}
            </div>
          )}
          
          {!creator?.hasContent && creator?.pricing.tipPresetsUSD && creator.pricing.tipPresetsUSD.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {creator.pricing.tipPresetsUSD.slice(0, 3).map((tip) => (
                <Button
                  key={tip}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isConnected) {
                      setMessages((prev) => [...prev, {
                        id: Date.now().toString(),
                        text: 'Please connect your wallet first! 💼',
                        timestamp: new Date(),
                        sender: 'avatar',
                      }]);
                      return;
                    }
                    setSelectedIntent({
                      kind: 'tip',
                      creatorId,
                      creatorAddress: creator.walletAddress,
                      amountUSD: tip,
                    });
                  }}
                  className="text-xs"
                >
                  Tip ${tip}
                </Button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Chat with ${aiName}...`}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              size="icon"
            >
              {isTyping ? (
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
          onClose={() => {
            setSelectedIntent(null);
            // Add message about cancellation
            const cancelMessage: AvatarMessage = {
              id: Date.now().toString(),
              text: 'No problem! Let me know if you want to try again or if you need anything else.',
              timestamp: new Date(),
              sender: 'avatar',
            };
            setMessages((prev) => [...prev, cancelMessage]);
          }}
          onSuccess={() => {
            setSelectedIntent(null);
            // Add success message
            const successMessage: AvatarMessage = {
              id: Date.now().toString(),
              text: '🎉 Payment confirmed! Thanks for supporting the creator. Is there anything else I can help you with?',
              timestamp: new Date(),
              sender: 'avatar',
            };
            setMessages((prev) => [...prev, successMessage]);
          }}
        />
      )}
    </>
  );
}
