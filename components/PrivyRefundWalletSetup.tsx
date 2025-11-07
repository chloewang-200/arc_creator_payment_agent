'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, Settings, DollarSign, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { parseUnits, formatUnits, type Address } from 'viem';
import { USDC_DECIMALS } from '@/lib/config';
import { getGatewayUSDCAddress } from '@/lib/gateway';
import { USDC_ABI } from '@/lib/contracts';

interface PrivyRefundWalletSetupProps {
  creatorId: string;
  creatorWallet: Address;
}

interface CreatorBalance {
  balance: number;
  dailyLimit: number;
  enabled: boolean;
  dailyUsed: number;
}

export function PrivyRefundWalletSetup({
  creatorId,
  creatorWallet,
}: PrivyRefundWalletSetupProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [balanceInfo, setBalanceInfo] = useState<CreatorBalance | null>(null);
  const [platformWalletAddress, setPlatformWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState('');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [autoEnabled, setAutoEnabled] = useState(true);

  useEffect(() => {
    loadBalanceInfo();
    loadPlatformWallet();
  }, [creatorId]);

  const loadBalanceInfo = async () => {
    try {
      const response = await fetch(`/api/refunds/privy/balance?creatorId=${creatorId}`);
      const data = await response.json();

      if (data.balance !== undefined) {
        setBalanceInfo({
          balance: data.balance,
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

  const loadPlatformWallet = async () => {
    try {
      const response = await fetch('/api/refunds/privy/wallet');
      const data = await response.json();

      if (data.address) {
        setPlatformWalletAddress(data.address);
      }
    } catch (err: any) {
      console.error('Error loading platform wallet:', err);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/refunds/privy/settings', {
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
    if (!walletClient || !publicClient || !depositAmount || !platformWalletAddress) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amount = parseFloat(depositAmount);
      const usdcAddress = getGatewayUSDCAddress(chainId);

      if (!usdcAddress) {
        throw new Error('USDC not available on this chain');
      }

      // Get chain for writeContract
      const chain = publicClient.chain;
      if (!chain) {
        throw new Error('Chain not available');
      }

      // Transfer USDC to platform wallet
      const amountWei = parseUnits(amount.toFixed(6), USDC_DECIMALS);
      const hash = await walletClient.writeContract({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [platformWalletAddress as Address, amountWei],
        chain,
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      // Record deposit
      const response = await fetch('/api/refunds/privy/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          amountUSD: amount,
          transactionHash: hash,
          chainId,
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
      setError(err.message || 'Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  const walletMatches = isConnected && connectedAddress?.toLowerCase() === creatorWallet.toLowerCase();

  return (
    <div className="space-y-4">
      {/* Balance Overview */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Wallet className="w-5 h-5 text-blue-600" />
            Refund Balance (Platform Wallet)
          </CardTitle>
          <CardDescription className="text-slate-600">
            Your refund balance is held in the platform's secure Privy wallet
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
              <div className="flex items-center gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
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
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-700 mb-1 font-medium">Your Balance</div>
                <div className="text-3xl font-bold text-blue-900">
                  ${balanceInfo.balance.toFixed(2)}
                </div>
                <div className="text-xs text-blue-600 mt-1">USDC available for refunds</div>
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
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>How it works:</strong> Deposit USDC once. Set your limits. AI handles refunds
              automatically within your limits. No contract deployment needed!
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
            Add USDC to enable automated refunds
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
                disabled={!walletMatches}
                className="flex-1"
              />
              <Button
                onClick={handleDeposit}
                disabled={!walletMatches || loading || !depositAmount || !platformWalletAddress}
                className="bg-green-600 text-white hover:bg-green-700 px-8"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deposit'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              USDC will be sent to platform wallet and credited to your refund balance
            </p>
          </div>

          {platformWalletAddress && (
            <div className="text-xs text-slate-500 font-mono p-2 bg-slate-50 rounded border">
              Platform wallet: {platformWalletAddress}
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
              <h4 className="font-semibold text-slate-900">Simple & Secure</h4>
              <p className="text-sm text-slate-600">
                No smart contract deployment needed. Your funds are held in the platform's Privy wallet (MPC security). Set limits once, and AI handles refunds automatically. Withdraw anytime.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
