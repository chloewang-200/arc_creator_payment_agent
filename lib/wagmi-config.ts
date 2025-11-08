import { createConfig, http } from 'wagmi';
import {
  sepolia,
  baseSepolia,
} from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { ARC_CHAIN_ID, ARC_RPC_URL } from './config';

// Arc chain definition using viem's defineChain for proper typing
export const arcChain = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 6, // USDC uses 6 decimals
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true, // Mark as testnet
});

// Sei Testnet chain definition
const seiTestnet = defineChain({
  id: 1328,
  name: 'Sei Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'SEI',
    symbol: 'SEI',
  },
  rpcUrls: {
    default: {
      http: ['https://evm-rpc-testnet.sei-apis.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'SeiTrace',
      url: 'https://seitrace.com',
    },
  },
  testnet: true,
});

// Supported chains for multi-chain payments
export const supportedChains = [
  arcChain,      // Arc Testnet
  sepolia,       // Ethereum Sepolia (testnet)
  baseSepolia,   // Base Sepolia (testnet)
  seiTestnet,    // Sei Testnet
] as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    metaMask(), // Direct Metamask connector
  ],
  transports: {
    [ARC_CHAIN_ID]: http(ARC_RPC_URL, {
      batch: {
        wait: 100, // Wait 100ms to batch requests together
      },
      retryCount: 3,
      retryDelay: 1000, // Start with 1 second delay
      timeout: 10000, // 10 second timeout
    }),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [seiTestnet.id]: http('https://evm-rpc-testnet.sei-apis.com'),
  },
  pollingInterval: 8000, // Poll every 8 seconds instead of default 4 seconds
});
