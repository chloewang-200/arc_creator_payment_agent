'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, RefreshCw } from 'lucide-react';

interface PlatformEarningsProps {
  creatorId: string;
}

interface ChainEarning {
  chainId: number;
  chainName: string;
  amount: number;
}

const CHAIN_NAMES: Record<number, string> = {
  5042002: 'Arc Testnet',
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
  420: 'Optimism Sepolia',
  1328: 'Sei Testnet',
};

export function PlatformEarnings({ creatorId }: PlatformEarningsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chainEarnings, setChainEarnings] = useState<ChainEarning[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);

  const fetchEarnings = async () => {
    if (!creatorId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/transactions?creatorId=${creatorId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      const transactions = data.transactions || [];

      // Group earnings by chain
      const earningsByChain: Record<number, number> = {};

      for (const tx of transactions) {
        const chainId = tx.chainId || 5042002; // Default to Arc Testnet if not specified
        const amount = tx.amount || 0;

        if (amount > 0) {
          earningsByChain[chainId] = (earningsByChain[chainId] || 0) + amount;
        }
      }

      // Convert to array format
      const earnings: ChainEarning[] = Object.entries(earningsByChain).map(([chainId, amount]) => ({
        chainId: parseInt(chainId),
        chainName: CHAIN_NAMES[parseInt(chainId)] || `Chain ${chainId}`,
        amount,
      }));

      earnings.sort((a, b) => b.amount - a.amount);
      setChainEarnings(earnings);

      const total = earnings.reduce((sum, chain) => sum + chain.amount, 0);
      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEarnings, 30000);
    return () => clearInterval(interval);
  }, [creatorId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEarnings();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Platform Earnings
            </CardTitle>
            <CardDescription>
              Total USDC earned on the platform across all chains
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-3xl font-bold mb-1">
              ${totalEarnings.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {chainEarnings.length > 0
                ? `Across ${chainEarnings.length} chain${chainEarnings.length > 1 ? 's' : ''}`
                : 'No earnings yet'}
            </p>
          </div>

          {chainEarnings.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Earnings by Chain
              </p>
              {chainEarnings.map((chain) => (
                <div key={chain.chainId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{chain.chainName}</span>
                  <Badge variant="secondary">
                    ${chain.amount.toFixed(2)} USDC
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              💡 This shows your total earnings from all transactions on the platform, not your wallet balance.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

