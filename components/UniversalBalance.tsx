'use client';

import { useAccount, useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUSDCAddress, supportsCCTP } from '@/lib/cctp';
import { USDC_ABI } from '@/lib/contracts';
import { USDC_DECIMALS, ARC_CHAIN_ID, ARC_RPC_URL } from '@/lib/config';
import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';

interface UniversalBalanceProps {
  creatorAddress?: `0x${string}`;
}

export function UniversalBalance({ creatorAddress }: UniversalBalanceProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const targetAddress = creatorAddress || address;
  const [arcBalance, setArcBalance] = useState<bigint | null>(null);
  const [arcBalanceError, setArcBalanceError] = useState<Error | null>(null);
  
  // Debug logging
  useEffect(() => {
    if (creatorAddress) {
      console.log('🔍 UniversalBalance checking:', {
        creatorAddress,
        chainId,
        targetAddress,
      });
    }
  }, [creatorAddress, chainId, targetAddress]);
  
  const usdcAddress = getUSDCAddress(chainId);
  const arcUsdcAddress = getUSDCAddress(ARC_CHAIN_ID);

  // Read USDC balance on current chain
  const { data: balance, refetch } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress && !!usdcAddress,
    },
  });

  // Fetch Arc balance directly using public client (more reliable for cross-chain queries)
  useEffect(() => {
    if (!targetAddress || !arcUsdcAddress) return;

    const fetchArcBalance = async () => {
      try {
        const arcClient = createPublicClient({
          chain: {
            id: ARC_CHAIN_ID,
            name: 'Arc',
            network: 'arc-testnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: { default: { http: [ARC_RPC_URL] } },
          },
          transport: http(ARC_RPC_URL),
        });

        const balance = await arcClient.readContract({
          address: arcUsdcAddress,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [targetAddress],
        });

        setArcBalance(balance);
        setArcBalanceError(null);
      } catch (error: any) {
        console.error('❌ Error fetching Arc balance:', error);
        setArcBalanceError(error);
        setArcBalance(null);
      }
    };

    fetchArcBalance();
    // Refresh every 10 seconds
    const interval = setInterval(fetchArcBalance, 10000);
    return () => clearInterval(interval);
  }, [targetAddress, arcUsdcAddress]);

  const refetchArc = async () => {
    if (!targetAddress || !arcUsdcAddress) return;
    try {
      const arcClient = createPublicClient({
        chain: {
          id: ARC_CHAIN_ID,
          name: 'Arc',
          network: 'arc-testnet',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [ARC_RPC_URL] } },
        },
        transport: http(ARC_RPC_URL),
      });

      const balance = await arcClient.readContract({
        address: arcUsdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [targetAddress],
      });

      setArcBalance(balance);
      setArcBalanceError(null);
    } catch (error: any) {
      console.error('❌ Error fetching Arc balance:', error);
      setArcBalanceError(error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchArc()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // For creators, always show Arc balance (where payments are received)
  // For users, show current chain + Arc balance
  const currentBalance = balance ? parseFloat(formatUnits(balance, USDC_DECIMALS)) : 0;
  const arcBalanceAmount = arcBalance ? parseFloat(formatUnits(arcBalance, USDC_DECIMALS)) : 0;

  // If checking creator address, always show Arc balance (where payments are received)
  // If checking user's own address, show current chain + Arc
  const totalBalance = creatorAddress 
    ? arcBalanceAmount  // Creators receive all payments on Arc
    : (chainId === ARC_CHAIN_ID ? currentBalance : currentBalance + arcBalanceAmount);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Universal USDC Balance
            </CardTitle>
            <CardDescription>
              Your balance across all chains (unified on Arc)
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-3xl font-bold mb-1">
              ${totalBalance.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">Total USDC</p>
          </div>

          {chainId !== ARC_CHAIN_ID && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Chain ({chainId})</span>
                <Badge variant="secondary">
                  ${currentBalance.toFixed(2)} USDC
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Arc Network</span>
                <Badge variant="secondary">
                  ${arcBalanceAmount.toFixed(2)} USDC
                </Badge>
              </div>
              {supportsCCTP(chainId) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    💡 Use CCTP to transfer USDC from this chain to Arc
                  </p>
                </div>
              )}
            </>
          )}

          {chainId === ARC_CHAIN_ID && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">On Arc Network</span>
              <Badge variant="default">
                ${(creatorAddress ? arcBalanceAmount : currentBalance).toFixed(2)} USDC
              </Badge>
            </div>
          )}
          
          {creatorAddress && chainId !== ARC_CHAIN_ID && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Arc Network (Creator Wallet)</span>
              <Badge variant="default">
                ${arcBalanceAmount.toFixed(2)} USDC
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

