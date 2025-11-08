'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, CheckCircle2, XCircle, Clock, ExternalLink, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RefundHistoryItem {
  id: string;
  user_wallet_address: string;
  refund_amount_usd: number;
  original_amount_usd: number;
  fee_amount_usd: number;
  refund_type: string;
  status: string;
  refund_transaction_hash?: string;
  circle_transaction_id?: string; // Circle transaction/challenge ID
  chain_id?: number;
  reason?: string;
  created_at: string;
  processed_at?: string;
  updated_at: string;
}

interface RefundHistoryProps {
  creatorId: string;
}

// Helper function to get block explorer URL for a transaction
function getBlockExplorerUrl(chainId: number | undefined, txHash: string): string {
  const explorerUrls: Record<number, string> = {
    5042002: 'https://testnet.arcscan.app', // Arc Testnet
    11155111: 'https://sepolia.etherscan.io', // Ethereum Sepolia
    84532: 'https://sepolia.basescan.org', // Base Sepolia
    1328: 'https://seitrace.com', // Sei Testnet
  };
  
  const baseUrl = chainId && explorerUrls[chainId] ? explorerUrls[chainId] : explorerUrls[5042002];
  return `${baseUrl}/tx/${txHash}`;
}

export function RefundHistory({ creatorId }: RefundHistoryProps) {
  const [refunds, setRefunds] = useState<RefundHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRefundHistory();
  }, [creatorId]);

  const fetchRefundHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch completed and failed refunds
      const response = await fetch(`/api/refunds?creatorId=${creatorId}&status=completed,failed,rejected`);
      const data = await response.json();
      if (data.refunds) {
        // Sort by most recent first
        const sorted = data.refunds.sort((a: RefundHistoryItem, b: RefundHistoryItem) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRefunds(sorted);
      }
    } catch (err) {
      console.error('Error fetching refund history:', err);
      setError('Failed to load refund history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const getRefundTypeLabel = (type: string) => {
    switch (type) {
      case 'unlock':
        return 'Content Unlock';
      case 'subscription':
        return 'Subscription';
      case 'tip':
        return 'Tip';
      case 'recurringTip':
        return 'Recurring Tip';
      default:
        return type;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Refund History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Refund History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Refund History
        </CardTitle>
        <CardDescription>
          View all processed refunds, including completed, failed, and rejected refunds
        </CardDescription>
      </CardHeader>
      <CardContent>
        {refunds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No refund history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {refunds.map((refund) => (
              <div
                key={refund.id}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(refund.status)}
                      <Badge variant="outline" className="text-xs">
                        {getRefundTypeLabel(refund.refund_type)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-900">
                          ${refund.refund_amount_usd.toFixed(2)} USDC
                        </span>
                        {refund.fee_amount_usd > 0 && (
                          <span className="text-xs text-slate-500">
                            (fee: ${refund.fee_amount_usd.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">
                        User: <span className="font-mono">{formatAddress(refund.user_wallet_address)}</span>
                      </div>
                      {refund.reason && (
                        <div className="text-xs text-slate-500 italic">
                          Reason: {refund.reason}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{formatDistanceToNow(new Date(refund.created_at), { addSuffix: true })}</div>
                    {refund.processed_at && (
                      <div className="mt-1">
                        Processed {formatDistanceToNow(new Date(refund.processed_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
                
                {(refund.refund_transaction_hash || refund.circle_transaction_id) && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    {refund.refund_transaction_hash && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600">On-chain TX:</span>
                        <code className="text-slate-800 bg-slate-100 px-2 py-1 rounded font-mono">
                          {formatAddress(refund.refund_transaction_hash)}
                        </code>
                        <a
                          href={getBlockExplorerUrl(refund.chain_id, refund.refund_transaction_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {refund.circle_transaction_id && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600">Circle TX ID:</span>
                        <code className="text-slate-800 bg-slate-100 px-2 py-1 rounded font-mono">
                          {refund.circle_transaction_id}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

