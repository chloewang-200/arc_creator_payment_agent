// Payment utility using Circle Paymaster (gas-in-USDC)
// Uses Pimlico bundler with EIP-7702 smart accounts (works with MetaMask!)

import { parseUnits, type Address, type PublicClient, type WalletClient, type Hex, type Chain, encodePacked, hexToBigInt, http } from 'viem';
import { createBundlerClient, toSimple7702SmartAccount } from 'viem/account-abstraction';
import { getPaymasterAddress, getPimlicoApiKey } from './paymaster-config';
import { getGatewayUSDCAddress } from './gateway';
import { PAYROUTER_ADDRESS, USDC_DECIMALS, CREATOR_ADDRESS } from './config';
import type { PaymentIntent } from '@/types';
import { encodeFunctionData } from 'viem';
import { PAYROUTER_ABI } from './contracts';
import { skuPost, skuSub, skuTip, skuRecurringTip } from './sku';
import { signPermit } from './permit';

export interface PaymasterPaymentResult {
  userOpHash?: string;
  txHash?: string;
  success: boolean;
  error?: string;
}

/**
 * Build call data for PayRouter.pay() function
 */
function buildPayRouterCallData(
  intent: PaymentIntent,
  payRouterAddress: Address,
  creatorAddress: Address,
  amount: bigint
): Hex {
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

  return encodeFunctionData({
    abi: PAYROUTER_ABI,
    functionName: 'pay',
    args: [sku, creatorAddress, amount],
  });
}

/**
 * Submit a payment using Circle Paymaster (gas paid in USDC)
 *
 * Uses Pimlico bundler with EIP-7702 smart accounts.
 * Works with MetaMask and other regular wallets!
 *
 * Flow:
 * 1. Create EIP-7702 smart account from connected wallet
 * 2. Sign USDC permit for paymaster
 * 3. Create bundler client (Pimlico)
 * 4. Build payment call
 * 5. Sign EIP-7702 authorization
 * 6. Send user operation with paymaster and authorization
 * 7. Wait for transaction receipt
 */
export async function submitPaymasterPayment({
  intent,
  walletClient,
  publicClient,
  chainId,
}: {
  intent: PaymentIntent;
  walletClient: WalletClient;
  publicClient: PublicClient;
  chainId: number;
}): Promise<PaymasterPaymentResult> {
  try {
    const usdcAddress = getGatewayUSDCAddress(chainId);
    const paymasterAddress = getPaymasterAddress(chainId);
    const pimlicoApiKey = getPimlicoApiKey();

    if (!usdcAddress) {
      return {
        success: false,
        error: 'USDC not available on this chain',
      };
    }

    if (!paymasterAddress) {
      return {
        success: false,
        error: 'Circle Paymaster not available on this chain',
      };
    }

    if (!pimlicoApiKey) {
      return {
        success: false,
        error: 'Pimlico API key required. Please add NEXT_PUBLIC_PIMLICO_API_KEY to .env.local. Get a free key at https://pimlico.io',
      };
    }

    if (!walletClient.account) {
      return {
        success: false,
        error: 'Wallet account not available',
      };
    }

    const amount = parseUnits(intent.amountUSD.toFixed(6), USDC_DECIMALS);
    const creatorAddress = intent.creatorAddress || CREATOR_ADDRESS;

    // 1. Create EIP-7702 smart account from connected wallet
    // Works with MetaMask - delegates code to smart contract while keeping EOA address!
    const smartAccount = await toSimple7702SmartAccount({
      client: publicClient,
      owner: walletClient.account as any,
    });

    console.log('✅ EIP-7702 Smart account created:', smartAccount.address);

    // 2. Set up paymaster with USDC permit
    const permitAmount = BigInt(10_000_000); // 10 USDC allowance for paymaster

    // Note: EIP-7702 keeps the same address as the EOA, so user's USDC in MetaMask is accessible
    // The permit allows the paymaster to spend USDC from the account for gas fees
    const paymaster = {
      async getPaymasterData() {
        // Sign permit for the account (same as EOA address with EIP-7702)
        // The paymaster will spend this USDC to pay for gas
        const ownerAddress = walletClient.account!.address;

        const permitSignature = await signPermit({
          tokenAddress: usdcAddress,
          client: publicClient,
          ownerAddress,
          spenderAddress: paymasterAddress,
          permitAmount,
          walletClient,
        });

        const paymasterData = encodePacked(
          ['uint8', 'address', 'uint256', 'bytes'],
          [0, usdcAddress, permitAmount, permitSignature]
        );

        return {
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: BigInt(200000),
          paymasterPostOpGasLimit: BigInt(15000),
          isFinal: true,
        };
      },
    };

    // 3. Create bundler client using Pimlico
    // Important: Don't pass publicClient as it uses Base Sepolia RPC which returns 403
    // Instead, let the bundler use its own transport exclusively
    const bundlerUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoApiKey}`;

    const bundlerClient = createBundlerClient({
      account: smartAccount,
      chain: publicClient.chain as Chain,
      paymaster,
      userOperation: {
        estimateFeesPerGas: async ({ bundlerClient }) => {
          try {
            const { standard: fees } = (await (bundlerClient as any).request({
              method: 'pimlico_getUserOperationGasPrice',
            }));
            return {
              maxFeePerGas: hexToBigInt(fees.maxFeePerGas),
              maxPriorityFeePerGas: hexToBigInt(fees.maxPriorityFeePerGas),
            };
          } catch (error) {
            // Fallback gas prices if Pimlico fails
            return {
              maxFeePerGas: BigInt(1500000000), // 1.5 gwei
              maxPriorityFeePerGas: BigInt(1500000000), // 1.5 gwei
            };
          }
        },
      },
      transport: http(bundlerUrl),
    });

    console.log('✅ Bundler client created (Pimlico)');

    // 4. Build the payment call
    const paymentCall = {
      to: PAYROUTER_ADDRESS,
      abi: PAYROUTER_ABI,
      functionName: 'pay' as const,
      args: (() => {
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
        return [sku, creatorAddress, amount];
      })(),
    };

    // 5. Sign EIP-7702 authorization
    // This allows the account to delegate code execution to the smart contract
    console.log('✍️ Signing EIP-7702 authorization...');
    const nonce = await publicClient.getTransactionCount({
      address: walletClient.account.address,
    });

    const authorization = await walletClient.account!.signAuthorization!({
      chainId: publicClient.chain!.id,
      nonce,
      contractAddress: smartAccount.address,
    });

    console.log('✅ Authorization signed');

    // 6. Send user operation with authorization
    // Pimlico bundler handles everything automatically
    console.log('📤 Sending user operation...');
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: [paymentCall] as any,
      authorization,
    });

    console.log('⏳ User operation submitted:', userOpHash);

    // 7. Wait for transaction receipt
    const { receipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    console.log('✅ Transaction confirmed:', receipt.transactionHash);

    return {
      success: true,
      userOpHash,
      txHash: receipt.transactionHash,
    };
  } catch (error: any) {
    console.error('❌ Paymaster payment failed:', error);
    return {
      success: false,
      error: error.message || 'Paymaster payment failed',
    };
  }
}

/**
 * Check if paymaster payment is available on current chain
 */
export function isPaymasterPaymentAvailable(chainId: number): boolean {
  const usdcAddress = getGatewayUSDCAddress(chainId);
  const paymasterAddress = getPaymasterAddress(chainId);
  const pimlicoApiKey = getPimlicoApiKey();

  return !!(usdcAddress && paymasterAddress && pimlicoApiKey);
}

