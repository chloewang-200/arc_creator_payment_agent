// Circle Paymaster configuration for different chains

import { ARC_CHAIN_ID } from './config';

// Pimlico API key (required for bundler service)
// Get free API key from: https://pimlico.io
export const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;

// Circle Paymaster v0.8 addresses
// Note: These are testnet addresses. Update with mainnet addresses for production.
export const CIRCLE_PAYMASTER_ADDRESSES: Record<number, `0x${string}`> = {
  // Testnet (Paymaster v0.8)
  421614: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Arbitrum Sepolia
  11155111: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Ethereum Sepolia
  84532: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Base Sepolia
  11155420: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Optimism Sepolia
  43113: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Avalanche Fuji
  80002: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Polygon Amoy
  // Mainnet (Paymaster v0.8)
  42161: '0x6C973eBe80dCD8660841D4356bf15c32460271C9', // Arbitrum One
  8453: '0x6C973eBe80dCD8660841D4356bf15c32460271C9', // Base
  [ARC_CHAIN_ID]: '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966', // Arc Testnet
};

// Bundler endpoints
// Using Pimlico public bundler (free tier available)
export const BUNDLER_ENDPOINTS: Record<number, string> = {
  // Testnet
  11155111: 'https://api.pimlico.io/v1/sepolia/rpc', // Ethereum Sepolia
  421614: 'https://api.pimlico.io/v1/arbitrum-sepolia/rpc', // Arbitrum Sepolia
  // Mainnet
  1: 'https://api.pimlico.io/v1/ethereum/rpc', // Ethereum Mainnet
  // Add more chains as needed
  // 137: 'https://api.pimlico.io/v1/polygon/rpc',
  // 42161: 'https://api.pimlico.io/v1/arbitrum/rpc',
  // 8453: 'https://api.pimlico.io/v1/base/rpc',
  // 10: 'https://api.pimlico.io/v1/optimism/rpc',
};

/**
 * Get Circle Paymaster address for a chain
 */
export function getPaymasterAddress(chainId: number): `0x${string}` | undefined {
  return CIRCLE_PAYMASTER_ADDRESSES[chainId];
}

/**
 * Check if Circle Paymaster is available on a chain
 */
export function isPaymasterAvailable(chainId: number): boolean {
  return chainId in CIRCLE_PAYMASTER_ADDRESSES;
}

/**
 * Get Pimlico API key from environment
 */
export function getPimlicoApiKey(): string | undefined {
  return PIMLICO_API_KEY;
}

/**
 * Get bundler endpoint for a chain
 * API key is added via Authorization header in bundler-api.ts
 */
export function getBundlerEndpoint(chainId: number): string | undefined {
  return BUNDLER_ENDPOINTS[chainId];
}

/**
 * Default permit amount for paymaster (10 USDC - enough for many transactions)
 */
export const DEFAULT_PERMIT_AMOUNT = BigInt(10_000_000); // 10 USDC (6 decimals)

/**
 * Circle Smart Account Factory addresses
 * These are used to deploy new smart accounts (generate initCode)
 */
export const CIRCLE_FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
  // Testnet
  421614: '0x5F87540BC61A6c15CCFDC5850f23cB400E83d93B', // Arbitrum Sepolia
  11155111: '0x5F87540BC61A6c15CCFDC5850f23cB400E83d93B', // Ethereum Sepolia
  // Add mainnet addresses when available
  [ARC_CHAIN_ID]: '0x5F87540BC61A6c15CCFDC5850f23cB400E83d93B', // Arc Testnet (use Arbitrum Sepolia factory for now)
};

/**
 * ERC-4337 EntryPoint v0.7 address (standard across all chains)
 */
export const ENTRYPOINT_V07_ADDRESS: `0x${string}` = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

/**
 * Get Circle Factory address for a chain
 */
export function getFactoryAddress(chainId: number): `0x${string}` | undefined {
  return CIRCLE_FACTORY_ADDRESSES[chainId];
}

