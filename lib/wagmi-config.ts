import { createConfig, http } from 'wagmi';
import { mainnet, polygon, arbitrum, base, optimism, sepolia } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';
import { ARC_CHAIN_ID, ARC_RPC_URL } from './config';

// Arc chain definition
const arcChain = {
  id: ARC_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.arc.network',
    },
  },
} as const;

// Supported chains for multi-chain payments
export const supportedChains = [
  arcChain,      // Arc (destination)
  mainnet,       // Ethereum Mainnet
  polygon,       // Polygon
  arbitrum,      // Arbitrum One
  base,          // Base
  optimism,      // Optimism
  sepolia,       // Ethereum Sepolia (testnet)
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
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [sepolia.id]: http(),
  },
  pollingInterval: 8000, // Poll every 8 seconds instead of default 4 seconds
});

