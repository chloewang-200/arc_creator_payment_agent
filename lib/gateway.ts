// Circle Gateway utilities for unified USDC balance transfers
// Gateway allows instant cross-chain transfers using burn intents and attestations
// Reference: https://developers.circle.com/gateway

import { mainnet, polygon, arbitrum, base, optimism, sepolia } from 'wagmi/chains';
import { ARC_CHAIN_ID, USDC_DECIMALS } from './config';
import { pad, maxUint256, zeroAddress, parseUnits, getAddress, type Address, type Hex } from 'viem';
import { USDC_ABI } from './contracts';

// Gateway contract addresses (same across all networks)
export const GATEWAY_WALLET_ADDRESS = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`;
export const GATEWAY_MINTER_ADDRESS = '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B' as `0x${string}`;

// Gateway API endpoints
export const GATEWAY_API_TESTNET = 'https://gateway-api-testnet.circle.com/v1/transfer';
export const GATEWAY_API_MAINNET = 'https://gateway-api.circle.com/v1/transfer';

// Domain IDs for Gateway (different from CCTP domain IDs)
// Using explicit chain IDs to ensure they're always available
export const GATEWAY_DOMAIN_IDS: Record<number, number> = {
  // Mainnet chains
  1: 0,                  // Ethereum Mainnet
  11155111: 0,          // Ethereum Sepolia (domain 0)
  // L2s
  42161: 3,              // Arbitrum One
  8453: 6,               // Base Mainnet
  137: 7,                // Polygon PoS
  10: 2,                 // Optimism
  // Testnets
  421614: 3,             // Arbitrum Sepolia
  84532: 6,              // Base Sepolia
  11155420: 2,           // OP Sepolia
  1328: 16,              // Sei Atlantic/Testnet (domain 16)
  // Arc Network
  5042002: 26,          // Arc Testnet (domain 26)
};

// Gateway gas fees per source chain (in USDC)
// Reference: https://developers.circle.com/gateway/references/fees
export const GATEWAY_GAS_FEES: Record<number, number> = {
  // Mainnet chains
  1: 2.00,               // Ethereum Mainnet
  11155111: 2.00,       // Ethereum Sepolia
  // L2s
  42161: 0.01,           // Arbitrum One
  8453: 0.01,            // Base Mainnet
  137: 0.0015,           // Polygon PoS
  10: 0.0015,            // Optimism
  // Testnets
  421614: 0.01,          // Arbitrum Sepolia
  84532: 0.01,           // Base Sepolia
  11155420: 0.0015,      // OP Sepolia
  1328: 0.001,           // Sei Atlantic/Testnet
  // Arc Network
  5042002: 0,            // Arc Testnet (no fee, already on destination)
};

// USDC addresses on different chains (for Gateway)
export const GATEWAY_USDC_ADDRESSES: Record<number, `0x${string}`> = {
  // Mainnet chains
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`, // Ethereum Sepolia
  // L2s
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`, // Arbitrum One
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, // Base Mainnet
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`, // Polygon PoS
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as `0x${string}`, // Optimism
  // Testnets
  421614: '0x75FAf114EafB1bDBE2f0316DF893FD58cE87AaF7' as `0x${string}`, // Arbitrum Sepolia
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`, // Base Sepolia
  11155420: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' as `0x${string}`, // OP Sepolia
  1328: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED' as `0x${string}`, // Sei Atlantic/Testnet
  // Arc Network
  5042002: '0x3600000000000000000000000000000000000000' as `0x${string}`, // Arc Testnet
};

// Gateway Minter ABI
export const GATEWAY_MINTER_ABI = [
  {
    type: 'function',
    name: 'gatewayMint',
    inputs: [
      {
        name: 'attestationPayload',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// Gateway Wallet ABI (for depositing to unified balance)
export const GATEWAY_WALLET_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
] as const;

export interface BurnIntent {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: {
    version: number;
    sourceDomain: number;
    destinationDomain: number;
    sourceContract: `0x${string}`;
    destinationContract: `0x${string}`;
    sourceToken: `0x${string}`;
    destinationToken: `0x${string}`;
    sourceDepositor: `0x${string}`;
    destinationRecipient: `0x${string}`;
    sourceSigner: `0x${string}`;
    destinationCaller: `0x${string}`;
    value: bigint;
    salt: `0x${string}`;
    hookData: `0x${string}`;
  };
}

export interface BurnIntentRequest {
  burnIntent: any; // Can be BurnIntent or the typed data message format
  signature: `0x${string}`;
}

/**
 * Get Gateway domain ID for a chain
 */
export function getGatewayDomain(chainId: number): number | undefined {
  const domain = GATEWAY_DOMAIN_IDS[chainId];
  if (domain === undefined) {
    console.error(`Gateway domain not found for chain ID: ${chainId}. Available chains:`, Object.keys(GATEWAY_DOMAIN_IDS));
  }
  return domain;
}

/**
 * Get USDC address for Gateway on a chain
 */
export function getGatewayUSDCAddress(chainId: number): `0x${string}` | undefined {
  return GATEWAY_USDC_ADDRESSES[chainId];
}

/**
 * Get Gateway gas fee for a source chain (in USDC)
 */
export function getGatewayGasFee(chainId: number): number {
  return GATEWAY_GAS_FEES[chainId] ?? 2.00; // Default to Ethereum fee if not found
}

/**
 * Check if a chain supports Gateway
 */
export function supportsGateway(chainId: number): boolean {
  const hasDomain = chainId in GATEWAY_DOMAIN_IDS;
  const hasUSDC = chainId in GATEWAY_USDC_ADDRESSES;
  const usdcAddress = GATEWAY_USDC_ADDRESSES[chainId];
  // USDC address must exist and not be zero address
  const validUSDC = usdcAddress && usdcAddress !== '0x0000000000000000000000000000000000000000';
  return hasDomain && hasUSDC && validUSDC;
}

/**
 * Check if Gateway transfer is available (source chain supports Gateway and is not Arc)
 */
export function isGatewayTransferAvailable(chainId: number): boolean {
  return supportsGateway(chainId) && chainId !== ARC_CHAIN_ID;
}

/**
 * Convert address to bytes32 for Gateway
 */
function addressToBytes32(address: Address): `0x${string}` {
  return pad(address.toLowerCase() as `0x${string}`, { size: 32 });
}

/**
 * Create EIP-712 typed data for burn intent signing
 */
export function createBurnIntentTypedData(burnIntent: BurnIntent) {
  const EIP712Domain = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
  ];

  const TransferSpec = [
    { name: 'version', type: 'uint32' },
    { name: 'sourceDomain', type: 'uint32' },
    { name: 'destinationDomain', type: 'uint32' },
    { name: 'sourceContract', type: 'bytes32' },
    { name: 'destinationContract', type: 'bytes32' },
    { name: 'sourceToken', type: 'bytes32' },
    { name: 'destinationToken', type: 'bytes32' },
    { name: 'sourceDepositor', type: 'bytes32' },
    { name: 'destinationRecipient', type: 'bytes32' },
    { name: 'sourceSigner', type: 'bytes32' },
    { name: 'destinationCaller', type: 'bytes32' },
    { name: 'value', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
    { name: 'hookData', type: 'bytes' },
  ];

  const BurnIntent = [
    { name: 'maxBlockHeight', type: 'uint256' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'spec', type: 'TransferSpec' },
  ];

  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain: { name: 'GatewayWallet', version: '1' },
    primaryType: 'BurnIntent' as const,
    message: {
      ...burnIntent,
      spec: {
        ...burnIntent.spec,
        sourceContract: addressToBytes32(burnIntent.spec.sourceContract),
        destinationContract: addressToBytes32(burnIntent.spec.destinationContract),
        sourceToken: addressToBytes32(burnIntent.spec.sourceToken),
        destinationToken: addressToBytes32(burnIntent.spec.destinationToken),
        sourceDepositor: addressToBytes32(burnIntent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(burnIntent.spec.destinationRecipient),
        sourceSigner: addressToBytes32(burnIntent.spec.sourceSigner),
        destinationCaller: addressToBytes32(burnIntent.spec.destinationCaller),
      },
    },
  };
}

/**
 * Create a burn intent for Gateway transfer
 */
export function createBurnIntent({
  sourceChainId,
  destinationChainId,
  sourceToken,
  destinationToken,
  sourceDepositor,
  destinationRecipient,
  sourceSigner,
  value,
  maxFee = BigInt(2100000), // Default max fee (2.1 USDC with 6 decimals) - Gateway requires at least 2.000014
}: {
  sourceChainId: number;
  destinationChainId: number;
  sourceToken: `0x${string}`;
  destinationToken: `0x${string}`;
  sourceDepositor: `0x${string}`;
  destinationRecipient: `0x${string}`;
  sourceSigner: `0x${string}`;
  value: bigint;
  maxFee?: bigint;
}): BurnIntent {
  const sourceDomain = getGatewayDomain(sourceChainId);
  const destinationDomain = getGatewayDomain(destinationChainId);

  // Note: domain 0 is valid (Ethereum), so we check for undefined/null explicitly
  if (sourceDomain === undefined || sourceDomain === null || destinationDomain === undefined || destinationDomain === null) {
    throw new Error(`Unsupported chain: source ${sourceChainId} (domain: ${sourceDomain}) or destination ${destinationChainId} (domain: ${destinationDomain})`);
  }

  // Generate random salt (32 bytes)
  const saltBytes = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser: use Web Crypto API
    window.crypto.getRandomValues(saltBytes);
  } else {
    // Node.js: use crypto module
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(32);
    saltBytes.set(randomBytes);
  }
  const salt = `0x${Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

  return {
    maxBlockHeight: maxUint256,
    maxFee,
    spec: {
      version: 1,
      sourceDomain,
      destinationDomain,
      sourceContract: GATEWAY_WALLET_ADDRESS,
      destinationContract: GATEWAY_MINTER_ADDRESS,
      sourceToken,
      destinationToken,
      sourceDepositor,
      destinationRecipient,
      sourceSigner,
      destinationCaller: zeroAddress,
      value,
      salt,
      hookData: '0x' as `0x${string}`,
    },
  };
}

/**
 * Submit burn intents to Gateway API and get attestation
 */
export async function submitBurnIntentsToGateway(
  requests: BurnIntentRequest[],
  isTestnet: boolean = true
): Promise<{ attestation: `0x${string}`; signature: `0x${string}` }> {
  const apiUrl = isTestnet ? GATEWAY_API_TESTNET : GATEWAY_API_MAINNET;

  // Format the request - convert BigInt values to strings and ensure proper format
  const formattedRequests = requests.map(({ burnIntent, signature }) => {
    // Convert BigInt values to strings for JSON serialization
    const formatBurnIntent = (bi: any): any => {
      if (typeof bi === 'bigint') {
        return bi.toString();
      }
      if (typeof bi === 'object' && bi !== null) {
        if (Array.isArray(bi)) {
          return bi.map(formatBurnIntent);
        }
        const formatted: any = {};
        for (const [key, value] of Object.entries(bi)) {
          formatted[key] = formatBurnIntent(value);
        }
        return formatted;
      }
      return bi;
    };

    return {
      burnIntent: formatBurnIntent(burnIntent),
      signature,
    };
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formattedRequests),
  });

  if (!response.ok) {
    let errorMessage = `Gateway API error: ${response.status} ${response.statusText}`;
    try {
      const errorText = await response.text();
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error?.message || errorData.message || errorMessage;
      console.error('Gateway API error details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        request: formattedRequests,
      });
    } catch (e) {
      const errorText = await response.text().catch(() => '');
      console.error('Gateway API error (non-JSON):', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        request: formattedRequests,
      });
    }
    throw new Error(errorMessage);
  }

  const json = await response.json();
  return {
    attestation: json.attestation as `0x${string}`,
    signature: json.signature as `0x${string}`,
  };
}

/**
 * Transfer USDC from source chain to Arc Network using Circle Gateway
 * This is used for consolidation (creators consolidating their balances)
 */
export interface GatewayTransferResult {
  success: boolean;
  txHash?: `0x${string}`;
  attestation?: `0x${string}`;
  gatewaySignature?: `0x${string}`;
  error?: string;
}

export async function transferUSDCViaGateway({
  sourceChainId,
  amountUSD,
  recipientAddress,
  walletClient,
  publicClient,
  sourceAddress, // Optional: if provided, use this address instead of walletClient.account.address
}: {
  sourceChainId: number;
  amountUSD: number;
  recipientAddress: Address;
  walletClient: any; // WalletClient from wagmi
  publicClient: any; // PublicClient from wagmi
  sourceAddress?: Address; // Optional: address to check balance and use as sourceDepositor
}): Promise<GatewayTransferResult> {
  try {
    // Check if Gateway is supported
    if (!supportsGateway(sourceChainId)) {
      return {
        success: false,
        error: `Gateway not supported on chain ${sourceChainId}`,
      };
    }

    const destinationChainId = ARC_CHAIN_ID;
    const destinationDomain = getGatewayDomain(destinationChainId);
    if (!destinationDomain) {
      return {
        success: false,
        error: `Arc Network (domain 26) not supported as destination`,
      };
    }

    const sourceUSDC = getGatewayUSDCAddress(sourceChainId);
    const destinationUSDC = getGatewayUSDCAddress(destinationChainId);

    if (!sourceUSDC || !destinationUSDC) {
      return {
        success: false,
        error: 'USDC address not found for source or destination chain',
      };
    }

    if (!walletClient.account) {
      return {
        success: false,
        error: 'Wallet account not available',
      };
    }

    const amount = parseUnits(amountUSD.toFixed(6), USDC_DECIMALS);
    // Use sourceAddress if provided (for consolidation from creator's wallet), otherwise use connected wallet
    const userAddress = sourceAddress || walletClient.account.address;
    
    // If sourceAddress is provided (consolidation), ensure the connected wallet matches
    if (sourceAddress && walletClient.account.address.toLowerCase() !== sourceAddress.toLowerCase()) {
      return {
        success: false,
        error: `Connected wallet (${walletClient.account.address}) does not match creator address (${sourceAddress}). Please connect the creator's wallet to consolidate.`,
      };
    }

    // 1. Check USDC balance in regular wallet
    const balance = await publicClient.readContract({
      address: sourceUSDC,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    });

    const balanceUSD = Number(balance) / 10 ** USDC_DECIMALS;
    
    // 2. Check Gateway Wallet balance (Gateway requires USDC to be deposited first)
    // Note: Gateway Wallet might not be deployed on all chains, so we handle errors gracefully
    let gatewayBalanceUSD = 0;
    let gatewayWalletAvailable = false;
    try {
      const gatewayBalance = await publicClient.readContract({
        address: GATEWAY_WALLET_ADDRESS,
        abi: GATEWAY_WALLET_ABI,
        functionName: 'balanceOf',
        args: [sourceUSDC, userAddress],
      });
      gatewayBalanceUSD = Number(gatewayBalance) / 10 ** USDC_DECIMALS;
      gatewayWalletAvailable = true;
    } catch (error) {
      // Gateway Wallet might not be deployed on this chain, or balanceOf might not be available
      // In this case, we'll skip the deposit check and proceed directly
      // Gateway API will handle the balance check
      console.warn(`Could not check Gateway Wallet balance on chain ${sourceChainId}:`, error);
      console.warn('Proceeding without Gateway Wallet deposit - Gateway API will handle balance verification');
      // Set to 0 and skip deposit step
      gatewayBalanceUSD = 0;
      gatewayWalletAvailable = false;
    }
    
    // Get chain-specific Gateway gas fee
    const gasFee = getGatewayGasFee(sourceChainId);
    // Add buffer for transfer fee and to meet Gateway's minimum requirements
    // Gateway may require slightly more than the base fee, so we add a small buffer
    const transferFee = 0.0005; // Increased buffer to ensure we meet Gateway's minimum requirements
    const totalFee = gasFee + transferFee;
    
    // Deduct fee from transfer amount (fee comes out of the transfer, not in addition)
    const netTransferAmount = amountUSD - totalFee;
    
    if (netTransferAmount <= 0) {
      return {
        success: false,
        error: `Transfer amount (${amountUSD} USDC) is too small. After Gateway fee (${totalFee.toFixed(4)} USDC), you would transfer ${netTransferAmount.toFixed(6)} USDC. Please increase the transfer amount.`,
      };
    }
    
    // Check if balance is sufficient for the original amount (fee will be deducted from it)
    if (balanceUSD < amountUSD) {
      return {
        success: false,
        error: `Insufficient USDC balance. Need ${amountUSD} USDC, have ${balanceUSD.toFixed(6)}`,
      };
    }
    
    // Ensure balance can cover the fee (balance must be >= amount, and amount must be > fee)
    if (amountUSD <= totalFee) {
      return {
        success: false,
        error: `Transfer amount must be greater than Gateway fee (${totalFee.toFixed(4)} USDC). Current amount: ${amountUSD} USDC.`,
      };
    }
    
    // 3. Deposit USDC into Gateway Wallet if needed
    // Gateway requires USDC to be in Gateway Wallet contract, even if we can't check the balance
    // If balance check failed, we'll attempt deposit anyway (it will fail gracefully if contract doesn't exist)
    const needsDeposit = !gatewayWalletAvailable || gatewayBalanceUSD < amountUSD;
    
    if (needsDeposit) {
      const depositAmount = parseUnits(amountUSD.toFixed(6), USDC_DECIMALS);
      
      try {
        // First, approve USDC spending for Gateway Wallet
        const allowance = await publicClient.readContract({
          address: sourceUSDC,
          abi: USDC_ABI,
          functionName: 'allowance',
          args: [userAddress, GATEWAY_WALLET_ADDRESS],
        });
        
        if (allowance < depositAmount) {
          // Approve USDC spending
          const approveHash = await walletClient.writeContract({
            address: sourceUSDC,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [GATEWAY_WALLET_ADDRESS, maxUint256],
            account: walletClient.account,
          });
          
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          console.log('✅ Approved USDC spending for Gateway Wallet');
        }
        
        // Deposit USDC into Gateway Wallet
        const depositHash = await walletClient.writeContract({
          address: GATEWAY_WALLET_ADDRESS,
          abi: GATEWAY_WALLET_ABI,
          functionName: 'deposit',
          args: [sourceUSDC, depositAmount],
          account: walletClient.account,
        });
        
        await publicClient.waitForTransactionReceipt({ hash: depositHash });
        console.log(`✅ Deposited ${amountUSD} USDC into Gateway Wallet`);
      } catch (depositError) {
        // If deposit fails (e.g., Gateway Wallet not deployed), Gateway might work differently
        // Let Gateway API handle the error
        console.warn('Could not deposit to Gateway Wallet, proceeding anyway:', depositError);
        // Continue - Gateway API will return an error if deposit is actually required
      }
    }

    // 4. Create burn intent with chain-specific max fee
    // The fee will be deducted from the transfer amount by Gateway
    // Gateway requires slightly more than the base fee, so we add a small buffer
    // For Base Sepolia, Gateway requires at least 0.0105, so we ensure we meet that
    const maxFeeAmount = Math.max(gasFee + transferFee, gasFee * 1.05); // Add 5% buffer or use transferFee, whichever is higher
    const maxFee = parseUnits(maxFeeAmount.toFixed(6), USDC_DECIMALS);
    
    // Use the net transfer amount (after fee deduction) for the burn intent value
    const netAmount = parseUnits(netTransferAmount.toFixed(6), USDC_DECIMALS);
    
    const burnIntent = createBurnIntent({
      sourceChainId,
      destinationChainId,
      sourceToken: sourceUSDC,
      destinationToken: destinationUSDC,
      sourceDepositor: userAddress,
      destinationRecipient: recipientAddress,
      sourceSigner: userAddress,
      value: netAmount, // Transfer net amount (after fee deduction)
      maxFee,
    });

    // 3. Create typed data and sign
    const typedData = createBurnIntentTypedData(burnIntent);
    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      ...typedData,
    });

    // 4. Submit to Gateway API
    // The API expects the typed data message (with bytes32 addresses), not the raw burnIntent
    const { attestation, signature: gatewaySignature } = await submitBurnIntentsToGateway([
      {
        burnIntent: typedData.message, // Use the typed data message format
        signature,
      },
    ], true); // Use testnet API

    // 5. Return attestation and signature - caller will switch to Arc and call gatewayMint
    // Gateway requires minting on the destination chain, so we return the data for the caller to handle
    return {
      success: true,
      attestation,
      gatewaySignature,
      // Note: Caller must switch to Arc Network and call gatewayMint with these values
    } as GatewayTransferResult;
  } catch (error: any) {
    console.error('Gateway transfer error:', error);
    return {
      success: false,
      error: error.message || 'Gateway transfer failed',
    };
  }
}

