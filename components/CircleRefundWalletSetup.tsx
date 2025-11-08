'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useChainId, useSwitchChain, useDisconnect } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, Settings, DollarSign, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { parseUnits, type Address } from 'viem';
import { USDC_DECIMALS } from '@/lib/config';
import { arcChain } from '@/lib/wagmi-config';
import { getGatewayUSDCAddress } from '@/lib/gateway';
import { USDC_ABI } from '@/lib/contracts';

interface CircleRefundWalletSetupProps {
  creatorId: string;
  creatorWallet: Address;
}

interface CreatorBalance {
  balance: number;
  dailyLimit: number;
  enabled: boolean;
  dailyUsed: number;
}

export function CircleRefundWalletSetup({
  creatorId,
  creatorWallet,
}: CircleRefundWalletSetupProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { disconnect } = useDisconnect();

  const [balanceInfo, setBalanceInfo] = useState<CreatorBalance | null>(null);
  const [creatorWalletAddress, setCreatorWalletAddress] = useState<string>('');
  const [walletInitialized, setWalletInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializingWallet, setInitializingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState('');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [chainMismatch, setChainMismatch] = useState(false);

  useEffect(() => {
    loadCreatorWallet();
  }, [creatorId]);

  useEffect(() => {
    loadBalanceInfo();
  }, [creatorId, creatorWalletAddress, publicClient]);

  // Check chain mismatch whenever connection status or chainId changes
  useEffect(() => {
    if (!isConnected) {
      setChainMismatch(false);
      return;
    }

    // Trust wagmi's chainId - if it doesn't match Arc, flag it
    const targetChainId = arcChain.id;
    if (chainId !== targetChainId) {
      console.warn('[ChainCheck] Mismatch: wagmi chainId is', chainId, 'but need', targetChainId);
      setChainMismatch(true);
    } else {
      console.log('[ChainCheck] All good: chainId is', chainId);
      setChainMismatch(false);
    }
  }, [creatorId, isConnected, chainId]);

  const loadBalanceInfo = async () => {
    try {
      // Get settings from API
      const response = await fetch(`/api/refunds/circle/balance?creatorId=${creatorId}`);
      const data = await response.json();

      // Get actual on-chain balance if we have the wallet address
      let actualBalance = data.balance || 0;
      if (creatorWalletAddress && publicClient) {
        try {
          const usdcAddress = getGatewayUSDCAddress(arcChain.id);
          if (usdcAddress) {
            const balance = await publicClient.readContract({
              address: usdcAddress,
              abi: USDC_ABI,
              functionName: 'balanceOf',
              args: [creatorWalletAddress as Address],
            });
            // Convert from wei to USD (USDC has 6 decimals)
            actualBalance = Number(balance) / 1_000_000;
            console.log('[Balance] On-chain balance:', actualBalance);
          }
        } catch (balanceError) {
          console.error('[Balance] Failed to fetch on-chain balance:', balanceError);
          // Fallback to database balance
        }
      }

      if (data.dailyLimit !== undefined) {
        setBalanceInfo({
          balance: actualBalance, // Use on-chain balance
          dailyLimit: data.dailyLimit || 100,
          enabled: data.enabled || false,
          dailyUsed: data.dailyUsed || 0,
        });
        setDailyLimit(data.dailyLimit?.toString() || '100');
        setAutoEnabled(data.enabled || false);
      }
    } catch (err: any) {
      console.error('Error loading balance:', err);
    }
  };

  const loadCreatorWallet = async () => {
    try {
      const response = await fetch(`/api/refunds/circle/wallet?creatorId=${creatorId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setWalletInitialized(false);
          setCreatorWalletAddress('');
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to load wallet info');
      }
      const data = await response.json();

      if (data.address) {
        setCreatorWalletAddress(data.address);
        setWalletInitialized(true);
      } else {
        setWalletInitialized(false);
      }
    } catch (err: any) {
      console.error('Error loading Circle wallet:', err);
      setWalletInitialized(false);
    }
  };

  const handleCreateCreatorWallet = async () => {
    setInitializingWallet(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/refunds/circle/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      });
      const data = await response.json();

      if (response.ok) {
        setCreatorWalletAddress(data.address);
        setWalletInitialized(true);
        setSuccess('Circle refund wallet created successfully!');
      } else {
        setError(data.error || 'Failed to create Circle wallet');
      }
    } catch (err: any) {
      console.error('Error creating Circle wallet:', err);
      setError(err.message || 'Failed to create Circle wallet');
    } finally {
      setInitializingWallet(false);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/refunds/circle/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          dailyLimit: parseFloat(dailyLimit),
          enabled: autoEnabled,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Settings updated successfully!');
        await loadBalanceInfo();
      } else {
        setError(data.error || 'Failed to update settings');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!walletClient || !publicClient || !depositAmount || !creatorWalletAddress) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const targetChainId = arcChain.id;

      // Step 1: If on wrong chain, switch and exit (let wagmi re-render with fresh walletClient)
      if (chainId !== targetChainId) {
        console.log('[Deposit] Wrong chain, switching from', chainId, 'to', targetChainId);

        try {
          // Try to switch to Arc Testnet
          await switchChainAsync({ chainId: targetChainId });
          setSuccess('Switched to Arc Testnet! Please click Deposit again.');
          setLoading(false);
          return; // Exit and let wagmi re-render
        } catch (switchError: any) {
          console.log('[Deposit] Switch failed, attempting to add network:', switchError);

          // If switch failed, network might not exist - try to add it
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            try {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${targetChainId.toString(16)}`, // Convert to hex
                  chainName: 'Arc Testnet',
                  nativeCurrency: {
                    name: 'USDC',
                    symbol: 'USDC',
                    decimals: 6,
                  },
                  rpcUrls: ['https://rpc.testnet.arc.network'],
                  blockExplorerUrls: ['https://testnet.arcscan.app'],
                }],
              });

              setSuccess('Arc Testnet added to MetaMask! Please click Deposit again to continue.');
              setLoading(false);
              return;
            } catch (addError: any) {
              console.error('[Deposit] Failed to add network:', addError);

              // Check if user rejected
              if (addError.code === 4001 || addError.message?.includes('rejected')) {
                setError('You rejected adding Arc Testnet to MetaMask. Please approve the network addition to continue, or add it manually in MetaMask settings.');
                setLoading(false);
                return;
              }

              setError('Failed to add Arc Testnet to MetaMask. Please add it manually: Network Name: "Arc Testnet", RPC: "https://rpc.testnet.arc.network", Chain ID: 5042002');
              setLoading(false);
              return;
            }
          }

          // Check if user rejected the switch
          if (switchError.code === 4001 || switchError.message?.includes('rejected')) {
            setError('You rejected the network switch. Please approve switching to Arc Testnet in MetaMask to continue.');
            setLoading(false);
            return;
          }

          setError('Failed to switch to Arc Testnet. Please switch manually in MetaMask (chain ID: 5042002).');
          setLoading(false);
          return;
        }
      }

      // Step 2: Ensure walletClient is on the right chain
      if (walletClient.chain?.id !== targetChainId) {
        console.error('[Deposit] walletClient mismatch:', walletClient.chain?.id, 'vs', targetChainId);
        setError(`Wrong network: wallet is on ${walletClient.chain?.id}, need ${targetChainId}. Please disconnect and reconnect.`);
        setLoading(false);
        return;
      }

      console.log('[Deposit] ✅ Ready - chainId:', chainId, 'walletClient.chain.id:', walletClient.chain.id);

      const amount = parseFloat(depositAmount);
      const usdcAddress = getGatewayUSDCAddress(targetChainId);

      if (!usdcAddress) {
        throw new Error('USDC not available on this chain');
      }

      // Transfer USDC to the creator's Circle wallet
      const amountWei = parseUnits(amount.toFixed(6), USDC_DECIMALS);
      console.log('[Deposit] Transferring', amountWei.toString(), 'USDC to', creatorWalletAddress);

      const hash = await walletClient.writeContract({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [creatorWalletAddress as Address, amountWei],
        // Let it use walletClient.chain - don't override
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      // Record deposit
      const response = await fetch('/api/refunds/circle/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          amountUSD: amount,
          transactionHash: hash,
          chainId: chainId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Deposited $${amount.toFixed(2)} USDC successfully!`);
        setDepositAmount('');
        await loadBalanceInfo();
      } else {
        setError(data.error || 'Failed to record deposit');
      }
    } catch (err: any) {
      console.error('[Deposit] Failed:', err);
      setError(err.message || 'Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  const walletMatches = isConnected && connectedAddress?.toLowerCase() === creatorWallet.toLowerCase();
  const isOnArcTestnet = chainId === arcChain.id;

  return (
    <div className="space-y-4">
      {/* Chain Mismatch Warning (MetaMask vs Wagmi state desync) */}
      {isConnected && chainMismatch && (
        <Card className="bg-red-50 border-red-300 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 mb-1">⚠️ Chain State Mismatch Detected</h4>
                <p className="text-sm text-red-800 mb-3">
                  Your MetaMask wallet is connected to a different network than what the app expects. This happens when you connected on one network and the app switched internally.
                </p>
                <div className="text-xs text-red-700 bg-red-100 rounded p-3 border border-red-200 mb-3">
                  <strong>To fix this:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1.5">
                    <li><strong>Click "Disconnect Wallet"</strong> button below</li>
                    <li><strong>Open MetaMask</strong> and switch to <code className="bg-red-200 px-1 rounded">Arc Testnet (chain ID: 5042002)</code></li>
                    <li><strong>Click "Connect Wallet"</strong> button again</li>
                    <li><strong>Try depositing</strong> - it should work now!</li>
                  </ol>
                </div>
                <Button
                  onClick={() => {
                    disconnect();
                    setChainMismatch(false);
                    setError(null);
                  }}
                  variant="destructive"
                  size="sm"
                >
                  Disconnect Wallet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chain Warning */}
      {isConnected && !isOnArcTestnet && !chainMismatch && (
        <Card className="bg-orange-50 border-orange-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-900 mb-1">Wrong Network</h4>
                <p className="text-sm text-orange-800 mb-3">
                  You're currently on chain ID {chainId}. Please switch to <strong>Arc Testnet (chain ID: {arcChain.id})</strong> in your wallet to deposit funds.
                </p>
                <div className="text-xs text-orange-700 bg-orange-100 rounded p-2 border border-orange-200">
                  <strong>How to switch:</strong>
                  <ol className="list-decimal ml-4 mt-1 space-y-1">
                    <li>Open MetaMask</li>
                    <li>Click the network dropdown (top left)</li>
                    <li>Select "Arc Testnet" (or add it if not listed)</li>
                    <li>Come back and try again</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {walletInitialized === false && (
        <Card className="bg-white border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Settings className="w-5 h-5 text-blue-600" />
              Enable Circle Refund Wallet
            </CardTitle>
            <CardDescription className="text-slate-600">
              This optional add-on lets Arc automate refunds using a Circle wallet dedicated to you. Create it once, then deposit whenever you need more balance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              After provisioning your wallet, deposits go straight to your own Circle custody account—no shared balances. You can then configure daily limits and let AI handle refunds automatically.
            </p>
            <Button
              onClick={handleCreateCreatorWallet}
              disabled={initializingWallet}
              className="gap-2"
            >
              {initializingWallet ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating wallet…
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Create Circle Wallet
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Balance Overview */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Wallet className="w-5 h-5 text-blue-600" />
            Refund Balance (Circle Wallet)
          </CardTitle>
          <CardDescription className="text-slate-600">
            Funds live in your dedicated Circle developer-controlled wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4" />
                Connect your wallet to manage refunds
              </div>
            </div>
          )}

          {isConnected && !walletMatches && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md mb-4">
              <div className="flex items-center gap-2 text-sm text-orange-800">
                <AlertCircle className="w-4 h-4" />
                Wrong wallet connected. Please connect: {creatorWallet.slice(0, 6)}...
                {creatorWallet.slice(-4)}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
              {error.includes('Chain mismatch') && (
                <div className="space-y-2">
                  <p className="text-xs text-red-700 font-semibold">How to fix:</p>
                  <ol className="text-xs text-red-700 list-decimal ml-4 space-y-1">
                    <li>Click the "Disconnect Wallet" button below</li>
                    <li>Open MetaMask and manually switch to Arc Testnet (chain ID: 5042002)</li>
                    <li>Click "Connect Wallet" again</li>
                    <li>Try depositing again</li>
                  </ol>
                  <Button
                    onClick={() => {
                      disconnect();
                      setError(null);
                    }}
                    variant="destructive"
                    size="sm"
                    className="mt-2"
                  >
                    Disconnect Wallet
                  </Button>
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md mb-4">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4" />
                {success}
              </div>
            </div>
          )}

          {balanceInfo && (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-700 mb-1 font-medium">Your Balance</div>
                  <div className="text-3xl font-bold text-blue-900">
                    ${balanceInfo.balance.toFixed(2)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">USDC on-chain</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600 mb-1 font-medium">Daily Limit Used</div>
                  <div className="text-3xl font-bold text-slate-900">
                    ${balanceInfo.dailyUsed.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    of ${balanceInfo.dailyLimit.toFixed(2)} limit
                  </div>
                </div>
              </div>
              <Button
                onClick={() => loadBalanceInfo()}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-2" />
                )}
                Refresh Balance
              </Button>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>How it works:</strong> Deposit USDC once. Set your limits. AI handles refunds
              automatically within your limits. Powered by Circle's developer-controlled wallets!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Deposit */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <DollarSign className="w-5 h-5 text-green-600" />
            Deposit Funds
          </CardTitle>
          <CardDescription className="text-slate-600">
            Add USDC to your Circle wallet to enable automated refunds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Amount (USDC)</Label>
            <div className="flex gap-2">
              <Input
                id="depositAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 100"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={!walletMatches || !walletInitialized || !isOnArcTestnet}
                className="flex-1"
              />
              <Button
                onClick={handleDeposit}
                disabled={
                  !walletMatches ||
                  !isOnArcTestnet ||
                  loading ||
                  !depositAmount ||
                  !walletInitialized ||
                  !creatorWalletAddress
                }
                className="bg-green-600 text-white hover:bg-green-700 px-8"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deposit'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              USDC is sent directly to your Circle wallet below and credited to your refund balance once confirmed on-chain.
            </p>
          </div>

          {creatorWalletAddress && (
            <div className="text-xs text-slate-500 font-mono p-2 bg-slate-50 rounded border">
              Circle wallet address: {creatorWalletAddress}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Settings className="w-5 h-5 text-blue-600" />
            Refund Settings
          </CardTitle>
          <CardDescription className="text-slate-600">
            Configure automated refund limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dailyLimit">Daily Refund Limit (USD)</Label>
            <Input
              id="dailyLimit"
              type="number"
              step="1"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              disabled={!walletMatches}
            />
            <p className="text-xs text-slate-500">
              Maximum amount that can be refunded per day
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoEnabled"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
              disabled={!walletMatches}
              className="w-4 h-4"
            />
            <Label htmlFor="autoEnabled" className="cursor-pointer">
              Enable automated refunds
            </Label>
          </div>

          <Button
            onClick={handleUpdateSettings}
            disabled={!walletMatches || loading}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 mr-2" />
                Update Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-slate-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-1" />
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900">Powered by Circle</h4>
              <p className="text-sm text-slate-600">
                No smart contract deployment needed. Your funds are held in Circle's developer-controlled
                wallet (MPC security). Set limits once, and AI handles refunds automatically.
                Withdraw anytime.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
