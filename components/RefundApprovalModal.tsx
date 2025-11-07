'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { processRefundTransaction } from '@/lib/refund-processing';
import type { Address } from 'viem';

interface RefundApprovalModalProps {
  refund: {
    id: string;
    userWalletAddress: string;
    refundAmount: number;
    originalAmount: number;
    feeAmount: number;
    refundType: string;
    chainId?: number;
  };
  creatorWallet: Address;
  onApprove: (txHash: string) => void;
  onClose: () => void;
}

export function RefundApprovalModal({
  refund,
  creatorWallet,
  onApprove,
  onClose,
}: RefundApprovalModalProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Check if connected wallet matches creator wallet
  const walletMatches = isConnected && connectedAddress?.toLowerCase() === creatorWallet.toLowerCase();
  const refundChainId = refund.chainId || chainId;

  const handleApprove = async () => {
    if (!walletClient || !publicClient) {
      setError('Wallet not connected');
      return;
    }

    if (!walletMatches) {
      setError('Please connect the creator wallet to approve this refund');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await processRefundTransaction({
        creatorWallet,
        userWallet: refund.userWalletAddress as Address,
        amountUSD: refund.refundAmount,
        chainId: refundChainId,
        walletClient,
        publicClient,
      });

      if (result.success && result.transactionHash) {
        setTxHash(result.transactionHash);
        onApprove(result.transactionHash);
      } else {
        // Handle user rejection gracefully
        if (result.userRejected) {
          setError('Transaction was cancelled. You can try again later.');
        } else {
          setError(result.error || 'Failed to process refund');
        }
      }
    } catch (err: any) {
      // Check if it's a user rejection error
      const errorMessage = err.message || err.shortMessage || '';
      const isUserRejection = 
        errorMessage.includes('User denied') ||
        errorMessage.includes('User rejected') ||
        errorMessage.includes('user rejected') ||
        errorMessage.includes('rejected') ||
        errorMessage.includes('denied') ||
        err.code === 4001 ||
        err.code === 'ACTION_REJECTED';
      
      if (isUserRejection) {
        setError('Transaction was cancelled. You can try again later.');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Approve Refund
        </CardTitle>
        <CardDescription>
          Review and approve this refund request
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">User:</span>
            <span className="font-mono text-xs">{refund.userWalletAddress.slice(0, 6)}...{refund.userWalletAddress.slice(-4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Original Amount:</span>
            <span>${refund.originalAmount.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Processing Fee (2%):</span>
            <span>-${refund.feeAmount.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span>Refund Amount:</span>
            <span>${refund.refundAmount.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="secondary">{refund.refundType}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Chain:</span>
            <span>{refundChainId}</span>
          </div>
        </div>

        {!isConnected && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="w-4 h-4" />
              Please connect your wallet to approve this refund
            </div>
          </div>
        )}

        {isConnected && !walletMatches && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
            <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-200">
              <AlertCircle className="w-4 h-4" />
              Connected wallet doesn't match creator wallet. Please connect: {creatorWallet.slice(0, 6)}...{creatorWallet.slice(-4)}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {txHash && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <CheckCircle2 className="w-4 h-4" />
              Refund processed! Transaction: {txHash.slice(0, 10)}...
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1"
          >
            Close
          </Button>
          {!txHash && (
            <Button
              onClick={handleApprove}
              disabled={isProcessing || !walletMatches || !isConnected}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Approve Refund'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

