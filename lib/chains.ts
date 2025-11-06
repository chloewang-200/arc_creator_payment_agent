// Supported chains for multi-chain payments
import {
  mainnet,
  polygon,
  arbitrum,
  base,
  optimism,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  avalancheFuji,
} from 'wagmi/chains';

export const SUPPORTED_CHAINS = [
  // Mainnet
  mainnet,      // Ethereum Mainnet
  polygon,      // Polygon
  arbitrum,     // Arbitrum One
  base,         // Base
  optimism,     // Optimism
  // Testnet
  sepolia,      // Ethereum Sepolia (testnet)
  baseSepolia,  // Base Sepolia (testnet)
  arbitrumSepolia, // Arbitrum Sepolia (testnet)
  optimismSepolia, // Optimism Sepolia (testnet)
  polygonAmoy,  // Polygon Amoy (testnet)
  avalancheFuji, // Avalanche Fuji (testnet)
] as const;

// USDC addresses on different chains
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  // Mainnet
  [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`, // Ethereum Mainnet
  [polygon.id]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`, // Polygon
  [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`, // Arbitrum
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, // Base
  [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as `0x${string}`, // Optimism
  // Testnet
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`, // Ethereum Sepolia
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`, // Base Sepolia
  [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as `0x${string}`, // Arbitrum Sepolia
  [optimismSepolia.id]: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' as `0x${string}`, // Optimism Sepolia
  [polygonAmoy.id]: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' as `0x${string}`, // Polygon Amoy
  [avalancheFuji.id]: '0x5425890298aed601595a70AB815c96711a31Bc65' as `0x${string}`, // Avalanche Fuji
};

// CCTP Token Messenger addresses (for cross-chain transfers)
export const CCTP_TOKEN_MESSENGER: Record<number, `0x${string}`> = {
  // Mainnet
  [mainnet.id]: '0xbd3fa81b58ba92a82136038b25adec7066af3155' as `0x${string}`,
  [polygon.id]: '0x9daFc8C1D80A0B5F8a7a3D4c3c8F6c8b8a3b8a3b' as `0x${string}`, // Placeholder - verify address
  [arbitrum.id]: '0x19330d10D9Cc8751218eaf51E8885D058843E401' as `0x${string}`,
  [base.id]: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962' as `0x${string}`,
  [optimism.id]: '0x2B4069517953cE0Ef3bC0D0C5aE5aD2C8D6C8a3b' as `0x${string}`, // Placeholder - verify address
  // Testnet (all use same address per Circle docs)
  [sepolia.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Ethereum Sepolia
  [baseSepolia.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Base Sepolia
  [arbitrumSepolia.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Arbitrum Sepolia
  [optimismSepolia.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Optimism Sepolia
  [polygonAmoy.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Polygon Amoy
  [avalancheFuji.id]: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`, // Avalanche Fuji
};

// Get USDC address for a chain
export function getUSDCAddress(chainId: number): `0x${string}` | undefined {
  return USDC_ADDRESSES[chainId];
}

// Check if chain supports CCTP
export function supportsCCTP(chainId: number): boolean {
  return chainId in CCTP_TOKEN_MESSENGER;
}

