'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, RefreshCw, Wallet } from 'lucide-react';
import { formatUnits, erc20Abi } from 'viem';
import { createPublicClient, http } from 'viem';
import { getGatewayUSDCAddress } from '@/lib/gateway';
import { USDC_DECIMALS, ARC_CHAIN_ID, ARC_RPC_URL } from '@/lib/config';
import * as chains from 'viem/chains';

interface PlatformEarningsProps {
  creatorId: string;
  creatorAddress?: `0x${string}`;
}

interface ChainEarning {
  chainId: number;
  chainName: string;
  amount: number;
}

interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: number;
}

const CHAIN_NAMES: Record<number, string> = {
  5042002: 'Arc Testnet',
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
  420: 'Optimism Sepolia',
  1328: 'Sei Testnet',
};

const SUPPORTED_CHAINS = [
  { id: ARC_CHAIN_ID, name: 'Arc Testnet', rpc: ARC_RPC_URL },
  { id: chains.sepolia.id, name: 'Ethereum Sepolia', rpc: chains.sepolia.rpcUrls.default.http[0] },
  { id: chains.baseSepolia.id, name: 'Base Sepolia', rpc: chains.baseSepolia.rpcUrls.default.http[0] },
  { id: 1328, name: 'Sei Testnet', rpc: 'https://evm-rpc-testnet.sei-apis.com' },
];

export function PlatformEarnings({ creatorId, creatorAddress }: PlatformEarningsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chainEarnings, setChainEarnings] = useState<ChainEarning[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);

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

  const fetchWalletBalances = async () => {
    if (!creatorAddress) {
      setIsLoadingBalances(false);
      return;
    }

    setIsLoadingBalances(true);
    const balances: ChainBalance[] = [];

    // Query all chains in parallel using Circle Gateway USDC addresses
    await Promise.allSettled(
      SUPPORTED_CHAINS.map(async (chain) => {
        try {
          const usdcAddress = getGatewayUSDCAddress(chain.id);
          if (!usdcAddress) {
            console.warn(`[PlatformEarnings] No USDC address for ${chain.name} (${chain.id})`);
            return;
          }

          const client = createPublicClient({
            chain: {
              id: chain.id,
              name: chain.name,
              network: chain.name.toLowerCase().replace(/\s+/g, '-'),
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: { default: { http: [chain.rpc] } },
            },
            transport: http(chain.rpc, {
              timeout: 10000, // 10 second timeout
              retryCount: 2,
            }),
          });

          const balance = await Promise.race([
            client.readContract({
              address: usdcAddress,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [creatorAddress],
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            ),
          ]) as bigint;

          const balanceUSD = parseFloat(formatUnits(balance, USDC_DECIMALS));
          console.log(`[PlatformEarnings] ${chain.name} (${chain.id}): ${balanceUSD} USDC at ${usdcAddress}`);
          if (balanceUSD > 0) {
            balances.push({
              chainId: chain.id,
              chainName: chain.name,
              balance: balanceUSD,
            });
          }
        } catch (error: any) {
          console.error(`[PlatformEarnings] Error fetching balance on ${chain.name} (${chain.id}):`, error?.message || error);
          console.error(`[PlatformEarnings] RPC: ${chain.rpc}, USDC Address: ${getGatewayUSDCAddress(chain.id)}, Creator Address: ${creatorAddress}`);
        }
      })
    );

    balances.sort((a, b) => b.balance - a.balance);
    setChainBalances(balances);
    const total = balances.reduce((sum, chain) => sum + chain.balance, 0);
    setTotalBalance(total);
    setIsLoadingBalances(false);
  };

  useEffect(() => {
    fetchEarnings();
    fetchWalletBalances();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchEarnings();
      fetchWalletBalances();
    }, 30000);
    return () => clearInterval(interval);
  }, [creatorId, creatorAddress]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchEarnings(), fetchWalletBalances()]);
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
        <div className="space-y-6">
          {/* Wallet Balance Section */}
          {creatorAddress && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Unified Wallet Balance
                </p>
              </div>
              <div>
                <div className="text-2xl font-bold mb-1">
                  ${totalBalance.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isLoadingBalances
                    ? 'Loading balances...'
                    : chainBalances.length > 0
                    ? `Across ${chainBalances.length} chain${chainBalances.length > 1 ? 's' : ''}`
                    : 'No balance found'}
                </p>
              </div>

              {chainBalances.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  {chainBalances.map((chain) => (
                    <div key={chain.chainId} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{chain.chainName}</span>
                      <Badge variant="outline">
                        ${chain.balance.toFixed(2)} USDC
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Platform Earnings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Platform Earnings (Ledger)
              </p>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">
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
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              💡 Wallet Balance shows what's in your wallet. Platform Earnings shows what you've earned on the platform (may not be in wallet yet if not consolidated).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

