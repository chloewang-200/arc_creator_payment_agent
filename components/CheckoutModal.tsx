'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { PAYROUTER_ADDRESS, USDC_ADDRESS, CREATOR_ADDRESS, USDC_DECIMALS, ARC_CHAIN_ID } from '@/lib/config';
import { PAYROUTER_ABI, USDC_ABI } from '@/lib/contracts';
import { getUSDCAddress, supportsCCTP } from '@/lib/cctp';
import { skuPost, skuSub, skuTip, skuRecurringTip } from '@/lib/sku';
import type { PaymentIntent } from '@/types';
import { unlockPost, activateSubscription, activateRecurringTip } from '@/lib/entitlements';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Wallet, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CheckoutModalProps {
  intent: PaymentIntent;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ intent, onClose, onSuccess }: CheckoutModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [step, setStep] = useState<'summary' | 'confirm' | 'processing' | 'success'>('summary');
  const [error, setError] = useState<string | null>(null);
  const isOnArc = chainId === ARC_CHAIN_ID;

  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();
  const [shouldPay, setShouldPay] = useState(false);

  const { writeContract: writeApprove, data: approveTxHash } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setApproveHash(hash);
      },
      onError: (error) => {
        setError(error.message || 'Approval failed');
        setStep('summary');
        setShouldPay(false);
      },
    },
  });

  const { writeContract: writePay, data: payTxHash } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setPayHash(hash);
      },
      onError: (error) => {
        setError(error.message || 'Payment failed');
        setStep('summary');
      },
    },
  });

  const { isLoading: isApproving, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash || approveTxHash
  });

  const { isLoading: isPaying, isSuccess: isPaySuccess } = useWaitForTransactionReceipt({
    hash: payHash || payTxHash
  });

  // Handle successful payment - record in database
  useEffect(() => {
    const recordPayment = async () => {
      if (!isPaySuccess || !address) return;

      try {
        // Record the unlock/subscription in the database
        const response = await fetch('/api/unlocks/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: intent.kind,
            postId: intent.postId,
            creatorId: intent.creatorId,
            walletAddress: address,
            amount: intent.amountUSD,
            txHash: payHash || payTxHash,
            days: 30,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to record payment in database:', errorData);
          // Don't throw - blockchain tx succeeded, so we still show success
        }

        // Also update localStorage for immediate UI feedback
        if (intent.kind === 'unlock' && intent.postId) {
          unlockPost(intent.postId);
        } else if (intent.kind === 'subscription') {
          activateSubscription(30);
        } else if (intent.kind === 'recurringTip' && intent.creatorId) {
          activateRecurringTip(intent.creatorId, intent.amountUSD, 30);
        }
        // Tips don't change entitlements

        setStep('success');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } catch (error) {
        console.error('Error recording payment:', error);
        // Still show success since blockchain tx succeeded
        setStep('success');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    };

    if (isPaySuccess) {
      recordPayment();
    }
  }, [isPaySuccess, address, intent, payHash, payTxHash, onSuccess, onClose]);

  useEffect(() => {
    if (isApproved && shouldPay && !payHash && !payTxHash) {
      const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
      
      let sku: `0x${string}`;
      if (intent.kind === 'unlock' && intent.postId) {
        sku = skuPost(intent.postId);
      } else if (intent.kind === 'subscription') {
        sku = skuSub();
      } else if (intent.kind === 'recurringTip' && intent.creatorId) {
        sku = skuRecurringTip(intent.creatorId, intent.amountUSD);
      } else {
        sku = skuTip(intent.amountUSD);
      }

      // Use creator address from intent if available, otherwise fall back to global CREATOR_ADDRESS
      const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;

      if (PAYROUTER_ADDRESS === '0x0000000000000000000000000000000000000000' || 
          creatorAddress === '0x0000000000000000000000000000000000000000') {
        setError('Contract addresses not configured. Please set environment variables.');
        setStep('summary');
        return;
      }

      writePay({
        address: PAYROUTER_ADDRESS,
        abi: PAYROUTER_ABI,
        functionName: 'pay',
        args: [sku, creatorAddress, amount],
      });
    }
  }, [isApproved, shouldPay, payHash, payTxHash, intent, writePay]);

  useEffect(() => {
    if (isApproving || isPaying) {
      setStep('processing');
    }
  }, [isApproving, isPaying]);

  const handleConfirm = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    // If not on Arc, check if CCTP is available
    if (!isOnArc) {
      const chainUSDC = getUSDCAddress(chainId);
      if (!chainUSDC) {
        setError(`USDC not available on this chain (${chainId}). Please switch to Arc or a supported chain.`);
        return;
      }
      
      // Check if CCTP is supported on this chain
      if (!supportsCCTP(chainId)) {
        setError(`Chain ${chainId} doesn't support CCTP. Please switch to Arc Network or a supported chain to make payments.`);
        return;
      }
      
      // For now, we'll require switching to Arc for payment
      // In production, you could implement automatic CCTP bridging
      setError(`You're on chain ${chainId}. Please switch to Arc Network to complete payment. Your USDC can be bridged using CCTP if needed.`);
      return;
    }

    setError(null);
    setStep('confirm');

    try {
      const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
      
      if (USDC_ADDRESS === '0x0000000000000000000000000000000000000000' || 
          PAYROUTER_ADDRESS === '0x0000000000000000000000000000000000000000') {
        setError('Contract addresses not configured. Please set environment variables.');
        setStep('summary');
        return;
      }

      writeApprove({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [PAYROUTER_ADDRESS, amount],
      });
      setShouldPay(true);
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setStep('summary');
      setShouldPay(false);
    }
  };

  const getSummaryText = () => {
    if (intent.kind === 'unlock') {
      return `Unlock "${intent.title || 'Post'}"`;
    } else if (intent.kind === 'subscription') {
      return `Subscribe monthly`;
    } else if (intent.kind === 'recurringTip') {
      return `Set up recurring tip`;
    } else {
      return `Send tip`;
    }
  };

  if (step === 'success') {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold mb-2">Payment Successful!</DialogTitle>
            <DialogDescription className="text-base">
              Your content is now unlocked.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Confirm Payment
          </DialogTitle>
          <DialogDescription>
            {getSummaryText()}
          </DialogDescription>
        </DialogHeader>

        {step === 'summary' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-lg font-semibold">${intent.amountUSD.toFixed(2)} USDC</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Network</span>
                <Badge variant="secondary">Arc Testnet</Badge>
              </div>
              {!isConnected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Please connect your wallet first</AlertDescription>
                </Alert>
              )}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!isConnected} className="flex-1">
                {isConnected ? 'Confirm & Sign in Wallet' : 'Connect Wallet First'}
              </Button>
              {isConnected && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  💡 Your wallet (Metamask) will pop up asking you to confirm the transaction
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You're about to {getSummaryText().toLowerCase()} for ${intent.amountUSD.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">Proceed?</p>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium mb-1">
                {isApproving ? 'Approving USDC...' : isPaying ? 'Processing payment...' : 'Waiting...'}
              </p>
              <p className="text-sm text-muted-foreground">
                Please confirm the transaction in your wallet
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
