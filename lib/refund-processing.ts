// Utility functions for processing on-chain refunds
// Refunds transfer USDC from creator's wallet back to the user

import { parseUnits, formatUnits, type Address, type PublicClient, type WalletClient } from 'viem';
import { USDC_ABI } from './contracts';
import { USDC_DECIMALS } from './config';
import { getGatewayUSDCAddress } from './gateway';

export interface RefundTransactionParams {
  creatorWallet: Address;
  userWallet: Address;
  amountUSD: number;
  chainId: number;
  walletClient: WalletClient;
  publicClient: PublicClient;
}

export interface RefundTransactionResult {
  success: boolean;
  transactionHash?: `0x${string}`;
  error?: string;
  userRejected?: boolean; // True if user rejected the transaction
}

/**
 * Process an on-chain refund by transferring USDC from creator to user
 * This requires the creator's wallet to be connected and sign the transaction
 */
export async function processRefundTransaction({
  creatorWallet,
  userWallet,
  amountUSD,
  chainId,
  walletClient,
  publicClient,
}: RefundTransactionParams): Promise<RefundTransactionResult> {
  try {
    // Get USDC address for the chain
    const usdcAddress = getGatewayUSDCAddress(chainId);
    if (!usdcAddress) {
      return {
        success: false,
        error: `USDC not available on chain ${chainId}`,
      };
    }

    // Verify wallet is connected and matches creator wallet
    if (!walletClient.account) {
      return {
        success: false,
        error: 'Wallet not connected',
      };
    }

    if (walletClient.account.address.toLowerCase() !== creatorWallet.toLowerCase()) {
      return {
        success: false,
        error: 'Connected wallet does not match creator wallet. Please connect the correct wallet.',
      };
    }

    // Check creator's USDC balance
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [creatorWallet],
    });

    const amount = parseUnits(amountUSD.toFixed(6), USDC_DECIMALS);
    const balanceUSD = parseFloat(formatUnits(balance, USDC_DECIMALS));

    if (balanceUSD < amountUSD) {
      return {
        success: false,
        error: `Insufficient balance. Creator has $${balanceUSD.toFixed(2)} USDC, but refund requires $${amountUSD.toFixed(2)} USDC.`,
      };
    }

    // Transfer USDC from creator to user
    // Get chain from publicClient (required for writeContract)
    const chain = publicClient.chain;
    if (!chain) {
      return {
        success: false,
        error: 'Chain not available from public client',
      };
    }

    const hash = await walletClient.writeContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [userWallet, amount],
      account: walletClient.account,
      chain,
    });

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      return {
        success: true,
        transactionHash: hash,
      };
    } else {
      return {
        success: false,
        error: 'Transaction failed',
      };
    }
  } catch (error: any) {
    console.error('Refund transaction error:', error);
    
    // Check if user rejected the transaction
    const errorMessage = error.message || error.shortMessage || '';
    const isUserRejection = 
      errorMessage.includes('User denied') ||
      errorMessage.includes('User rejected') ||
      errorMessage.includes('user rejected') ||
      errorMessage.includes('rejected') ||
      errorMessage.includes('denied') ||
      error.code === 4001 || // MetaMask user rejection code
      error.code === 'ACTION_REJECTED';
    
    if (isUserRejection) {
      return {
        success: false,
        error: 'USER_REJECTED', // Special error code for user rejection
        userRejected: true,
      };
    }
    
    return {
      success: false,
      error: error.message || error.shortMessage || 'Failed to process refund transaction',
      userRejected: false,
    };
  }
}

