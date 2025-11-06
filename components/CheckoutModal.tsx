'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, decodeErrorResult, encodeFunctionData, erc20Abi } from 'viem';
import { PAYROUTER_ADDRESS, USDC_ADDRESS, CREATOR_ADDRESS, USDC_DECIMALS, ARC_CHAIN_ID } from '@/lib/config';
import { PAYROUTER_ABI, USDC_ABI } from '@/lib/contracts';
import { 
  getGatewayUSDCAddress,
} from '@/lib/gateway';
import { skuPost, skuSub, skuTip, skuRecurringTip } from '@/lib/sku';
import type { PaymentIntent } from '@/types';
import { unlockPost, activateSubscription, activateRecurringTip } from '@/lib/entitlements';
import { submitPaymasterPayment, isPaymasterPaymentAvailable } from '@/lib/paymaster-payment';
  import { bridgeUSDCWithBridgeKit } from '@/lib/bridgeKit';
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
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [step, setStep] = useState<'summary' | 'confirm' | 'processing' | 'success'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [usePaymaster, setUsePaymaster] = useState(false);
  const [paymasterTxHash, setPaymasterTxHash] = useState<string | null>(null);
  const isOnArc = chainId === ARC_CHAIN_ID;
  const paymasterAvailable = isPaymasterPaymentAvailable(chainId);

  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();
  const [shouldPay, setShouldPay] = useState(false);
  
  // Get USDC address for current chain
  const gatewayUSDC = getGatewayUSDCAddress(chainId);

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
            chainId: chainId, // Track which chain payment was made on
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
    const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
    const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;

    if (isOnArc) {
      // On Arc: Need approval first, then PayRouter
      if (isApproved && shouldPay && !payHash && !payTxHash) {
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
    } else {
      // On other chains: Direct USDC transfer (no approval needed)
      if (shouldPay && !payHash && !payTxHash) {
        const chainUSDC = getGatewayUSDCAddress(chainId);
        
        if (!chainUSDC || chainUSDC === '0x0000000000000000000000000000000000000000' ||
            creatorAddress === '0x0000000000000000000000000000000000000000') {
          setError('USDC address or creator address not configured.');
          setStep('summary');
          return;
        }

        // Direct transfer - no approval needed
        writePay({
          address: chainUSDC,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [creatorAddress, amount],
        });
      }
    }
  }, [isApproved, shouldPay, payHash, payTxHash, intent, writePay, isOnArc, chainId]);

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

    setError(null);
    setStep('confirm');

    try {
      const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
      const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;
      
      if (!creatorAddress || creatorAddress === '0x0000000000000000000000000000000000000000') {
        setError('Creator address not set');
        setStep('summary');
        return;
      }

      // If user wants to use paymaster (gas in USDC) and it's available
      if (usePaymaster && paymasterAvailable && walletClient && publicClient) {
        setStep('processing');
        try {
          const result = await submitPaymasterPayment({
            intent,
            walletClient,
            publicClient,
            chainId,
          });

          if (result.success && result.txHash) {
            setPaymasterTxHash(result.txHash);
            // Record payment in database
            try {
              await fetch('/api/unlocks/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: intent.kind,
                  postId: intent.postId,
                  creatorId: intent.creatorId,
                  walletAddress: address,
                  amount: intent.amountUSD,
                  txHash: result.txHash,
                  chainId: chainId, // Track which chain payment was made on
                  days: 30,
                }),
              });
            } catch (error) {
              console.error('Failed to record payment:', error);
            }

            // Update local entitlements
            if (intent.kind === 'unlock' && intent.postId) {
              unlockPost(intent.postId);
            } else if (intent.kind === 'subscription') {
              activateSubscription(30);
            } else if (intent.kind === 'recurringTip' && intent.creatorId) {
              activateRecurringTip(intent.creatorId, intent.amountUSD, 30);
            }

            setStep('success');
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 2000);
            return;
          } else {
            setError(result.error || 'Paymaster payment failed');
            setStep('summary');
            return;
          }
        } catch (err: any) {
          setError(err.message || 'Paymaster payment failed');
          setStep('summary');
          return;
        }
      }

      // If on Arc, pay via PayRouter (for fee collection)
      if (isOnArc) {
        const usdcAddress = USDC_ADDRESS;
        const payRouterAddress = PAYROUTER_ADDRESS;

        if (!usdcAddress || usdcAddress === '0x0000000000000000000000000000000000000000' ||
            !payRouterAddress || payRouterAddress === '0x0000000000000000000000000000000000000000') {
          setError('Contract addresses not configured. Please set environment variables.');
          setStep('summary');
          return;
        }

        writeApprove({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [payRouterAddress, amount],
        });
        setShouldPay(true);
      }
      // If on any other chain, send USDC directly to creator's wallet
      else {
        const chainUSDC = getGatewayUSDCAddress(chainId);
        
        if (!chainUSDC || chainUSDC === '0x0000000000000000000000000000000000000000') {
          setError(`USDC not available on this chain. Please switch to a supported chain.`);
          setStep('summary');
          return;
        }

        // Direct USDC transfer to creator on this chain
        // No approval needed for direct transfers - we can transfer directly
        setShouldPay(true);
        // Skip approval, go straight to transfer
      }
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
                <Badge variant={isOnArc ? "default" : "secondary"}>
                  {isOnArc ? 'Arc Testnet' : `Chain ${chainId}`}
                </Badge>
              </div>
              {!isConnected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Please connect your wallet first</AlertDescription>
                </Alert>
              )}
              {isConnected && !isOnArc && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {gatewayUSDC ? (
                      <>
                        You're on chain {chainId}. USDC will be sent directly to the creator's wallet on this chain.
                      </>
                    ) : (
                      <>
                        USDC not available on this chain. Please switch to a supported chain (Arc, Base, Arbitrum, Sepolia, etc.).
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {isConnected && isOnArc && (
                <Alert variant="default" className="border-green-500/20 bg-green-500/5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-green-700 dark:text-green-400">
                    You're on Arc Network. Payment will be processed directly.
                  </AlertDescription>
                </Alert>
              )}
              {isConnected && paymasterAvailable && !isOnArc && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="usePaymaster"
                        checked={usePaymaster}
                        onChange={(e) => setUsePaymaster(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="usePaymaster" className="cursor-pointer">
                        Pay gas fees in USDC (Circle Paymaster)
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Enable to pay gas in USDC instead of native token
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirm}
                  disabled={!isConnected || (!isOnArc && !gatewayUSDC && !paymasterAvailable)} 
                  className="flex-1"
                >
                  {!isConnected 
                    ? 'Connect Wallet First' 
                    : !isOnArc && !gatewayUSDC && !paymasterAvailable
                      ? 'Switch to Supported Chain'
                      : 'Confirm & Sign in Wallet'
                  }
                </Button>
              </div>
              {isConnected && !isOnArc && gatewayUSDC && (
                <p className="text-xs text-center text-muted-foreground">
                  💡 USDC will be sent directly to the creator's wallet on {chainId}. The creator can consolidate earnings from all chains later.
                </p>
              )}
              {isConnected && !isOnArc && !gatewayUSDC && (
                <p className="text-xs text-center text-muted-foreground">
                  💡 Please switch to a chain with USDC (Arc, Base, Arbitrum, Sepolia, etc.) using the chain selector in the top right.
                </p>
              )}
              {isConnected && isOnArc && (
                <p className="text-xs text-center text-muted-foreground">
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
                {usePaymaster && paymasterAvailable
                  ? 'Processing payment with paymaster (gas in USDC)...'
                  : isApproving 
                      ? 'Approving USDC...' 
                      : isPaying 
                        ? 'Processing payment...' 
                        : 'Waiting...'}
              </p>
              <p className="text-sm text-muted-foreground">
                {usePaymaster && paymasterAvailable
                  ? 'You may be prompted to sign permits and user operations. Gas will be paid in USDC.'
                  : 'Please confirm the transaction in your wallet'}
              </p>
              {paymasterTxHash && (
                <Alert className="mt-4">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Payment successful! Transaction: {paymasterTxHash.slice(0, 10)}...
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
