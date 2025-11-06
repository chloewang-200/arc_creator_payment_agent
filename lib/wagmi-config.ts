import { createConfig, http } from 'wagmi';
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
import { metaMask } from 'wagmi/connectors';
import { ARC_CHAIN_ID, ARC_RPC_URL } from './config';

// Arc chain definition
const arcChain = {
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
} as const;

// Sei Testnet chain definition
const seiTestnet = {
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
} as const;

// Supported chains for multi-chain payments
export const supportedChains = [
  arcChain,      // Arc (destination)
  // Mainnet
  mainnet,       // Ethereum Mainnet
  polygon,       // Polygon
  arbitrum,      // Arbitrum One
  base,          // Base
  optimism,      // Optimism
  // Testnet
  sepolia,       // Ethereum Sepolia (testnet)
  baseSepolia,   // Base Sepolia (testnet)
  arbitrumSepolia, // Arbitrum Sepolia (testnet)
  optimismSepolia, // Optimism Sepolia (testnet)
  polygonAmoy,   // Polygon Amoy (testnet)
  avalancheFuji, // Avalanche Fuji (testnet)
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
    // Mainnet
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    // Testnet
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [polygonAmoy.id]: http(),
    [avalancheFuji.id]: http(),
    [seiTestnet.id]: http('https://evm-rpc-testnet.sei-apis.com'),
  },
  pollingInterval: 8000, // Poll every 8 seconds instead of default 4 seconds
});

