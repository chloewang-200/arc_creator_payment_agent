'use client';

import { useChainId } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Wallet } from 'lucide-react';
import { ARC_CHAIN_ID } from '@/lib/config';
import { getGatewayUSDCAddress } from '@/lib/gateway';

export function PaymentFlowInfo({ className }: { className?: string }) {
  const chainId = useChainId();
  const isOnArc = chainId === ARC_CHAIN_ID;
  const hasUSDC = !!getGatewayUSDCAddress(chainId);

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
          
          {!isOnArc && hasUSDC && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                You're on chain {chainId}. USDC will be sent directly to the creator's wallet on this chain. Creators can consolidate earnings from all chains later.
              </AlertDescription>
            </Alert>
          )}

          {!isOnArc && !hasUSDC && (
            <Alert variant="destructive">
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Chain {chainId} doesn't have USDC. Please switch to a chain with USDC (Arc, Base, Arbitrum, Sepolia, etc.) to make payments.
              </AlertDescription>
            </Alert>
          )}

          {isOnArc && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                You're on Arc Network. Payments go directly to creators through the PayRouter contract.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>Payments are in USDC</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🌉</span>
            <span>Users can pay on any chain with USDC</span>
          </div>
          <div className="flex items-center gap-2">
            <span>💰</span>
            <span>Creators receive payments on the chain you pay on, and can consolidate to Arc later</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

