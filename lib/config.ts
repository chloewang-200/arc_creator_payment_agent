// Arc Network Configuration
export const ARC_CHAIN_ID = 1243; // Arc Testnet (same chain ID)
export const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network';

// Contract addresses (update with deployed addresses)
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const PAYROUTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYROUTER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Creator address (update with actual creator wallet)
export const CREATOR_ADDRESS = (process.env.NEXT_PUBLIC_CREATOR_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// Dynamic/Crossmint config
export const DYNAMIC_ENVIRONMENT_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '';
export const CROSSMINT_API_KEY = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || '';

