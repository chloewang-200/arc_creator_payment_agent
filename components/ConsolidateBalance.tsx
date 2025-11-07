'use client';

import { useAccount, useChainId, useSwitchChain, useWalletClient, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownToLine, Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getGatewayUSDCAddress, getGatewayGasFee } from '@/lib/gateway';
import { USDC_DECIMALS, ARC_CHAIN_ID } from '@/lib/config';
import { useState, useEffect } from 'react';
import { createPublicClient, http, type Address } from 'viem';
import * as chains from 'viem/chains';
import { transferUSDCViaGateway } from '@/lib/gateway';
import { getContract } from 'viem';
import { GATEWAY_MINTER_ADDRESS, GATEWAY_MINTER_ABI, getGatewayDomain } from '@/lib/gateway';

interface ConsolidateBalanceProps {
  creatorAddress: `0x${string}`;
  creatorId?: string; // Optional: if provided, show earnings instead of wallet balance
  onConsolidationComplete?: () => void;
}

interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: number;
}

interface ConsolidationStep {
  chainId: number;
  chainName: string;
  balance: number;
  status: 'pending' | 'bridging' | 'completed' | 'error';
  error?: string;
  txHash?: string;
}

// Supported chains for consolidation
// Note: These should match the chains in wagmi-config.ts
const SUPPORTED_CHAINS = [
  { id: chains.sepolia.id, name: 'Ethereum Sepolia', rpc: chains.sepolia.rpcUrls.default.http[0] },
  { id: chains.baseSepolia.id, name: 'Base Sepolia', rpc: chains.baseSepolia.rpcUrls.default.http[0] },
  { id: 1328, name: 'Sei Testnet', rpc: 'https://evm-rpc-testnet.sei-apis.com' },
];

export function ConsolidateBalance({ creatorAddress, creatorId, onConsolidationComplete }: ConsolidateBalanceProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Need to create public clients for each chain since we switch chains
  const getPublicClientForChain = (chainId: number) => {
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    if (!chain) return publicClient;
    
    return createPublicClient({
      chain: {
        id: chain.id,
        name: chain.name,
        network: chain.name.toLowerCase().replace(/\s+/g, '-'),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [chain.rpc] } },
      },
      transport: http(chain.rpc),
    });
  };
  
  // For Gateway: we need to approve and deposit to Gateway Wallet first
  // But Gateway actually works directly from user's wallet via burn intents
  // The sourceContract in burn intent is Gateway Wallet, but sourceDepositor is user's address
  // This means Gateway can transfer directly without requiring deposit first
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [consolidationSteps, setConsolidationSteps] = useState<ConsolidationStep[]>([]);
  const [isConsolidating, setIsConsolidating] = useState(false);

  // Fetch earnings from transactions if creatorId is provided, otherwise fetch wallet balances
  const fetchBalances = async () => {
    if (!creatorAddress) return;

    setIsLoading(true);
    const balances: ChainBalance[] = [];

    if (creatorId) {
      // Fetch earnings from platform transactions
      try {
        const response = await fetch(`/api/transactions?creatorId=${creatorId}`);
        if (response.ok) {
          const data = await response.json();
          const transactions = data.transactions || [];

          // Group earnings by chain
          const earningsByChain: Record<number, number> = {};
          for (const tx of transactions) {
            const chainId = tx.chainId || 5042002; // Default to Arc Testnet
            const amount = tx.amount || 0;
            if (amount > 0) {
              earningsByChain[chainId] = (earningsByChain[chainId] || 0) + amount;
            }
          }

          // Convert to ChainBalance format (only include supported chains)
          for (const chain of SUPPORTED_CHAINS) {
            const earnings = earningsByChain[chain.id] || 0;
            if (earnings > 0) {
              balances.push({
                chainId: chain.id,
                chainName: chain.name,
                balance: earnings,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching earnings:', error);
      }
    } else {
      // Fetch actual wallet balances from blockchain
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
              args: [creatorAddress],
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
    }

    setChainBalances(balances.sort((a, b) => b.balance - a.balance));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBalances();
    // Refresh every 15 seconds
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [creatorAddress, creatorId]);

  const totalConsolidatable = chainBalances.reduce((sum, chain) => sum + chain.balance, 0);
  
  // Gateway requires chain-specific gas fees per transfer
  // Filter out chains where balance is too small to cover the fee
  // Fee is deducted from balance, so we need balance > fee
  const consolidatableChains = chainBalances.filter(chain => {
    const gasFee = getGatewayGasFee(chain.chainId);
    const transferFee = 0.0005; // Increased buffer to meet Gateway's minimum requirements
    // Gateway may require slightly more than base fee, so add 5% buffer
    const totalFee = Math.max(gasFee + transferFee, gasFee * 1.05);
    return chain.balance > totalFee; // Must be greater than fee (not >=) since fee is deducted
  });
  // Calculate net amount after fees (fees are deducted from balance)
  const totalConsolidatableAfterFee = consolidatableChains.reduce((sum, chain) => {
    const gasFee = getGatewayGasFee(chain.chainId);
    const transferFee = 0.0005;
    // Gateway may require slightly more than base fee, so add 5% buffer
    const totalFee = Math.max(gasFee + transferFee, gasFee * 1.05);
    return sum + (chain.balance - totalFee);
  }, 0);

  const handleStartConsolidation = async () => {
    // Fetch actual wallet balances for consolidation (not earnings)
    const actualBalances = await fetchActualWalletBalances();
    
    // Filter consolidatable chains based on actual wallet balances
    const consolidatableChains = actualBalances.filter(chain => {
      const gasFee = getGatewayGasFee(chain.chainId);
      const transferFee = 0.0001;
      const totalFee = gasFee + transferFee;
      return chain.balance > totalFee;
    });
    
    // Only consolidate chains where balance is sufficient to cover the Gateway fee
    const steps: ConsolidationStep[] = consolidatableChains.map(chain => ({
      chainId: chain.chainId,
      chainName: chain.chainName,
      balance: chain.balance,
      status: 'pending' as const,
    }));
    setConsolidationSteps(steps);
    setShowConsolidateModal(true);
  };

  // Fetch actual wallet balances for consolidation (regardless of whether we're showing earnings)
  const fetchActualWalletBalances = async (): Promise<ChainBalance[]> => {
    const balances: ChainBalance[] = [];
    
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
            args: [creatorAddress],
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
    
    return balances.sort((a, b) => b.balance - a.balance);
  };

  const executeConsolidation = async () => {
    // For consolidation, the creator must connect their own wallet
    if (!address) {
      throw new Error('Please connect your wallet to consolidate balances');
    }
    
    // Ensure the connected wallet is the creator's wallet
    if (address.toLowerCase() !== creatorAddress.toLowerCase()) {
      throw new Error(`Connected wallet (${address}) does not match creator address (${creatorAddress}). Please connect the creator's wallet to consolidate.`);
    }

    setIsConsolidating(true);
    
    // Always use actual wallet balances for consolidation, not earnings
    const actualBalances = await fetchActualWalletBalances();
    
    // Filter consolidatable chains based on actual wallet balances
    const consolidatableChains = actualBalances.filter(chain => {
      const gasFee = getGatewayGasFee(chain.chainId);
      const transferFee = 0.0005;
      // Gateway may require slightly more than base fee, so add 5% buffer
      const totalFee = Math.max(gasFee + transferFee, gasFee * 1.05);
      return chain.balance > totalFee;
    });
    
    // Update consolidation steps with actual balances
    const steps: ConsolidationStep[] = consolidatableChains.map(chain => ({
      chainId: chain.chainId,
      chainName: chain.chainName,
      balance: chain.balance,
      status: 'pending' as const,
    }));
    
    setConsolidationSteps(steps);
    
    // Wrap in try-catch to prevent errors from causing page reload
    try {
      for (let i = 0; i < consolidationSteps.length; i++) {
        const step = consolidationSteps[i];

        try {
          // Switch to the source chain first
          console.log(`Switching to ${step.chainName} (${step.chainId})...`);
          await switchChain?.({ chainId: step.chainId });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for chain switch

          // Update status to bridging
          setConsolidationSteps(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'bridging' as const } : s
          ));

          // Use Gateway to bridge USDC to Arc
          console.log(`Bridging $${step.balance} from ${step.chainName} to Arc using Gateway...`);
          
          if (!walletClient || !publicClient) {
            throw new Error('Wallet client or public client not available');
          }

          // Step 1: Create burn intent and sign on source chain
          // Use chain-specific public client for the source chain
          const sourcePublicClient = getPublicClientForChain(step.chainId);
          
          // Check if Gateway is supported before attempting transfer
          // Note: domain 0 is valid (Ethereum), so we check for undefined/null explicitly
          const sourceDomain = getGatewayDomain(step.chainId);
          const destDomain = getGatewayDomain(ARC_CHAIN_ID);
          if (sourceDomain === undefined || sourceDomain === null || destDomain === undefined || destDomain === null) {
            throw new Error(`Gateway not supported: source chain ${step.chainId} (domain: ${sourceDomain}), destination chain ${ARC_CHAIN_ID} (domain: ${destDomain})`);
          }
          
          const result = await transferUSDCViaGateway({
            sourceChainId: step.chainId,
            amountUSD: step.balance, // Pass full balance, fee will be deducted internally
            recipientAddress: creatorAddress,
            walletClient,
            publicClient: sourcePublicClient,
            sourceAddress: creatorAddress, // Use creator's address for balance check and as sourceDepositor
          });

          if (!result.success || !result.attestation || !result.gatewaySignature) {
            throw new Error(result.error || 'Gateway transfer failed');
          }

          // Step 2: Switch to Arc Network for minting
          await switchChain?.({ chainId: ARC_CHAIN_ID });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for chain switch

          // Step 3: Get Arc client and mint
          // Create Arc-specific public client
          const arcPublicClient = createPublicClient({
            chain: {
              id: ARC_CHAIN_ID,
              name: 'Arc Testnet',
              network: 'arc-testnet',
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
              rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network'] } },
            },
            transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network'),
          });
          
          const gatewayMinter = getContract({
            address: GATEWAY_MINTER_ADDRESS,
            abi: GATEWAY_MINTER_ABI,
            client: arcPublicClient,
          });

          // Step 4: Mint on Arc Network
          const txHash = await gatewayMinter.write.gatewayMint([
            result.attestation,
            result.gatewaySignature,
          ], {
            account: walletClient.account,
          });

          // Wait for transaction receipt to ensure it's confirmed
          await arcPublicClient.waitForTransactionReceipt({ hash: txHash });
          
          console.log(`✅ Gateway mint confirmed on Arc: ${txHash}`);

          setConsolidationSteps(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'completed' as const, txHash } : s
          ));

          console.log(`✅ Successfully bridged from ${step.chainName} to Arc using Gateway`);

        } catch (error: any) {
          console.error(`❌ Error bridging from ${step.chainName}:`, error);
          const errorMsg = error.message || error.shortMessage || 'Bridge failed';
          setConsolidationSteps(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error' as const, error: errorMsg } : s
          ));
          // Prevent error from propagating and causing page reload
          // Don't rethrow the error
          // Explicitly prevent the error from bubbling up
          if (error && typeof error.preventDefault === 'function') {
            error.preventDefault();
          }
          if (error && typeof error.stopPropagation === 'function') {
            error.stopPropagation();
          }
        }
      }

      setIsConsolidating(false);
      // Refresh balances after consolidation
      await new Promise(resolve => setTimeout(resolve, 3000));
      await fetchBalances();
      onConsolidationComplete?.();
    } catch (error: any) {
      // Catch any unhandled errors in the consolidation process
      console.error('❌ Consolidation process error:', error);
      setIsConsolidating(false);
      // Don't rethrow - just log and stop to prevent page reload
      // Explicitly prevent the error from bubbling up
      if (error && typeof error.preventDefault === 'function') {
        error.preventDefault();
      }
      if (error && typeof error.stopPropagation === 'function') {
        error.stopPropagation();
      }
      // Return early to prevent any further execution
      return;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" />
            Consolidate to Arc
          </CardTitle>
          <CardDescription>
            {creatorId 
              ? 'Transfer earnings to Arc Network using Circle Gateway (instant)'
              : 'Transfer all balances to Arc Network using Circle Gateway (instant)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chainBalances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" />
            Consolidate to Arc
          </CardTitle>
          <CardDescription>
            {creatorId 
              ? 'Transfer earnings to Arc Network using Circle Gateway (instant)'
              : 'Transfer all balances to Arc Network using Circle Gateway (instant)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ArrowDownToLine className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground text-sm">
              No balances to consolidate
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All funds are already on Arc Network
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5" />
            Consolidate to Arc
          </CardTitle>
          <CardDescription>
            {creatorId 
              ? 'Transfer earnings to Arc Network using Circle Gateway (instant)'
              : 'Transfer all balances to Arc Network using Circle Gateway (instant)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold mb-1">
                ${totalConsolidatableAfterFee.toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground">
                You'll receive on {consolidatableChains.length} chain{consolidatableChains.length > 1 ? 's' : ''} (fees deducted from balance)
                {chainBalances.length > consolidatableChains.length && (
                  <span className="block text-xs mt-1 text-orange-600 dark:text-orange-400">
                    ({chainBalances.length - consolidatableChains.length} chain{chainBalances.length - consolidatableChains.length > 1 ? 's' : ''} excluded - balance too small for Gateway fee)
                  </span>
                )}
              </p>
              {totalConsolidatable > totalConsolidatableAfterFee && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total balance: ${totalConsolidatable.toFixed(2)} USDC (${(totalConsolidatable - totalConsolidatableAfterFee).toFixed(2)} too small to consolidate after fees)
                </p>
              )}
            </div>

            <div className="space-y-2">
              {chainBalances.map((chain) => {
                const gasFee = getGatewayGasFee(chain.chainId);
                const transferFee = 0.0005;
                // Gateway may require slightly more than base fee, so add 5% buffer
                const totalFee = Math.max(gasFee + transferFee, gasFee * 1.05);
                const isExcluded = chain.balance < totalFee;
                return (
                  <div key={chain.chainId} className="flex items-center justify-between text-sm">
                    <span className={isExcluded ? "text-muted-foreground opacity-60" : "text-muted-foreground"}>
                      {chain.chainName}
                      {isExcluded && (
                        <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                          (needs ${totalFee.toFixed(4)})
                        </span>
                      )}
                      {!isExcluded && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (fee: ${totalFee.toFixed(4)})
                        </span>
                      )}
                    </span>
                    <div className="text-right">
                      <Badge variant={isExcluded ? "outline" : "secondary"}>
                        ${chain.balance.toFixed(2)} USDC
                      </Badge>
                      {!isExcluded && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          → ${(chain.balance - totalFee).toFixed(2)} after fee
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleStartConsolidation}
              className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={isConsolidating || consolidatableChains.length === 0}
            >
              <ArrowDownToLine className="w-4 h-4" />
              {consolidatableChains.length === 0 
                ? 'No balances to consolidate' 
                : 'Consolidate to Arc Network'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Uses Circle Gateway to instantly transfer all balances to Arc (domain 26)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Consolidation Modal */}
      <Dialog open={showConsolidateModal} onOpenChange={setShowConsolidateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Consolidate to Arc Network</DialogTitle>
            <DialogDescription>
              Transfer USDC from all chains to Arc Testnet using Circle Gateway (instant, domain 26)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <Alert>
              <ArrowDownToLine className="w-4 h-4" />
              <AlertDescription>
                <div className="font-semibold">Total to consolidate:</div>
                <div className="text-2xl font-bold">${totalConsolidatableAfterFee.toFixed(2)} USDC</div>
                <div className="text-xs text-muted-foreground mt-1">
                  From {consolidatableChains.length} chain{consolidatableChains.length > 1 ? 's' : ''}
                  {chainBalances.length > consolidatableChains.length && (
                    <span className="block mt-1 text-orange-600">
                      Note: {chainBalances.length - consolidatableChains.length} chain{chainBalances.length - consolidatableChains.length > 1 ? 's' : ''} excluded (balance too small for Gateway fee - fees vary by chain)
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>


            {/* Progress for each chain */}
            <div className="space-y-2">
              {consolidationSteps.map((step) => (
                <div
                  key={step.chainId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{step.chainName}</div>
                    <div className="text-xs text-muted-foreground">
                      ${step.balance.toFixed(2)} USDC
                    </div>
                    {step.error && (
                      <div className="text-xs text-destructive mt-1">{step.error}</div>
                    )}
                  </div>
                  <div>
                    {step.status === 'pending' && (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                    {step.status === 'bridging' && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Bridging
                      </Badge>
                    )}
                    {step.status === 'completed' && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Done
                      </Badge>
                    )}
                    {step.status === 'error' && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        Error
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowConsolidateModal(false)}
                disabled={isConsolidating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={executeConsolidation}
                disabled={isConsolidating || consolidationSteps.every(s => s.status === 'completed')}
                className="flex-1 gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isConsolidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : consolidationSteps.every(s => s.status === 'completed') ? (
                  'Completed'
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    Start Consolidation
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              You'll be prompted to switch networks and approve transactions for each chain.
              This may take several minutes to complete.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
