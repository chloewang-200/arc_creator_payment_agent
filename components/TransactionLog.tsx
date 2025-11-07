'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Receipt } from 'lucide-react';
import { ARC_CHAIN_ID } from '@/lib/config';
import { formatDistanceToNow } from 'date-fns';

interface Transaction {
  id: string;
  type: 'unlock' | 'subscription' | 'recurringTip' | 'tip';
  transactionHash: string | null;
  amount?: number;
  createdAt: string;
  postId?: string;
  postTitle?: string;
  creatorId?: string;
  walletAddress: string;
}

interface TransactionLogProps {
  creatorId?: string;
  walletAddress?: `0x${string}`;
}

export function TransactionLog({ creatorId, walletAddress }: TransactionLogProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!creatorId && !walletAddress) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (walletAddress) {
          params.append('walletAddress', walletAddress);
        }
        if (creatorId) {
          params.append('creatorId', creatorId);
        }

        const response = await fetch(`/api/transactions?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch transactions');
        }

        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (err: any) {
        console.error('❌ Error loading transactions:', err);
        setError(err.message || 'Failed to load transactions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [creatorId, walletAddress]);

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'unlock':
        return 'Post Unlock';
      case 'subscription':
        return 'Monthly Subscription';
      case 'recurringTip':
        return 'Recurring Tip';
      case 'tip':
        return 'One-time Tip';
      default:
        return type;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'unlock':
        return 'blue';
      case 'subscription':
        return 'secondary';
      case 'recurringTip':
        return 'outline';
      case 'tip':
        return 'default';
      default:
        return 'default';
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://testnet.arcscan.app/tx/${txHash}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            All transactions through the platform will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No transactions yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Transaction History
        </CardTitle>
        <CardDescription>
          All transactions through the platform to your wallet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge 
                    variant={getTransactionTypeColor(tx.type) === 'blue' ? 'default' : getTransactionTypeColor(tx.type) as any}
                    className={getTransactionTypeColor(tx.type) === 'blue' ? 'bg-blue-600 text-white border-0' : ''}
                  >
                    {getTransactionTypeLabel(tx.type)}
                  </Badge>
                  {tx.amount !== undefined && tx.amount > 0 && (
                    <span className="font-semibold">${tx.amount.toFixed(2)} USDC</span>
                  )}
                </div>
                {tx.postTitle && (
                  <p className="text-sm text-muted-foreground mb-1">
                    Post: {tx.postTitle}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                </p>
              </div>
              {tx.transactionHash && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="ml-4"
                >
                  <a
                    href={getExplorerUrl(tx.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

