// Supported chains for multi-chain payments
import {
  sepolia,
  baseSepolia,
} from 'wagmi/chains';
import { ARC_CHAIN_ID } from './config';

// Sei Testnet chain ID
const SEI_TESTNET_ID = 1328;

export const SUPPORTED_CHAINS = [
  sepolia,      // Ethereum Sepolia (testnet)
  baseSepolia,  // Base Sepolia (testnet)
] as const;

// USDC addresses on different chains
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [ARC_CHAIN_ID]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as `0x${string}`, // Arc Testnet
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`, // Ethereum Sepolia
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`, // Base Sepolia
  [SEI_TESTNET_ID]: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED' as `0x${string}`, // Sei Testnet
};

// CCTP Token Messenger addresses (for cross-chain transfers)
export const CCTP_TOKEN_MESSENGER: Record<number, `0x${string}`> = {
  [sepolia.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Ethereum Sepolia
  [baseSepolia.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Base Sepolia
};

// Get USDC address for a chain
export function getUSDCAddress(chainId: number): `0x${string}` | undefined {
  return USDC_ADDRESSES[chainId];
}

// Check if chain supports CCTP
export function supportsCCTP(chainId: number): boolean {
  return chainId in CCTP_TOKEN_MESSENGER;
}

