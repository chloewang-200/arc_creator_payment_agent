'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { processRefundTransaction } from '@/lib/refund-processing';
import type { Address } from 'viem';

interface PendingRefund {
  id: string;
  user_wallet_address: string;
  refund_amount_usd: number;
  original_amount_usd: number;
  fee_amount_usd: number;
  refund_type: string;
  created_at: string;
  chain_id?: number;
}

interface PendingRefundsProps {
  creatorId: string;
  creatorWallet: Address;
}

export function PendingRefunds({ creatorId, creatorWallet }: PendingRefundsProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [pendingRefunds, setPendingRefunds] = useState<PendingRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingRefunds();
  }, [creatorId]);

  const fetchPendingRefunds = async () => {
    try {
      const response = await fetch(`/api/refunds?creatorId=${creatorId}&status=pending`);
      const data = await response.json();
      if (data.refunds) {
        setPendingRefunds(data.refunds);
      }
    } catch (err) {
      console.error('Error fetching pending refunds:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRefund = async (refund: PendingRefund) => {
    if (!walletClient || !publicClient) {
      setError('Wallet not connected');
      return;
    }

    if (!isConnected || connectedAddress?.toLowerCase() !== creatorWallet.toLowerCase()) {
      setError('Please connect the creator wallet to approve refunds');
      return;
    }

    setProcessingId(refund.id);
    setError(null);

    try {
      const refundChainId = refund.chain_id || chainId;
      const result = await processRefundTransaction({
        creatorWallet,
        userWallet: refund.user_wallet_address as Address,
        amountUSD: refund.refund_amount_usd,
        chainId: refundChainId,
        walletClient,
        publicClient,
      });

      if (result.success && result.transactionHash) {
        // Update refund status
        await fetch('/api/refunds/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refundId: refund.id,
            transactionHash: result.transactionHash,
            status: 'completed',
          }),
        });

        // Refresh list
        await fetchPendingRefunds();
      } else {
        // Handle user rejection gracefully
        if (result.userRejected) {
          // Update refund status to rejected
          try {
            await fetch('/api/refunds/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                refundId: refund.id,
                status: 'rejected',
                rejected: true,
              }),
            });
          } catch (err) {
            console.error('Error updating refund status:', err);
          }
          setError('Transaction was cancelled. The refund request has been marked as rejected.');
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
        setError('Transaction was cancelled. The refund request remains pending and can be approved later.');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingRefunds.length === 0) {
    return (
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Clock className="w-5 h-5 text-blue-600" />
            Pending Refunds
          </CardTitle>
          <CardDescription className="text-slate-600">
            No pending refund requests
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const walletMatches = isConnected && connectedAddress?.toLowerCase() === creatorWallet.toLowerCase();

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Clock className="w-5 h-5 text-blue-600" />
          Pending Refunds ({pendingRefunds.length})
        </CardTitle>
        <CardDescription className="text-slate-600">
          Approve and process refund requests. Connect your creator wallet to approve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="w-4 h-4" />
              Connect your wallet to approve refunds
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

        <div className="space-y-3">
          {pendingRefunds.map((refund) => (
            <div
              key={refund.id}
              className="p-4 border border-slate-200 rounded-lg space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    Refund #{refund.id.slice(0, 8)}...
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    User: {refund.user_wallet_address.slice(0, 6)}...{refund.user_wallet_address.slice(-4)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(refund.created_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant="secondary">{refund.refund_type}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="ml-2 font-semibold">${refund.refund_amount_usd.toFixed(2)} USDC</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee:</span>
                  <span className="ml-2">-${refund.fee_amount_usd.toFixed(2)} USDC</span>
                </div>
              </div>

              <Button
                onClick={() => handleApproveRefund(refund)}
                disabled={!walletMatches || processingId === refund.id}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                size="sm"
              >
                {processingId === refund.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve & Process Refund
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

