'use client';

import { useState } from 'react';
import { CheckoutModal } from './CheckoutModal';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Wallet, Crown } from 'lucide-react';
import type { PaymentIntent } from '@/types';

interface AvatarOverlayProps {
  postId: string;
  postTitle: string;
  postPriceUSD: number;
  monthlyUSD: number;
  creatorId?: string;
  creatorAddress?: `0x${string}`;
  onUnlock: () => void;
  onMonthly: () => void;
}

type AvatarState = 'greet' | 'confirm' | 'thank' | 'explain';

export function AvatarOverlay({
  postId,
  postTitle,
  postPriceUSD,
  monthlyUSD,
  creatorId,
  creatorAddress,
  onUnlock,
  onMonthly,
}: AvatarOverlayProps) {
  const [state, setState] = useState<AvatarState>('greet');
  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(null);

  const handleIntent = (intent: PaymentIntent) => {
    setSelectedIntent(intent);
    setState('confirm');
  };

  const handleUnlock = () => {
    handleIntent({
      kind: 'unlock',
      postId,
      creatorId,
      creatorAddress,
      amountUSD: postPriceUSD,
      title: postTitle,
    });
  };

  const handleMonthly = () => {
    handleIntent({
      kind: 'subscription',
      creatorId,
      creatorAddress,
      amountUSD: monthlyUSD,
    });
  };

  const handleSuccess = () => {
    setState('thank');
    onUnlock();
  };

  return (
    <>
      <Card className="w-full max-w-sm border-primary/20 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <Avatar className="bg-gradient-to-br from-primary to-primary/60 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                <Sparkles className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">Creator's Assistant</span>
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                       {state === 'greet' && (
                         <>
                           Hi! I'm the creator's assistant. Full post is <span className="font-semibold text-foreground">${postPriceUSD.toFixed(2)}</span>
                           {monthlyUSD && monthlyUSD > 0 && (
                             <>, or <span className="font-semibold text-foreground">${monthlyUSD.toFixed(2)}/mo</span> for everything</>
                           )}
                           . Want a quick summary or just unlock?
                         </>
                       )}
                {state === 'confirm' && selectedIntent && (
                  <>
                    You're about to{' '}
                    {selectedIntent.kind === 'unlock'
                      ? `unlock "${postTitle}" for $${selectedIntent.amountUSD.toFixed(2)}`
                      : `subscribe monthly for $${selectedIntent.amountUSD.toFixed(2)}/month`}
                    . Proceed?
                  </>
                )}
                {state === 'thank' && (
                  <>
                    Thanks! ✅ Unlocked. If you plan to read more, monthly usually saves money.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
                 {state === 'greet' && (
                   <>
                     <Button onClick={handleUnlock} className="w-full" size="lg">
                       <Wallet className="w-4 h-4 mr-2" />
                       Unlock ${postPriceUSD.toFixed(2)}
                     </Button>
                     {monthlyUSD && monthlyUSD > 0 && (
                       <Button onClick={handleMonthly} variant="secondary" className="w-full" size="lg">
                         <Crown className="w-4 h-4 mr-2" />
                         Monthly ${monthlyUSD.toFixed(2)}
                       </Button>
                     )}
                   </>
                 )}

          {state === 'confirm' && (
            <Button onClick={() => setState('greet')} variant="outline" className="w-full">
              Cancel
            </Button>
          )}

          {state === 'explain' && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              Monthly = all posts + archive; cancel anytime; no paywalls.
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIntent && (
        <CheckoutModal
          intent={selectedIntent}
          onClose={() => {
            setSelectedIntent(null);
            setState('greet');
          }}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
