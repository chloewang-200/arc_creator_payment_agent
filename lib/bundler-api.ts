// Bundler API client for EIP-4337 Account Abstraction
// Submits user operations to bundler (Pimlico) for execution

import { type Address, type Hex, encodeFunctionData, keccak256, toHex } from 'viem';
import { getBundlerEndpoint, getPimlicoApiKey, ENTRYPOINT_V07_ADDRESS } from './paymaster-config';
import { PAYROUTER_ABI } from './contracts';
import { skuPost, skuSub, skuTip, skuRecurringTip } from './sku';
import type { PaymentIntent } from '@/types';

export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

/**
 * Serialize UserOperation to JSON-compatible format
 * Converts BigInt values to hex strings
 */
export function serializeUserOperation(userOp: UserOperation): Record<string, string> {
  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: toHex(userOp.callGasLimit),
    verificationGasLimit: toHex(userOp.verificationGasLimit),
    preVerificationGas: toHex(userOp.preVerificationGas),
    maxFeePerGas: toHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

/**
 * Serialize partial UserOperation (without gas limits)
 */
export function serializePartialUserOperation(
  userOp: Omit<UserOperation, 'callGasLimit' | 'verificationGasLimit' | 'preVerificationGas' | 'signature'>
): Record<string, string> {
  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    maxFeePerGas: toHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
  };
}

export interface BundlerResponse {
  userOperationHash: Hex;
}

/**
 * Get user operation gas price from bundler
 */
export async function getUserOperationGasPrice(
  chainId: number
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const bundlerEndpoint = getBundlerEndpoint(chainId);
  if (!bundlerEndpoint) {
    throw new Error(`No bundler endpoint for chain ${chainId}`);
  }

  try {
    const apiKey = getPimlicoApiKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // Pimlico uses Authorization: Bearer format
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      console.warn('⚠️ Pimlico API key not found. Add NEXT_PUBLIC_PIMLICO_API_KEY to .env.local');
    }

    const response = await fetch(bundlerEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pimlico_getUserOperationGasPrice',
        params: [],
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Failed to get gas price');
    }

    const fees = data.result.standard;
    return {
      maxFeePerGas: BigInt(fees.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(fees.maxPriorityFeePerGas),
    };
  } catch (error: any) {
    // Fallback gas prices
    return {
      maxFeePerGas: BigInt(1000000000), // 1 gwei
      maxPriorityFeePerGas: BigInt(100000000), // 0.1 gwei
    };
  }
}

/**
 * Estimate gas for user operation
 */
export async function estimateUserOperationGas(
  chainId: number,
  userOp: Omit<UserOperation, 'callGasLimit' | 'verificationGasLimit' | 'preVerificationGas' | 'signature'>
): Promise<{ callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint }> {
  const bundlerEndpoint = getBundlerEndpoint(chainId);
  if (!bundlerEndpoint) {
    throw new Error(`No bundler endpoint for chain ${chainId}`);
  }

  try {
    const apiKey = getPimlicoApiKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // Pimlico uses Authorization: Bearer format
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      console.warn('⚠️ Pimlico API key not found. Add NEXT_PUBLIC_PIMLICO_API_KEY to .env.local');
    }

    // Serialize user operation to avoid BigInt serialization errors
    const serializedUserOp = serializePartialUserOperation(userOp);

    const response = await fetch(bundlerEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_estimateUserOperationGas',
        params: [serializedUserOp, ENTRYPOINT_V07_ADDRESS], // EntryPoint v0.7 address
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Failed to estimate gas');
    }

    return {
      callGasLimit: BigInt(data.result.callGasLimit),
      verificationGasLimit: BigInt(data.result.verificationGasLimit),
      preVerificationGas: BigInt(data.result.preVerificationGas),
    };
  } catch (error: any) {
    // Fallback gas estimates
    return {
      callGasLimit: BigInt(500000),
      verificationGasLimit: BigInt(200000),
      preVerificationGas: BigInt(50000),
    };
  }
}

/**
 * Submit user operation to bundler
 */
export async function submitUserOperation(
  chainId: number,
  userOp: UserOperation
): Promise<{ userOperationHash: Hex }> {
  const bundlerEndpoint = getBundlerEndpoint(chainId);
  if (!bundlerEndpoint) {
    throw new Error(`No bundler endpoint for chain ${chainId}`);
  }

  const apiKey = getPimlicoApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Pimlico uses Authorization: Bearer format
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    console.warn('⚠️ Pimlico API key not found. Add NEXT_PUBLIC_PIMLICO_API_KEY to .env.local');
    throw new Error('Pimlico API key required. Please add NEXT_PUBLIC_PIMLICO_API_KEY to .env.local and restart your dev server.');
  }

  // Serialize user operation to avoid BigInt serialization errors
  const serializedUserOp = serializeUserOperation(userOp);

  const response = await fetch(bundlerEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [serializedUserOp, ENTRYPOINT_V07_ADDRESS], // EntryPoint v0.7 address
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Failed to submit user operation');
  }

  return {
    userOperationHash: data.result as Hex,
  };
}

/**
 * Get user operation receipt
 */
export async function getUserOperationReceipt(
  chainId: number,
  userOpHash: Hex
): Promise<{ receipt: { transactionHash: Hex; blockNumber: bigint } } | null> {
  const bundlerEndpoint = getBundlerEndpoint(chainId);
  if (!bundlerEndpoint) {
    throw new Error(`No bundler endpoint for chain ${chainId}`);
  }

  const apiKey = getPimlicoApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Pimlico uses Authorization: Bearer format
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(bundlerEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getUserOperationReceipt',
      params: [userOpHash],
    }),
  });

  const data = await response.json();
  if (data.error || !data.result) {
    return null;
  }

  return {
    receipt: {
      transactionHash: data.result.receipt.transactionHash as Hex,
      blockNumber: BigInt(data.result.receipt.blockNumber),
    },
  };
}

/**
 * Build call data for PayRouter.pay() function
 */
export function buildPayRouterCallData(
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

