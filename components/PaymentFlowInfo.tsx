'use client';

import { useChainId } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, ArrowRight, Wallet } from 'lucide-react';
import { ARC_CHAIN_ID } from '@/lib/config';
import { supportsCCTP } from '@/lib/cctp';

export function PaymentFlowInfo({ className }: { className?: string }) {
  const chainId = useChainId();
  const isOnArc = chainId === ARC_CHAIN_ID;
  const hasCCTP = supportsCCTP(chainId);

  return (
    <Card className={`border-primary/20 ${className || ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="w-4 h-4" />
          Payment Flow
        </CardTitle>
        <CardDescription className="text-xs">
          How payments work across chains
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Wallet className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Current Chain:</span>
            <Badge variant="outline" className="text-xs">
              {chainId}
            </Badge>
          </div>
          
          {!isOnArc && hasCCTP && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                You're on chain {chainId}. When you pay, USDC will be bridged to Arc Network using CCTP so creators receive it in their unified balance.
              </AlertDescription>
            </Alert>
          )}

          {!isOnArc && !hasCCTP && (
            <Alert variant="destructive">
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Chain {chainId} doesn't support CCTP. Please switch to Arc Network or a supported chain to make payments.
              </AlertDescription>
            </Alert>
          )}

          {isOnArc && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                You're on Arc Network. Payments go directly to creators.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>Payments are in USDC (CCTP supports USDC only)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🌉</span>
            <span>CCTP automatically bridges USDC to Arc for creators</span>
          </div>
          <div className="flex items-center gap-2">
            <span>💰</span>
            <span>Creators receive unified USDC balance on Arc</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

