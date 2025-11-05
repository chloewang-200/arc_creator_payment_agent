'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { 
  getUSDCAddress, 
  getTokenMessengerAddress, 
  getDestinationDomain,
  supportsCCTP,
  CCTP_TOKEN_MESSENGER_ABI,
} from '@/lib/cctp';
import { USDC_ABI } from '@/lib/contracts';
import { USDC_DECIMALS, ARC_CHAIN_ID } from '@/lib/config';
import { useChainId } from 'wagmi';

interface CCTPTransferProps {
  onSuccess?: () => void;
}

export function CCTPTransfer({ onSuccess }: CCTPTransferProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const usdcAddress = getUSDCAddress(chainId);
  const tokenMessenger = getTokenMessengerAddress(chainId);
  const destinationDomain = getDestinationDomain(ARC_CHAIN_ID);

  // Read USDC balance
  const { data: balance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!usdcAddress,
    },
  });

  // Approve USDC for TokenMessenger
  const { writeContract: writeApprove, data: approveHash } = useWriteContract({
    mutation: {
      onError: (err) => {
        setError(err.message || 'Approval failed');
      },
    },
  });

  const { isLoading: isApproving, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Deposit and burn USDC via CCTP
  const { writeContract: writeDeposit, data: depositHash } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setAmount('');
        setError(null);
        if (onSuccess) onSuccess();
      },
      onError: (err) => {
        setError(err.message || 'Transfer failed');
      },
    },
  });

  const { isLoading: isDepositing, isSuccess: isDeposited } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const handleApprove = () => {
    if (!usdcAddress || !tokenMessenger || !amount) return;

    const amountWei = parseUnits(amount, USDC_DECIMALS);

    writeApprove({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [tokenMessenger, amountWei],
    });
  };

  const handleTransfer = () => {
    if (!tokenMessenger || !address || !amount || !isApproved) return;

    const amountWei = parseUnits(amount, USDC_DECIMALS);
    // Convert address to bytes32 for mintRecipient
    const mintRecipient = `0x${address.slice(2).padStart(64, '0')}` as `0x${string}`;

    writeDeposit({
      address: tokenMessenger,
      abi: CCTP_TOKEN_MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [amountWei, destinationDomain, mintRecipient],
    });
  };

  const balanceFormatted = balance 
    ? parseFloat(formatUnits(balance, USDC_DECIMALS))
    : 0;

  const canTransfer = amount && parseFloat(amount) > 0 && parseFloat(amount) <= balanceFormatted;

  if (!supportsCCTP(chainId)) {
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          CCTP is not supported on this chain. Please switch to a supported chain.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-Chain Transfer (CCTP)</CardTitle>
        <CardDescription>
          Transfer USDC from {chainId} to Arc Network using Circle's CCTP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (USDC)</Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isApproving || isDepositing}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setAmount(balanceFormatted.toFixed(6))}
            >
              Max
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Balance: {balanceFormatted.toFixed(2)} USDC
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Chain {chainId}</span>
          <ArrowRight className="w-4 h-4" />
          <span>Arc Network</span>
        </div>

        {!isApproved ? (
          <Button
            onClick={handleApprove}
            disabled={!canTransfer || isApproving}
            className="w-full"
          >
            {isApproving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              '1. Approve USDC'
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Approved</span>
            </div>
            <Button
              onClick={handleTransfer}
              disabled={!canTransfer || isDepositing}
              className="w-full"
            >
              {isDepositing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                '2. Transfer to Arc'
              )}
            </Button>
          </div>
        )}

        {isDeposited && (
          <Alert>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              Transfer initiated! USDC will be minted on Arc Network after message attestation.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

