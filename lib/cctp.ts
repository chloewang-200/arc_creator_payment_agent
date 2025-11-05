// Circle Cross-Chain Transfer Protocol (CCTP) utilities
// CCTP allows USDC to be transferred across chains via burn/mint

import { mainnet, polygon, arbitrum, base, optimism, sepolia } from 'wagmi/chains';
import { ARC_CHAIN_ID } from './config';

// CCTP Token Messenger contract addresses
// These contracts handle the burn/mint process for cross-chain transfers
export const CCTP_TOKEN_MESSENGER: Record<number, `0x${string}`> = {
  [mainnet.id]: '0xbd3fa81b58ba92a82136038b25adec7066af3155' as `0x${string}`,
  [polygon.id]: '0x9daFc8C1D80A0B5F8a7a3D4c3c8F6c8b8a3b8a3b' as `0x${string}`, // Update with actual address
  [arbitrum.id]: '0x19330d10D9Cc8751218eaf51E8885D058843E401' as `0x${string}`,
  [base.id]: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962' as `0x${string}`,
  [optimism.id]: '0x2B4069517953cE0Ef3bC0D0C5aE5aD2C8D6C8a3b' as `0x${string}`, // Update with actual address
  [sepolia.id]: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5' as `0x${string}`,
};

// USDC addresses on different chains
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  [polygon.id]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`,
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as `0x${string}`,
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
  [ARC_CHAIN_ID]: '0x3600000000000000000000000000000000000000' as `0x${string}`, // Arc Testnet USDC
};

// CCTP Message Transmitter addresses (for relaying messages)
export const CCTP_MESSAGE_TRANSMITTER: Record<number, `0x${string}`> = {
  [mainnet.id]: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81' as `0x${string}`,
  [arbitrum.id]: '0xC30362313FBBA5cf9163F0bb16a0e01F01A896ca' as `0x${string}`,
  [base.id]: '0xAD09780d193884d503182aD4588450C416D6F9D4' as `0x${string}`,
  [sepolia.id]: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD' as `0x${string}`,
};

// CCTP ABI for TokenMessenger
export const CCTP_TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint32', name: 'destinationDomain', type: 'uint32' },
      { internalType: 'bytes32', name: 'mintRecipient', type: 'bytes32' },
    ],
    name: 'depositForBurn',
    outputs: [{ internalType: 'uint64', name: '_nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// CCTP ABI for MessageTransmitter (for receiving)
export const CCTP_MESSAGE_TRANSMITTER_ABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'message', type: 'bytes' },
      { internalType: 'bytes', name: 'attestation', type: 'bytes' },
    ],
    name: 'receiveMessage',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Domain IDs for CCTP (used in destinationDomain parameter)
export const CCTP_DOMAIN_IDS: Record<number, number> = {
  [mainnet.id]: 0,      // Ethereum Mainnet
  [arbitrum.id]: 3,     // Arbitrum
  [base.id]: 6,         // Base
  [sepolia.id]: 0,      // Sepolia (same as mainnet for testnet)
  [ARC_CHAIN_ID]: 999,  // Arc (custom domain ID - update with actual)
};

/**
 * Get the destination domain ID for CCTP transfer
 */
export function getDestinationDomain(chainId: number): number {
  return CCTP_DOMAIN_IDS[chainId] ?? 0;
}

/**
 * Check if a chain supports CCTP
 */
export function supportsCCTP(chainId: number): boolean {
  return chainId in CCTP_TOKEN_MESSENGER && chainId in CCTP_DOMAIN_IDS;
}

/**
 * Get USDC address for a chain
 */
export function getUSDCAddress(chainId: number): `0x${string}` | undefined {
  return USDC_ADDRESSES[chainId];
}

/**
 * Get TokenMessenger address for a chain
 */
export function getTokenMessengerAddress(chainId: number): `0x${string}` | undefined {
  return CCTP_TOKEN_MESSENGER[chainId];
}

