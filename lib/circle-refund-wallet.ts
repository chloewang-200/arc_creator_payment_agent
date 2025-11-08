// Circle Web3 Services Integration for Automated Refund Wallets
// Uses Circle's developer-controlled wallets for platform-managed refunds

import { parseUnits } from 'viem';
import { randomUUID } from 'crypto';
import { USDC_ABI } from './contracts';
import { USDC_DECIMALS } from './config';

// Circle API base URL
const CIRCLE_API_URL = 'https://api.circle.com/v1/w3s';

// Helper to get Circle API headers
function getCircleHeaders() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY not configured');
  }
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

// Helper to generate a fresh entity secret ciphertext (required per request)
async function getEntitySecretCiphertext(): Promise<string> {
  const secret = process.env.CIRCLE_ENTITY_SECRET;
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!secret) {
    throw new Error('CIRCLE_ENTITY_SECRET not configured');
  }
  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY not configured');
  }

  try {
    const { generateEntitySecretCiphertext } = await import('@circle-fin/developer-controlled-wallets');
    const ciphertext = await generateEntitySecretCiphertext({
      apiKey,
      entitySecret: secret,
    });

    if (!ciphertext) {
      throw new Error('Failed to generate entity secret ciphertext');
    }

    return ciphertext;
  } catch (error: any) {
    console.error('[Circle] Failed to generate entity secret ciphertext:', error);
    throw new Error(error?.message || 'Failed to encrypt entity secret');
  }
}

async function getTokenIdForWallet(walletId: string, tokenAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`${CIRCLE_API_URL}/wallets/${walletId}/balances`, {
      headers: getCircleHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        console.warn('[Circle] Wallet not found in Circle API:', walletId);
        return null;
      }
      console.error('[Circle] Failed to fetch wallet balances:', error);
      return null;
    }

    const data = await response.json();
    const balances: any[] = data?.data?.tokenBalances || [];
    const target = tokenAddress.toLowerCase();

    console.log('[Circle] Wallet balances:', balances.length, 'tokens found');
    console.log('[Circle] Looking for USDC at address:', target);

    // Find matching token
    // For native tokens (like USDC on Arc), tokenAddress will be undefined
    // For ERC-20 tokens, we match by tokenAddress
    const match = balances.find((balance) => {
      const token = balance?.token;
      if (!token) return false;

      // Check if it's a native token (Arc USDC is native)
      if (token.isNative) {
        // For native tokens, check if symbol matches USDC
        const isUSDC = token.symbol?.toUpperCase().includes('USDC');
        if (isUSDC) {
          console.log('[Circle] Found native USDC token:', token.symbol);
          return true;
        }
      }

      // For ERC-20 tokens, match by tokenAddress
      const tokenAddr = token.tokenAddress?.toLowerCase();
      if (tokenAddr === target) {
        console.log('[Circle] Found ERC-20 USDC token:', token);
        return true;
      }

      return false;
    });

    if (!match) {
      console.warn('[Circle] Token not found in wallet balances. Available tokens:', 
        balances.map(b => ({ 
          address: b?.token?.tokenAddress, 
          symbol: b?.token?.symbol,
          isNative: b?.token?.isNative,
          id: b?.token?.id 
        }))
      );
    } else {
      console.log('[Circle] Found matching token ID:', match.token.id);
    }

    return match?.token?.id || null;
  } catch (error) {
    console.error('[Circle] Error fetching token ID:', error);
    return null;
  }
}

export interface CreatorWalletInfo {
  walletSetId: string;
  walletId: string;
  address: string;
  chain: string;
}

export interface ProcessRefundParams {
  creatorId: string;
  userAddress: string;
  amountUSD: number;
  chainId?: number; // Default to Arc Testnet (5042002)
}

export interface ProcessRefundResult {
  success: boolean;
  transactionHash?: string;
  challengeId?: string; // Circle uses challenges for transaction confirmation
  error?: string;
}

/**
 * Initialize platform refund wallet (ONE-TIME SETUP)
 * Creates a wallet set and wallet on Arc Network
 */
export async function initializeCreatorCircleWallet(
  creatorId: string
): Promise<{
  success: boolean;
  walletSetId?: string;
  walletId?: string;
  address?: string;
  chain?: string;
  error?: string;
}> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('id, name, circle_wallet_id, circle_wallet_address, circle_wallet_set_id, circle_wallet_chain')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      throw new Error('Creator not found');
    }

    if (creator.circle_wallet_id && creator.circle_wallet_address) {
      return {
        success: true,
        walletSetId: creator.circle_wallet_set_id || '',
        walletId: creator.circle_wallet_id,
        address: creator.circle_wallet_address,
        chain: creator.circle_wallet_chain || 'ARC-TESTNET',
      };
    }

    console.log('[Circle] Creating wallet set for creator...', creatorId);

    const walletSetCiphertext = await getEntitySecretCiphertext();
    const walletSetResponse = await fetch(`${CIRCLE_API_URL}/walletSets`, {
      method: 'POST',
      headers: getCircleHeaders(),
      body: JSON.stringify({
        name: `${creator.name || 'Creator'} Refund Wallet Set`,
        idempotencyKey: randomUUID(),
        entitySecretCiphertext: walletSetCiphertext,
      }),
    });

    if (!walletSetResponse.ok) {
      const error = await walletSetResponse.json();
      throw new Error(`Failed to create wallet set: ${JSON.stringify(error)}`);
    }

    const walletSetData = await walletSetResponse.json();
    const walletSetId = walletSetData.data.walletSet.id;

    console.log('[Circle] Wallet set created for creator:', walletSetId);

    const walletCiphertext = await getEntitySecretCiphertext();
    const walletResponse = await fetch(`${CIRCLE_API_URL}/wallets`, {
      method: 'POST',
      headers: getCircleHeaders(),
      body: JSON.stringify({
        accountType: 'SCA',
        blockchains: ['ARC-TESTNET'],
        count: 1,
        walletSetId,
        idempotencyKey: randomUUID(),
        entitySecretCiphertext: walletCiphertext,
      }),
    });

    if (!walletResponse.ok) {
      const error = await walletResponse.json();
      throw new Error(`Failed to create wallet: ${JSON.stringify(error)}`);
    }

    const walletData = await walletResponse.json();
    const wallet = walletData.data.wallets[0];
    const chain = wallet.blockchain || 'ARC-TESTNET';

    await supabaseAdmin
      .from('creators')
      .update({
        circle_wallet_set_id: walletSetId,
        circle_wallet_id: wallet.id,
        circle_wallet_address: wallet.address,
        circle_wallet_chain: chain,
        circle_wallet_status: 'ready',
      })
      .eq('id', creatorId);

    return {
      success: true,
      walletSetId,
      walletId: wallet.id,
      address: wallet.address,
      chain,
    };
  } catch (error: any) {
    console.error('[Circle] Error initializing creator wallet:', error);
    return {
      success: false,
      error: error.message || 'Failed to initialize creator wallet',
    };
  }
}

/**
 * Get the platform refund wallet address and balance
 */
async function refreshCreatorWalletFromCircle(creatorId: string): Promise<CreatorWalletInfo | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { data, error } = await supabaseAdmin
      .from('creators')
      .select('circle_wallet_set_id, circle_wallet_address')
      .eq('id', creatorId)
      .single();

    if (error || !data?.circle_wallet_set_id) {
      return null;
    }

    const response = await fetch(
      `${CIRCLE_API_URL}/wallets?walletSetId=${data.circle_wallet_set_id}`,
      { headers: getCircleHeaders() }
    );

    if (!response.ok) {
      console.error('[Circle] Failed to refresh wallet from Circle:', await response.json());
      return null;
    }

    const wallets = (await response.json())?.data?.wallets || [];
    if (!wallets.length) {
      return null;
    }

    const targetAddress = data.circle_wallet_address?.toLowerCase();
    let wallet = wallets.find((w: any) => w.address?.toLowerCase() === targetAddress);
    if (!wallet) {
      const walletDetailResp = await fetch(`${CIRCLE_API_URL}/wallets/${wallets[0].id}`, {
        headers: getCircleHeaders(),
      });
      if (walletDetailResp.ok) {
        const detail = await walletDetailResp.json();
        wallet = detail?.data?.wallet || wallets[0];
      } else {
        wallet = wallets[0];
      }
    }

    const info: CreatorWalletInfo = {
      walletSetId: data.circle_wallet_set_id,
      walletId: wallet.id,
      address: wallet.address,
      chain: wallet.blockchain || 'ARC-TESTNET',
    };

    await supabaseAdmin
      .from('creators')
      .update({
        circle_wallet_id: info.walletId,
        circle_wallet_address: info.address,
        circle_wallet_chain: info.chain,
        circle_wallet_status: 'ready',
      })
      .eq('id', creatorId);

    return info;
  } catch (err) {
    console.error('[Circle] Error refreshing wallet info:', err);
    return null;
  }
}

export async function getCreatorCircleWallet(creatorId: string): Promise<CreatorWalletInfo | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { data, error } = await supabaseAdmin
      .from('creators')
      .select('circle_wallet_set_id, circle_wallet_id, circle_wallet_address, circle_wallet_chain')
      .eq('id', creatorId)
      .single();

    if (error) {
      throw error;
    }

    if (!data?.circle_wallet_id || !data?.circle_wallet_address || !data?.circle_wallet_set_id) {
      return await refreshCreatorWalletFromCircle(creatorId);
    }

    return {
      walletSetId: data.circle_wallet_set_id,
      walletId: data.circle_wallet_id,
      address: data.circle_wallet_address,
      chain: data.circle_wallet_chain || 'ARC-TESTNET',
    };
  } catch (error) {
    console.error('[Circle] Error fetching creator wallet:', error);
    return null;
  }
}

/**
 * Process a refund via Circle developer-controlled wallet
 * Platform wallet sends USDC to user automatically
 */
export async function processRefundViaCircle(
  params: ProcessRefundParams
): Promise<ProcessRefundResult> {
  try {
    const { ARC_CHAIN_ID } = await import('./config');
    const { creatorId, userAddress, amountUSD, chainId = ARC_CHAIN_ID } = params;

    console.log(`[Circle] Processing refund: $${amountUSD} to ${userAddress}`);

    let wallet = await getCreatorCircleWallet(creatorId);
    if (!wallet) {
      return {
        success: false,
        error: 'Circle wallet not initialized for this creator',
      };
    }

    // Balance already checked in canProcessRefund() using on-chain data

    // Get the correct USDC address for the chain
    const { getGatewayUSDCAddress } = await import('@/lib/gateway');
    const usdcAddress = getGatewayUSDCAddress(chainId);
    
    if (!usdcAddress) {
      return {
        success: false,
        error: `USDC address not configured for chain ${chainId}`,
      };
    }

    console.log('[Circle] Getting token ID for USDC address:', usdcAddress, 'on chain', chainId);

    // Get token ID from Circle API by checking wallet balances
    // Circle requires the token ID (not address) for transfers
    let tokenId = await getTokenIdForWallet(wallet.walletId, usdcAddress);

    if (!tokenId) {
      console.log('[Circle] Token ID not found, refreshing wallet and retrying...');
      const refreshedWallet = await refreshCreatorWalletFromCircle(creatorId);
      if (refreshedWallet) {
        wallet = refreshedWallet;
        tokenId = await getTokenIdForWallet(wallet.walletId, usdcAddress);
      }
    }

    if (!tokenId) {
      // Log detailed error for debugging
      console.error('[Circle] Failed to get token ID. Wallet ID:', wallet.walletId, 'USDC Address:', usdcAddress);
      console.error('[Circle] This usually means USDC has not been deposited into the Circle wallet yet.');
      return {
        success: false,
        error: 'USDC token not detected in Circle wallet. Please deposit USDC into your Circle refund wallet first.',
      };
    }

    console.log('[Circle] Found token ID:', tokenId, 'for USDC address:', usdcAddress);

    // Generate idempotency key for this transaction
    const idempotencyKey = randomUUID();

    // Create transaction via Circle API
    // According to Circle docs: POST /developer/transactions/transfer
    const transferCiphertext = await getEntitySecretCiphertext();
    const blockchain = wallet.chain || 'ARC-TESTNET';

    console.log('[Circle] Creating transfer transaction:', {
      walletId: wallet.walletId,
      blockchain,
      tokenId,
      destinationAddress: userAddress,
      amount: amountUSD.toFixed(6),
    });

    // Build request body exactly as per Circle API documentation
    // POST /developer/transactions/transfer
    // See: https://developers.circle.com/w3s/docs/developer-controlled-wallets
    const requestBody = {
      idempotencyKey,
      walletId: wallet.walletId,
      tokenId,
      destinationAddress: userAddress,
      amounts: [amountUSD.toFixed(6)], // Array of strings as per docs
      feeLevel: 'MEDIUM', // Top-level field, not nested
      entitySecretCiphertext: transferCiphertext,
    };

    console.log('[Circle] Transfer request body:', {
      ...requestBody,
      entitySecretCiphertext: '[REDACTED]', // Don't log the ciphertext
    });

    const txResponse = await fetch(`${CIRCLE_API_URL}/developer/transactions/transfer`, {
      method: 'POST',
      headers: getCircleHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!txResponse.ok) {
      const error = await txResponse.json();
      console.error('[Circle] Transfer API error:', JSON.stringify(error, null, 2));
      throw new Error(`Transfer failed: ${JSON.stringify(error)}`);
    }

    const txData = await txResponse.json();
    console.log('[Circle] Transfer response:', JSON.stringify(txData, null, 2));

    // Circle API might return challengeId in different locations
    const challengeId = txData.data?.challengeId || txData.data?.id || txData.challengeId || txData.id;
    const transactionId = txData.data?.id || txData.data?.transactionId || txData.id;

    if (!challengeId && !transactionId) {
      console.error('[Circle] No challengeId or transactionId in response:', txData);
      throw new Error('Circle API did not return a challenge ID or transaction ID');
    }

    const idToPoll = challengeId || transactionId;
    console.log('[Circle] Transaction initiated, challenge/transaction ID:', idToPoll);

    // Circle transactions are processed asynchronously
    // The transaction is initiated successfully, but we can't easily poll for status
    // since the /wallets/{walletId}/transactions endpoint returns 404
    // 
    // According to Circle's API, when a transfer is initiated, it returns an ID and state "INITIATED"
    // The transaction will be processed by Circle asynchronously
    // 
    // For now, we'll return success with the transaction ID and let Circle process it
    // The transaction hash will be available later via webhooks or by checking on-chain
    
    console.log('[Circle] Transaction initiated successfully. Circle will process it asynchronously.');
    console.log('[Circle] Transaction ID:', idToPoll);
    console.log('[Circle] Note: Transaction status polling is not available via API. Circle processes transactions asynchronously.');
    
    // Return success with the transaction ID
    // The actual transaction hash will be available once Circle processes the transaction
    // For refunds, we can mark it as "processing" and update with the hash later if needed
    return {
      success: true,
      transactionHash: undefined, // Will be available once Circle processes the transaction
      challengeId: idToPoll,
    };
  } catch (error: any) {
    console.error('[Circle] Error processing refund:', error);
    return {
      success: false,
      error: error.message || 'Failed to process refund',
    };
  }
}

/**
 * Get creator's refund balance (stored in database)
 */
export async function getCreatorRefundBalance(creatorId: string): Promise<number> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { data, error } = await supabaseAdmin
      .from('creators')
      .select('refund_balance_usd')
      .eq('id', creatorId)
      .single();

    if (error) throw error;
    return data?.refund_balance_usd || 0;
  } catch (error) {
    console.error('[Circle] Error getting creator refund balance:', error);
    return 0;
  }
}

/**
 * Credit creator's refund balance (after deposit to their Circle wallet)
 */
export async function creditCreatorBalance(
  creatorId: string,
  amountUSD: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    // Get current balance
    const { data: creator } = await supabaseAdmin
      .from('creators')
      .select('refund_balance_usd')
      .eq('id', creatorId)
      .single();

    const newBalance = (creator?.refund_balance_usd || 0) + amountUSD;

    // Update balance
    const { error } = await supabaseAdmin
      .from('creators')
      .update({ refund_balance_usd: newBalance })
      .eq('id', creatorId);

    if (error) throw error;

    return { success: true, newBalance };
  } catch (error: any) {
    console.error('[Circle] Error crediting creator balance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Debit creator's refund balance (after processing refund)
 */
export async function debitCreatorBalance(
  creatorId: string,
  amountUSD: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    // Check sufficient balance
    const currentBalance = await getCreatorRefundBalance(creatorId);
    if (currentBalance < amountUSD) {
      return {
        success: false,
        error: `Insufficient balance. Has $${currentBalance.toFixed(2)}, needs $${amountUSD.toFixed(2)}`,
      };
    }

    // Update balance
    const newBalance = currentBalance - amountUSD;
    const { error } = await supabaseAdmin
      .from('creators')
      .update({ refund_balance_usd: newBalance })
      .eq('id', creatorId);

    if (error) throw error;

    return { success: true, newBalance };
  } catch (error: any) {
    console.error('[Circle] Error debiting creator balance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if refund can be processed (checks balance and limits)
 */
export async function canProcessRefund(
  creatorId: string,
  amountUSD: number
): Promise<{ canProcess: boolean; reason?: string }> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    // Get creator settings - use supabaseAdmin to bypass RLS
    const { data: creator, error } = await supabaseAdmin
      .from('creators')
      .select('circle_wallet_address, refund_daily_limit_usd, refund_enabled')
      .eq('id', creatorId)
      .single();

    console.log('[Circle] Refund eligibility check:', { creator, error, amountUSD });

    if (!creator) {
      return { canProcess: false, reason: 'Creator not found' };
    }

    if (!creator.refund_enabled) {
      console.log('[Circle] Refund not enabled:', creator.refund_enabled);
      return { canProcess: false, reason: 'Automated refunds not enabled' };
    }

    // Check on-chain Circle wallet balance instead of database balance
    if (!creator.circle_wallet_address) {
      console.log('[Circle] No Circle wallet set up');
      return { canProcess: false, reason: 'Circle wallet not configured' };
    }

    // Get on-chain USDC balance
    const { createPublicClient, http } = await import('viem');
    const { ARC_RPC_URL, USDC_DECIMALS, ARC_CHAIN_ID } = await import('@/lib/config');
    const { USDC_ABI } = await import('@/lib/contracts');
    const { getGatewayUSDCAddress } = await import('@/lib/gateway');

    const publicClient = createPublicClient({
      transport: http(ARC_RPC_URL),
    });

    const usdcAddress = getGatewayUSDCAddress(ARC_CHAIN_ID);
    if (!usdcAddress) {
      console.error('[Circle] USDC address not found for Arc Testnet');
      return { canProcess: false, reason: 'USDC contract not configured' };
    }

    console.log('[Circle] Checking balance for wallet:', creator.circle_wallet_address, 'USDC address:', usdcAddress);

    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [creator.circle_wallet_address as `0x${string}`],
    });

    const balanceUSD = Number(balance) / Math.pow(10, USDC_DECIMALS);
    console.log('[Circle] On-chain wallet balance:', balanceUSD, 'USDC');

    if (balanceUSD < amountUSD) {
      console.log('[Circle] Insufficient on-chain balance:', balanceUSD, '<', amountUSD);
      return {
        canProcess: false,
        reason: `Insufficient balance ($${balanceUSD.toFixed(2)} available)`,
      };
    }

    // Check daily limit
    const { data: dailyTotal } = await supabaseAdmin
      .from('daily_refund_totals')
      .select('total_refunded_usd')
      .eq('creator_id', creatorId)
      .eq('date', new Date().toISOString().split('T')[0])
      .maybeSingle();

    const todayRefunded = dailyTotal?.total_refunded_usd || 0;
    const dailyLimit = creator.refund_daily_limit_usd || 100;

    console.log('[Circle] Daily limit check:', { todayRefunded, dailyLimit, amountUSD });

    if (todayRefunded + amountUSD > dailyLimit) {
      return {
        canProcess: false,
        reason: `Would exceed daily limit ($${todayRefunded.toFixed(2)} of $${dailyLimit.toFixed(2)} used)`,
      };
    }

    console.log('[Circle] ✅ All checks passed - refund can be processed!');
    return { canProcess: true };
  } catch (error: any) {
    console.error('[Circle] Error checking refund eligibility:', error);
    return { canProcess: false, reason: error.message };
  }
}
