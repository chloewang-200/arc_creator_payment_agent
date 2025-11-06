'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, decodeErrorResult, encodeFunctionData } from 'viem';
import { PAYROUTER_ADDRESS, USDC_ADDRESS, CREATOR_ADDRESS, USDC_DECIMALS, ARC_CHAIN_ID } from '@/lib/config';
import { PAYROUTER_ABI, USDC_ABI } from '@/lib/contracts';
import { 
  getUSDCAddress, 
  supportsCCTP, 
  getTokenMessengerAddress, 
  getDestinationDomain,
  CCTP_TOKEN_MESSENGER_ABI,
} from '@/lib/cctp';
import { skuPost, skuSub, skuTip, skuRecurringTip } from '@/lib/sku';
import type { PaymentIntent } from '@/types';
import { unlockPost, activateSubscription, activateRecurringTip } from '@/lib/entitlements';
import { submitPaymasterPayment, isPaymasterPaymentAvailable } from '@/lib/paymaster-payment';
  import { bridgeUSDCWithBridgeKit } from '@/lib/bridgeKit';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Wallet, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CheckoutModalProps {
  intent: PaymentIntent;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ intent, onClose, onSuccess }: CheckoutModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [step, setStep] = useState<'summary' | 'confirm' | 'processing' | 'success'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [usePaymaster, setUsePaymaster] = useState(false);
  const [paymasterTxHash, setPaymasterTxHash] = useState<string | null>(null);
  const isOnArc = chainId === ARC_CHAIN_ID;
  const paymasterAvailable = isPaymasterPaymentAvailable(chainId);

  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();
  const [shouldPay, setShouldPay] = useState(false);
  
  // CCTP bridging state (for cross-chain payments)
  const [cctpApproveHash, setCctpApproveHash] = useState<`0x${string}` | undefined>();
  const [cctpBridgeHash, setCctpBridgeHash] = useState<`0x${string}` | undefined>();
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeKitInProgress, setBridgeKitInProgress] = useState(false);
  const [bridgeKitMessage, setBridgeKitMessage] = useState<string | null>(null);
  
  // CCTP contracts for current chain
  const chainUSDC = getUSDCAddress(chainId);
  const tokenMessenger = getTokenMessengerAddress(chainId);
  const destinationDomain = getDestinationDomain(ARC_CHAIN_ID);
  const canBridge = !isOnArc && supportsCCTP(chainId) && chainUSDC && tokenMessenger;

  const { writeContract: writeApprove, data: approveTxHash } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setApproveHash(hash);
      },
      onError: (error) => {
        setError(error.message || 'Approval failed');
        setStep('summary');
        setShouldPay(false);
      },
    },
  });

  const { writeContract: writePay, data: payTxHash } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setPayHash(hash);
      },
      onError: (error) => {
        setError(error.message || 'Payment failed');
        setStep('summary');
      },
    },
  });

  // CCTP approval for bridging
  const { writeContract: writeCCTPApprove, data: cctpApproveTxHash } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setCctpApproveHash(hash);
      },
      onError: (error) => {
        setError(error.message || 'CCTP approval failed');
        setIsBridging(false);
        setStep('summary'); // Reset to summary on error
      },
    },
  });

  // CCTP bridge deposit
  const { writeContract: writeCCTPBridge, data: cctpBridgeTxHash } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setCctpBridgeHash(hash);
      },
      onError: (error) => {
        setError(error.message || 'CCTP bridge failed');
        setIsBridging(false);
        setStep('summary'); // Reset to summary on error
      },
    },
  });

  const { isLoading: isCCTPApproving, isSuccess: isCCTPApproved, isError: isCCTPApprovalError, error: cctpApprovalError } = useWaitForTransactionReceipt({
    hash: cctpApproveHash || cctpApproveTxHash,
  });

  // Handle approval transaction receipt errors
  useEffect(() => {
    if (isCCTPApprovalError && cctpApprovalError) {
      setError(`Approval transaction failed: ${cctpApprovalError.message || 'Transaction reverted. Check if you have enough USDC balance and gas.'}`);
      setIsBridging(false);
      setStep('summary');
    }
  }, [isCCTPApprovalError, cctpApprovalError]);

  const { isLoading: isCCTPBridging, isSuccess: isCCTPBridged, isError: isCCTPBridgeError, error: cctpBridgeError } = useWaitForTransactionReceipt({
    hash: cctpBridgeHash || cctpBridgeTxHash,
  });

  // Handle bridge transaction receipt errors
  useEffect(() => {
    if (isCCTPBridgeError && cctpBridgeError) {
      let errorMessage = 'Bridge transaction failed. ';
      
      // Try to extract more specific error information
      const errorStr = cctpBridgeError.message || String(cctpBridgeError);
      
      if (errorStr.includes('allowance') || errorStr.includes('insufficient')) {
        errorMessage += 'Insufficient approval. Please approve again.';
      } else if (errorStr.includes('balance')) {
        errorMessage += 'Insufficient USDC balance.';
      } else if (errorStr.includes('domain') || errorStr.includes('destination')) {
        errorMessage += 'Invalid destination domain. Arc Testnet domain: 26.';
      } else {
        errorMessage += 'Transaction reverted. Common causes: insufficient approval, insufficient balance, or invalid destination domain.';
      }
      
      errorMessage += ` (Domain: ${destinationDomain}, Amount: ${intent.amountUSD} USDC)`;
      
      setError(errorMessage);
      setIsBridging(false);
      setStep('summary');
    }
  }, [isCCTPBridgeError, cctpBridgeError, destinationDomain, intent.amountUSD]);

  const { isLoading: isApproving, isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash || approveTxHash
  });

  const { isLoading: isPaying, isSuccess: isPaySuccess } = useWaitForTransactionReceipt({
    hash: payHash || payTxHash
  });

  // Handle successful payment - record in database
  useEffect(() => {
    const recordPayment = async () => {
      if (!isPaySuccess || !address) return;

      try {
        // Record the unlock/subscription in the database
        const response = await fetch('/api/unlocks/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: intent.kind,
            postId: intent.postId,
            creatorId: intent.creatorId,
            walletAddress: address,
            amount: intent.amountUSD,
            txHash: payHash || payTxHash,
            days: 30,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to record payment in database:', errorData);
          // Don't throw - blockchain tx succeeded, so we still show success
        }

        // Also update localStorage for immediate UI feedback
        if (intent.kind === 'unlock' && intent.postId) {
          unlockPost(intent.postId);
        } else if (intent.kind === 'subscription') {
          activateSubscription(30);
        } else if (intent.kind === 'recurringTip' && intent.creatorId) {
          activateRecurringTip(intent.creatorId, intent.amountUSD, 30);
        }
        // Tips don't change entitlements

        setStep('success');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } catch (error) {
        console.error('Error recording payment:', error);
        // Still show success since blockchain tx succeeded
        setStep('success');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    };

    if (isPaySuccess) {
      recordPayment();
    }
  }, [isPaySuccess, address, intent, payHash, payTxHash, onSuccess, onClose]);

  useEffect(() => {
    if (isApproved && shouldPay && !payHash && !payTxHash) {
      const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
      
      let sku: `0x${string}`;
      if (intent.kind === 'unlock' && intent.postId) {
        sku = skuPost(intent.postId);
      } else if (intent.kind === 'subscription') {
        sku = skuSub();
      } else if (intent.kind === 'recurringTip' && intent.creatorId) {
        sku = skuRecurringTip(intent.creatorId, intent.amountUSD);
      } else {
        sku = skuTip(intent.amountUSD);
      }

      // Use creator address from intent if available, otherwise fall back to global CREATOR_ADDRESS
      const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;

      if (PAYROUTER_ADDRESS === '0x0000000000000000000000000000000000000000' || 
          creatorAddress === '0x0000000000000000000000000000000000000000') {
        setError('Contract addresses not configured. Please set environment variables.');
        setStep('summary');
        return;
      }

      writePay({
        address: PAYROUTER_ADDRESS,
        abi: PAYROUTER_ABI,
        functionName: 'pay',
        args: [sku, creatorAddress, amount],
      });
    }
  }, [isApproved, shouldPay, payHash, payTxHash, intent, writePay]);

  useEffect(() => {
    if (isApproving || isPaying || isCCTPApproving || isCCTPBridging) {
      setStep('processing');
    }
    // Reset to summary if any transaction fails (errors handled in their respective useEffects)
    if (isCCTPApprovalError || isCCTPBridgeError) {
      setStep('summary');
      setIsBridging(false);
    }
  }, [isApproving, isPaying, isCCTPApproving, isCCTPBridging, isCCTPApprovalError, isCCTPBridgeError]);

  const handleConfirm = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    setError(null);
    setStep('confirm');

    try {
      const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
      const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;
      
      if (!creatorAddress || creatorAddress === '0x0000000000000000000000000000000000000000') {
        setError('Creator address not set');
        setStep('summary');
        return;
      }

      // If user wants to use paymaster (gas in USDC) and it's available
      if (usePaymaster && paymasterAvailable && walletClient && publicClient) {
        setStep('processing');
        try {
          const result = await submitPaymasterPayment({
            intent,
            walletClient,
            publicClient,
            chainId,
          });

          if (result.success && result.txHash) {
            setPaymasterTxHash(result.txHash);
            // Record payment in database
            try {
              await fetch('/api/unlocks/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: intent.kind,
                  postId: intent.postId,
                  creatorId: intent.creatorId,
                  walletAddress: address,
                  amount: intent.amountUSD,
                  txHash: result.txHash,
                  days: 30,
                }),
              });
            } catch (error) {
              console.error('Failed to record payment:', error);
            }

            // Update local entitlements
            if (intent.kind === 'unlock' && intent.postId) {
              unlockPost(intent.postId);
            } else if (intent.kind === 'subscription') {
              activateSubscription(30);
            } else if (intent.kind === 'recurringTip' && intent.creatorId) {
              activateRecurringTip(intent.creatorId, intent.amountUSD, 30);
            }

            setStep('success');
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 2000);
            return;
          } else {
            setError(result.error || 'Paymaster payment failed');
            setStep('summary');
            return;
          }
        } catch (err: any) {
          setError(err.message || 'Paymaster payment failed');
          setStep('summary');
          return;
        }
      }

      // If on Arc, pay directly via PayRouter
      if (isOnArc) {
        const usdcAddress = USDC_ADDRESS;
        const payRouterAddress = PAYROUTER_ADDRESS;
        
        if (!usdcAddress || usdcAddress === '0x0000000000000000000000000000000000000000' || 
            !payRouterAddress || payRouterAddress === '0x0000000000000000000000000000000000000000') {
          setError('Contract addresses not configured. Please set environment variables.');
          setStep('summary');
          return;
        }

        writeApprove({
          address: usdcAddress,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [payRouterAddress, amount],
        });
        setShouldPay(true);
      } 
      // If on another chain with CCTP support, use Bridge Kit (simpler & robust)
      else if (canBridge) {
        setIsBridging(true);
        setStep('processing');
        try {
          const result = await bridgeUSDCWithBridgeKit({
            fromChainId: chainId,
            toChainId: ARC_CHAIN_ID,
            amountUSD: intent.amountUSD.toFixed(2),
            recipientAddress: creatorAddress,
          });

          if (!result.success) {
            // Keep waiting UI; do NOT auto-complete. Show progress hint if steps exist.
            if ((result as any).steps) {
              setBridgeKitInProgress(true);
              setBridgeKitMessage('Approval confirmed. Bridging USDC to Arc... This may take a few minutes.');
              // Remain in processing until user retries or flow completes externally.
              return;
            }
            setError(result.error || 'Bridge Kit transfer failed');
            setIsBridging(false);
            setStep('summary');
            return;
          }

          // Record completion immediately; Bridge Kit handles async steps
          try {
            await fetch('/api/unlocks/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: intent.kind,
                postId: intent.postId,
                creatorId: intent.creatorId,
                walletAddress: address,
                amount: intent.amountUSD,
                txHash: undefined,
                days: 30,
              }),
            });
          } catch {}

          if (intent.kind === 'unlock' && intent.postId) {
            unlockPost(intent.postId);
          } else if (intent.kind === 'subscription') {
            activateSubscription(30);
          } else if (intent.kind === 'recurringTip' && intent.creatorId) {
            activateRecurringTip(intent.creatorId, intent.amountUSD, 30);
          }

          setIsBridging(false);
          setStep('success');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        } catch (e: any) {
          setError(e?.message || 'Bridge Kit transfer failed');
          setIsBridging(false);
          setStep('summary');
        }
      }
      // Chain doesn't support CCTP - need to switch
      else {
        setError(`Chain ${chainId} doesn't support CCTP. Please switch to Arc Network or a supported chain.`);
        setStep('summary');
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setStep('summary');
      setShouldPay(false);
      setIsBridging(false);
    }
  };

  // Handle CCTP approval success - start bridging
  useEffect(() => {
    if (isCCTPApproved && isBridging && chainUSDC && tokenMessenger && intent.creatorAddress && address && publicClient) {
      const bridgeTransaction = async () => {
        try {
          const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
          const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;
          
          // Verify approval before attempting bridge
          const allowance = await publicClient.readContract({
            address: chainUSDC,
            abi: USDC_ABI,
            functionName: 'allowance',
            args: [address, tokenMessenger],
          });
          
          if (allowance < amount) {
            setError(`Insufficient approval. Expected: ${amount.toString()}, Got: ${allowance.toString()}. Please approve again.`);
            setIsBridging(false);
            setStep('summary');
            return;
          }
          
          // Check USDC balance
          const balance = await publicClient.readContract({
            address: chainUSDC,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          
          if (balance < amount) {
            setError(`Insufficient USDC balance. Need: ${amount.toString()}, Have: ${balance.toString()}`);
            setIsBridging(false);
            setStep('summary');
            return;
          }
          
          // Convert creator address to bytes32 for mintRecipient
          const mintRecipient = `0x${creatorAddress.slice(2).padStart(64, '0')}` as `0x${string}`;

          // Check contract state before attempting bridge (optional - contracts may not have these functions)
          let contractPaused = false;
          let domainSupported: boolean | null = null; // null = unknown, true/false = checked
          
          try {
            // Try to check if contract is paused (may not exist on all contracts)
            try {
              contractPaused = await publicClient.readContract({
                address: tokenMessenger,
                abi: CCTP_TOKEN_MESSENGER_ABI,
                functionName: 'paused',
              }) as boolean;
            } catch {
              // Function doesn't exist, assume not paused
              contractPaused = false;
            }
            
            // Check if domain is supported (some contracts have this)
            try {
              domainSupported = await publicClient.readContract({
                address: tokenMessenger,
                abi: CCTP_TOKEN_MESSENGER_ABI,
                functionName: 'domains',
                args: [destinationDomain],
              }) as boolean;
            } catch {
              // Function might not exist - we'll detect domain support from the actual transaction revert
              domainSupported = null;
            }
          } catch (err) {
            // Contract state checks failed, continue with transaction attempt
            console.warn('Could not check contract state:', err);
          }

          // Log diagnostic information
          console.log('🔍 CCTP Bridge Diagnostics:', {
            amount: amount.toString(),
            amountUSD: intent.amountUSD,
            domain: destinationDomain,
            mintRecipient,
            creatorAddress,
            tokenMessenger,
            chainUSDC,
            allowance: allowance.toString(),
            balance: balance.toString(),
            contractPaused,
            domainSupported,
          });
          
          // Early validation
          if (contractPaused) {
            setError('CCTP TokenMessenger contract is paused. Please try again later.');
            setIsBridging(false);
            setStep('summary');
            return;
          }
          
          // Only fail early if we definitively know domain is not supported
          // If domainSupported is null, we'll let the transaction attempt reveal the issue
          if (domainSupported === false) {
            setError(
              `Domain ${destinationDomain} (Arc Testnet) is not enabled on this TokenMessenger contract. ` +
              `CCTP V2 is supported on Sepolia, but domain 26 may need to be enabled or you may need CCTP V2 specific contract addresses. ` +
              `Please switch to Arc Network directly to make payments.`
            );
            setIsBridging(false);
            setStep('summary');
            return;
          }

          // Simulate the transaction first to get the actual revert reason
          try {
            await publicClient.simulateContract({
              address: tokenMessenger,
              abi: CCTP_TOKEN_MESSENGER_ABI,
              functionName: 'depositForBurn',
              args: [amount, destinationDomain, mintRecipient, chainUSDC],
              account: address,
            });
            console.log('✅ Transaction simulation successful');
          } catch (simError: any) {
            // Extract the revert reason from the simulation error
            let revertReason = 'Unknown error';
            
            console.error('❌ Simulation error details:', {
              message: simError?.message,
              shortMessage: simError?.shortMessage,
              data: simError?.data,
              cause: simError?.cause,
              causeData: simError?.cause?.data,
              causeReason: simError?.cause?.reason,
              causeShortMessage: simError?.cause?.shortMessage,
              name: simError?.name,
            });
            
            // Try to extract revert data from cause (viem wraps errors)
            const errorData = simError?.cause?.data || simError?.data;
            const errorReason = simError?.cause?.reason || simError?.reason;
            
            // Try to decode error data first
            if (errorData) {
              try {
                const decoded = decodeErrorResult({
                  abi: CCTP_TOKEN_MESSENGER_ABI,
                  data: errorData as `0x${string}`,
                });
                revertReason = `${decoded.errorName}${decoded.args ? `: ${JSON.stringify(decoded.args)}` : ''}`;
              } catch (decodeErr) {
                // If decode fails, use the raw data
                revertReason = `Revert data: ${errorData}`;
              }
            }
            // Try error reason (string revert reasons)
            else if (errorReason) {
              revertReason = errorReason;
            }
            // Fallback to error messages
            else if (simError?.cause?.shortMessage) {
              revertReason = simError.cause.shortMessage;
            } else if (simError?.shortMessage) {
              revertReason = simError.shortMessage;
            } else if (simError?.message) {
              revertReason = simError.message;
            }
            
            // Try to get revert reason via direct RPC eth_call if we still don't have details
            if (revertReason === 'Unknown error' || (revertReason.includes('reverted') && !revertReason.includes(':'))) {
              try {
                // Use direct RPC call which might give us revert data
                const callData = encodeFunctionData({
                  abi: CCTP_TOKEN_MESSENGER_ABI,
                  functionName: 'depositForBurn',
                  args: [amount, destinationDomain, mintRecipient, chainUSDC],
                });
                
                // Try eth_call with state override to see if we can get revert reason
                try {
                  const result = await publicClient.request({
                    method: 'eth_call',
                    params: [
                      {
                        from: address,
                        to: tokenMessenger,
                        data: callData,
                      },
                      'latest',
                    ],
                  });
                  
                  // If call succeeds, there's a logic issue
                  console.log('Direct call succeeded:', result);
                } catch (rpcError: any) {
                  // RPC errors often contain revert data in the data field
                  console.error('RPC call error:', rpcError);
                  
                  // Extract revert data from RPC error
                  const revertData = rpcError?.data || rpcError?.error?.data || rpcError?.cause?.data;
                  
                  if (revertData && revertData !== '0x') {
                    try {
                      // Try to decode as error
                      const decoded = decodeErrorResult({
                        abi: CCTP_TOKEN_MESSENGER_ABI,
                        data: revertData as `0x${string}`,
                      });
                      revertReason = `${decoded.errorName}${decoded.args ? `: ${JSON.stringify(decoded.args)}` : ''}`;
                    } catch {
                      // If decode fails, try to extract string reason (first 4 bytes are error selector, rest might be encoded string)
                      if (revertData.length > 10) {
                        // Try to extract ABI-encoded string (starts at offset 0x20)
                        try {
                          const stringOffset = parseInt(revertData.slice(10, 74), 16);
                          const stringLength = parseInt(revertData.slice(74, 74 + 64), 16);
                          const stringHex = revertData.slice(74 + 64, 74 + 64 + stringLength * 2);
                          const stringReason = Buffer.from(stringHex, 'hex').toString('utf8').replace(/\0/g, '');
                          if (stringReason) {
                            revertReason = stringReason;
                          }
                        } catch {
                          revertReason = `Revert data: ${revertData.slice(0, 100)}...`;
                        }
                      } else {
                        revertReason = `Revert: ${revertData}`;
                      }
                    }
                  } else if (rpcError?.message) {
                    revertReason = rpcError.message;
                  }
                }
              } catch (fallbackError: any) {
                console.error('Fallback error extraction failed:', fallbackError);
                // Keep the original revertReason
              }
            }
            
            // Extract more details from the error message if available
            if (revertReason.includes('insufficient') || revertReason.includes('allowance')) {
              revertReason = `Insufficient approval: ${revertReason}`;
            } else if (revertReason.includes('balance')) {
              revertReason = `Insufficient balance: ${revertReason}`;
            } else if (revertReason.includes('domain') || revertReason.includes('destination')) {
              revertReason = `Invalid destination domain (using 26 for Arc): ${revertReason}`;
            }
            
            // If we still don't have a specific reason, provide diagnostic help
            if (revertReason.includes('reverted') && !revertReason.includes(':')) {
              // Common CCTP issues:
              // 1. Domain 26 (Arc Testnet) not supported by Sepolia TokenMessenger
              // 2. Approval might be exactly equal to amount (some contracts require exact match)
              // 3. Contract might be paused
              // 4. mintRecipient format might be wrong
              
              // Most likely issue: Domain 26 not enabled on the Sepolia TokenMessenger contract
              // When bridging FROM Sepolia TO Arc, we use Sepolia's TokenMessenger, which may not have domain 26 enabled
              if (destinationDomain === 26 && chainId === 11155111) {
                revertReason = `Domain 26 (Arc Testnet) transaction reverted. ` +
                  `We're using the correct TokenMessengerV2 address on Sepolia (0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA), ` +
                  `but domain 26 may not be enabled for outbound transfers from Sepolia. ` +
                  `CCTP V2 supports Arc Testnet, but cross-chain domain pairs must be enabled by Circle. ` +
                  `Please switch to Arc Network directly to make payments, or try bridging from a different testnet (Base Sepolia, Arbitrum Sepolia).`;
              } else {
                const diagnosticInfo = [
                  `Approval: ${allowance.toString()} (need ${amount.toString()})`,
                  `Balance: ${balance.toString()} (need ${amount.toString()})`,
                  `Domain: ${destinationDomain}`,
                  `Recipient: ${creatorAddress}`,
                ].join(' | ');
                
                revertReason = `Transaction will revert. Possible causes: insufficient allowance, invalid domain, or contract paused. ${diagnosticInfo}`;
              }
            }
            
            console.error('❌ Transaction simulation failed:', revertReason);
            setError(`Transaction will fail: ${revertReason}`);
            setIsBridging(false);
            setStep('summary');
            return;
          }

          // Set manual gas limit to avoid exceeding chain maximum (16,777,216)
          // CCTP depositForBurn typically needs ~200k-500k gas, so 1M is safe
          const gasLimit = BigInt(1000000); // 1M gas (well below 16.7M cap)

          writeCCTPBridge({
            address: tokenMessenger,
            abi: CCTP_TOKEN_MESSENGER_ABI,
            functionName: 'depositForBurn',
            args: [amount, destinationDomain, mintRecipient, chainUSDC],
            gas: gasLimit, // Manual gas limit to prevent exceeding chain cap
          });
        } catch (err: any) {
          console.error('Error preparing bridge transaction:', err);
          setError(`Failed to prepare bridge: ${err.message || 'Unknown error'}`);
          setIsBridging(false);
          setStep('summary');
        }
      };
      
      bridgeTransaction();
    }
  }, [isCCTPApproved, isBridging, chainUSDC, tokenMessenger, intent, destinationDomain, address, publicClient, writeCCTPBridge]);

  // Handle CCTP bridge success - payment complete!
  useEffect(() => {
    if (isCCTPBridged && isBridging) {
      // Record payment in database
      const recordPayment = async () => {
        try {
          const response = await fetch('/api/unlocks/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: intent.kind,
              postId: intent.postId,
              creatorId: intent.creatorId,
              walletAddress: address,
              amount: intent.amountUSD,
              txHash: cctpBridgeHash || cctpBridgeTxHash,
              days: 30,
            }),
          });

          if (!response.ok) {
            console.error('Failed to record payment in database');
          }

          // Update local entitlements
          if (intent.kind === 'unlock' && intent.postId) {
            unlockPost(intent.postId);
          } else if (intent.kind === 'subscription') {
            activateSubscription(30);
          } else if (intent.kind === 'recurringTip' && intent.creatorId) {
            activateRecurringTip(intent.creatorId, intent.amountUSD, 30);
          }

          setIsBridging(false);
          setStep('success');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        } catch (error) {
          console.error('Error recording payment:', error);
          setIsBridging(false);
          setStep('success');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      };

      recordPayment();
    }
  }, [isCCTPBridged, isBridging, cctpBridgeHash, cctpBridgeTxHash, intent, address, onSuccess, onClose]);

  const getSummaryText = () => {
    if (intent.kind === 'unlock') {
      return `Unlock "${intent.title || 'Post'}"`;
    } else if (intent.kind === 'subscription') {
      return `Subscribe monthly`;
    } else if (intent.kind === 'recurringTip') {
      return `Set up recurring tip`;
    } else {
      return `Send tip`;
    }
  };

  if (step === 'success') {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold mb-2">Payment Successful!</DialogTitle>
            <DialogDescription className="text-base">
              Your content is now unlocked.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Confirm Payment
          </DialogTitle>
          <DialogDescription>
            {getSummaryText()}
          </DialogDescription>
        </DialogHeader>

        {step === 'summary' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-lg font-semibold">${intent.amountUSD.toFixed(2)} USDC</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Network</span>
                <Badge variant={isOnArc ? "default" : "secondary"}>
                  {isOnArc ? 'Arc Testnet' : `Chain ${chainId}`}
                </Badge>
              </div>
              {!isConnected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Please connect your wallet first</AlertDescription>
                </Alert>
              )}
              {isConnected && !isOnArc && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {canBridge ? (
                      <>
                        You're on chain {chainId}. USDC will be bridged to Arc Network using CCTP and sent directly to the creator.
                      </>
                    ) : (
                      <>
                        Chain {chainId} doesn't support CCTP. Please switch to Arc Network or a supported chain (Base, Arbitrum, Sepolia, etc.).
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {isConnected && isOnArc && (
                <Alert variant="default" className="border-green-500/20 bg-green-500/5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-green-700 dark:text-green-400">
                    You're on Arc Network. Payment will be processed directly.
                  </AlertDescription>
                </Alert>
              )}
              {isConnected && paymasterAvailable && !isOnArc && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="usePaymaster"
                        checked={usePaymaster}
                        onChange={(e) => setUsePaymaster(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="usePaymaster" className="cursor-pointer">
                        Pay gas fees in USDC (Circle Paymaster)
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Enable to pay gas in USDC instead of native token
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirm}
                  disabled={!isConnected || (!isOnArc && !canBridge && !paymasterAvailable)} 
                  className="flex-1"
                >
                  {!isConnected 
                    ? 'Connect Wallet First' 
                    : !isOnArc && !canBridge && !paymasterAvailable
                      ? 'Switch to Supported Chain'
                      : 'Confirm & Sign in Wallet'
                  }
                </Button>
              </div>
              {isConnected && !isOnArc && canBridge && (
                <p className="text-xs text-center text-muted-foreground">
                  💡 USDC will be bridged from {chainId} to Arc Network using CCTP and sent directly to the creator. This may take a few minutes.
                </p>
              )}
              {isConnected && !isOnArc && !canBridge && (
                <p className="text-xs text-center text-muted-foreground">
                  💡 Please switch to Arc Network or a CCTP-supported chain (Base, Arbitrum, Sepolia) using the chain selector in the top right.
                </p>
              )}
              {isConnected && isOnArc && (
                <p className="text-xs text-center text-muted-foreground">
                  💡 Your wallet (Metamask) will pop up asking you to confirm the transaction
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You're about to {getSummaryText().toLowerCase()} for ${intent.amountUSD.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">Proceed?</p>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium mb-1">
                {usePaymaster && paymasterAvailable
                  ? 'Processing payment with paymaster (gas in USDC)...'
                  : bridgeKitInProgress
                    ? (bridgeKitMessage || 'Bridging USDC to Arc (Bridge Kit)...')
                  : isCCTPApproving 
                    ? 'Approving USDC for bridge...' 
                    : isCCTPBridging 
                      ? 'Bridging USDC to Arc Network...' 
                      : isApproving 
                        ? 'Approving USDC...' 
                        : isPaying 
                          ? 'Processing payment...' 
                          : 'Waiting...'}
              </p>
              <p className="text-sm text-muted-foreground">
                {usePaymaster && paymasterAvailable
                  ? 'You may be prompted to sign permits and user operations. Gas will be paid in USDC.'
                  : bridgeKitInProgress
                    ? 'Bridge Kit will complete the transfer in the background. We will mark success shortly.'
                  : isCCTPBridging 
                    ? 'CCTP bridging may take a few minutes. USDC will be sent directly to the creator on Arc Network.'
                    : 'Please confirm the transaction in your wallet'}
              </p>
              {isCCTPBridged && (
                <Alert className="mt-4">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Bridge complete! Payment sent to creator on Arc Network.
                  </AlertDescription>
                </Alert>
              )}
              {paymasterTxHash && (
                <Alert className="mt-4">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Payment successful! Transaction: {paymasterTxHash.slice(0, 10)}...
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
