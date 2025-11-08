'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import type { RefundIntent } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RefundModalProps {
  intent: RefundIntent;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper function to get block explorer URL for a transaction
function getBlockExplorerUrl(chainId: number, txHash: string): string {
  const explorerUrls: Record<number, string> = {
    5042002: 'https://testnet.arcscan.app', // Arc Testnet
    11155111: 'https://sepolia.etherscan.io', // Ethereum Sepolia
    84532: 'https://sepolia.basescan.org', // Base Sepolia
    1328: 'https://seitrace.com', // Sei Testnet
  };
  
  const baseUrl = explorerUrls[chainId] || explorerUrls[5042002]; // Default to Arc
  return `${baseUrl}/tx/${txHash}`;
}

export function RefundModal({ intent, onClose, onSuccess }: RefundModalProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<'summary' | 'processing' | 'success'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRefund = async () => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    // Prevent double-submission
    if (isProcessing || step === 'processing' || step === 'success') {
      return;
    }

    setIsProcessing(true);
    setStep('processing');
    setError(null);

    try {
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: intent.creatorId,
          userWalletAddress: address,
          transactionId: intent.transactionId,
          refundType: intent.kind,
          amountUSD: intent.amountUSD,
          chainId: intent.chainId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Check if refund was automatically processed (even without transactionHash)
        const isAutomatedSuccess = 
          data.refund?.status === 'completed' ||
          data.refund?.automated === true ||
          (data.refund?.message && data.refund.message.includes('automatically processed')) ||
          (data.refund?.message && data.refund.message.includes('has been automatically processed'));

        if (data.refund.transactionHash) {
          setTransactionHash(data.refund.transactionHash);
          setStep('success');
        } else if (isAutomatedSuccess) {
          // Automated refund succeeded but transactionHash not available yet (Circle async processing)
          // Store challengeId if available
          if (data.refund.challengeId || data.challengeId) {
            setChallengeId(data.refund.challengeId || data.challengeId);
          }
          setStep('success');
        } else {
          // Manual approval required
          setError(data.refund.message || 'Refund request submitted for manual approval.');
          setStep('summary');
        }
      } else {
        setError(data.error || data.reason || 'Failed to process refund');
        setStep('summary');
      }
    } catch (err: any) {
      console.error('Refund error:', err);
      setError(err.message || 'Failed to process refund');
      setStep('summary');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onSuccess();
    }
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'success' ? '✅ Refund Completed' : 'Request Refund'}
          </DialogTitle>
          <DialogDescription>
            {step === 'summary' && 'Review your refund details'}
            {step === 'processing' && 'Processing your refund...'}
            {step === 'success' && 'Your refund has been processed!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          {step === 'summary' && (
            <>
              <div className="space-y-3">
                {intent.postTitle && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Post:</span>
                    <span className="font-medium">{intent.postTitle}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Type:</span>
                  <span className="font-medium capitalize">{intent.kind}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Refund Amount:</span>
                  <span className="font-medium text-lg">${intent.amountUSD.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  This will automatically process your refund and send USDC to your wallet. Your access to this content will be revoked.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleRefund}
                disabled={isProcessing}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Confirm Refund'}
              </Button>
            </>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">Processing refund...</p>
              <p className="text-xs text-slate-500">This may take a few seconds</p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">Refund Sent!</h3>
                <p className="text-sm text-slate-600 text-center">
                  ${intent.amountUSD.toFixed(2)} USDC has been sent to your wallet
                </p>
              </div>

              {(transactionHash || challengeId) && (
                <div className="space-y-3">
                  {transactionHash && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 font-medium">Transaction Hash:</p>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <code className="text-xs break-all text-slate-800">
                          {transactionHash}
                        </code>
                      </div>
                      <a
                        href={getBlockExplorerUrl(intent.chainId || 5042002, transactionHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        View on Block Explorer
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                  
                  {challengeId && !transactionHash && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 font-medium">Circle Transaction ID:</p>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <code className="text-xs break-all text-slate-800">
                          {challengeId}
                        </code>
                      </div>
                      <p className="text-xs text-slate-500">
                        Transaction is being processed by Circle. The on-chain transaction hash will be available once processing completes.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
