'use client';

import { useAccount, useChainId } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGatewayUSDCAddress } from '@/lib/gateway';
import { USDC_DECIMALS, ARC_CHAIN_ID, ARC_RPC_URL } from '@/lib/config';
import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import * as chains from 'viem/chains';

interface UniversalBalanceProps {
  creatorAddress?: `0x${string}`;
}

// Supported chains for unified balance
const SUPPORTED_CHAINS = [
  { id: ARC_CHAIN_ID, name: 'Arc Testnet', rpc: ARC_RPC_URL },
  { id: chains.sepolia.id, name: 'Ethereum Sepolia', rpc: chains.sepolia.rpcUrls.default.http[0] },
  { id: chains.baseSepolia.id, name: 'Base Sepolia', rpc: chains.baseSepolia.rpcUrls.default.http[0] },
  { id: chains.optimismSepolia.id, name: 'Optimism Sepolia', rpc: chains.optimismSepolia.rpcUrls.default.http[0] },
  { id: 1328, name: 'Sei Testnet', rpc: 'https://evm-rpc-testnet.sei-apis.com' },
];

interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: number;
}

export function UniversalBalance({ creatorAddress }: UniversalBalanceProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetAddress = creatorAddress || address;

  // Fetch balances from all supported chains
  const fetchAllBalances = async () => {
    if (!targetAddress) return;

    setIsLoading(true);
    const balances: ChainBalance[] = [];

    // Query all chains in parallel
    await Promise.all(
      SUPPORTED_CHAINS.map(async (chain) => {
        try {
          const usdcAddress = getGatewayUSDCAddress(chain.id);
          if (!usdcAddress) return;

          const client = createPublicClient({
            chain: {
              id: chain.id,
              name: chain.name,
              network: chain.name.toLowerCase().replace(/\s+/g, '-'),
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: { default: { http: [chain.rpc] } },
            },
            transport: http(chain.rpc),
          });

          const balance = await client.readContract({
            address: usdcAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [targetAddress],
          });

          const balanceUSD = parseFloat(formatUnits(balance, USDC_DECIMALS));
          if (balanceUSD > 0) {
            balances.push({
              chainId: chain.id,
              chainName: chain.name,
              balance: balanceUSD,
            });
          }
        } catch (error: any) {
          console.error(`Error fetching balance on ${chain.name}:`, error);
        }
      })
    );

    setChainBalances(balances.sort((a, b) => b.balance - a.balance));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllBalances();
    // Refresh every 15 seconds
    const interval = setInterval(fetchAllBalances, 15000);
    return () => clearInterval(interval);
  }, [targetAddress]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllBalances();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const totalBalance = chainBalances.reduce((sum, chain) => sum + chain.balance, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Unified USDC Balance
            </CardTitle>
            <CardDescription>
              {creatorAddress ? 'Creator earnings across all chains' : 'Your balance across all supported chains'}
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
              ${totalBalance.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {chainBalances.length > 0
                ? `Across ${chainBalances.length} chain${chainBalances.length > 1 ? 's' : ''}`
                : 'No balance found'}
            </p>
          </div>

          {chainBalances.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Balance Breakdown
              </p>
              {chainBalances.map((chain) => (
                <div key={chain.chainId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{chain.chainName}</span>
                  <Badge variant={chain.chainId === chainId ? "default" : "secondary"}>
                    ${chain.balance.toFixed(2)} USDC
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              💡 {creatorAddress
                ? 'Fans can pay on any chain. Your total across all chains.'
                : 'Your USDC is accessible across all chains. Pay creators on your current chain!'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

