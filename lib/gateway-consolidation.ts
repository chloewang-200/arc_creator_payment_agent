import { randomBytes } from 'crypto';
import { pad, type Address, type WalletClient, maxUint256, zeroAddress } from 'viem';
import * as chains from 'viem/chains';
import { ARC_CHAIN_ID } from './config';
import { getGatewayUSDCAddress } from './gateway';

// Gateway contract addresses (same across all networks)
const GATEWAY_WALLET_ADDRESS = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
const GATEWAY_MINTER_ADDRESS = '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B';

// Gateway Wallet ABI (partial - for deposit)
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
        name: 'value',
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

// Domain configs for CCTP Gateway
const DOMAIN_IDS: Record<number, number> = {
  [chains.sepolia.id]: 0,
  [chains.baseSepolia.id]: 6,
  [chains.arbitrumSepolia.id]: 3,
  [chains.optimismSepolia.id]: 2,
  [chains.avalancheFuji.id]: 1,
  // Arc testnet - domain 26 (confirmed from Gateway docs)
  [ARC_CHAIN_ID]: 26,
};

// EIP-712 types for Gateway
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

const domain = { name: 'GatewayWallet', version: '1' };

interface ChainBalance {
  chainId: number;
  balance: bigint; // in USDC smallest unit (6 decimals)
}

function addressToBytes32(address: string): `0x${string}` {
  return pad(address.toLowerCase() as `0x${string}`, { size: 32 });
}

function createBurnIntent(
  sourceChainId: number,
  destinationChainId: number,
  amount: bigint,
  userAddress: Address,
  sourceUSDC: Address,
  destinationUSDC: Address,
) {
  const sourceDomain = DOMAIN_IDS[sourceChainId];
  const destinationDomain = DOMAIN_IDS[destinationChainId];

  if (sourceDomain === undefined || destinationDomain === undefined) {
    throw new Error(`Unsupported chain: ${sourceChainId} or ${destinationChainId}`);
  }

  return {
    maxBlockHeight: maxUint256,
    maxFee: BigInt(1_010000), // 1.01 USDC max fee
    spec: {
      version: 1,
      sourceDomain,
      destinationDomain,
      sourceContract: GATEWAY_WALLET_ADDRESS,
      destinationContract: GATEWAY_MINTER_ADDRESS,
      sourceToken: sourceUSDC,
      destinationToken: destinationUSDC,
      sourceDepositor: userAddress,
      destinationRecipient: userAddress,
      sourceSigner: userAddress,
      destinationCaller: zeroAddress,
      value: amount,
      salt: ('0x' + randomBytes(32).toString('hex')) as `0x${string}`,
      hookData: '0x' as `0x${string}`,
    },
  };
}

function burnIntentTypedData(burnIntent: any) {
  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain,
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
        destinationCaller: addressToBytes32(burnIntent.spec.destinationCaller ?? zeroAddress),
      },
    },
  };
}

export interface ConsolidateToArcParams {
  walletClient: WalletClient;
  userAddress: Address;
  chainBalances: ChainBalance[]; // Balances on chains to consolidate from
}

export async function consolidateToArcWithGateway({
  walletClient,
  userAddress,
  chainBalances,
}: ConsolidateToArcParams) {
  try {
    const destinationUSDC = getGatewayUSDCAddress(ARC_CHAIN_ID);
    if (!destinationUSDC) {
      throw new Error('Arc USDC address not configured');
    }

    // Step 1: Create burn intents for all source chains
    const burnIntents = chainBalances.map(({ chainId, balance }) => {
      const sourceUSDC = getGatewayUSDCAddress(chainId);
      if (!sourceUSDC) {
        throw new Error(`USDC address not found for chain ${chainId}`);
      }

      return createBurnIntent(
        chainId,
        ARC_CHAIN_ID,
        balance,
        userAddress,
        sourceUSDC,
        destinationUSDC,
      );
    });

    // Step 2: Sign all burn intents
    const signedRequests = await Promise.all(
      burnIntents.map(async (burnIntent) => {
        const typedData = burnIntentTypedData(burnIntent);
        const signature = await walletClient.signTypedData(typedData as any);
        return {
          burnIntent: typedData.message,
          signature,
        };
      }),
    );

    // Step 3: Submit to Gateway API
    console.log('Submitting burn intents to Gateway API...', signedRequests);
    const response = await fetch('https://gateway-api-testnet.circle.com/v1/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedRequests, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Gateway API response:', result);

    return {
      success: true,
      attestation: result.attestation,
      signature: result.signature,
    };
  } catch (error) {
    console.error('Gateway consolidation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Gateway Minter ABI (partial - just the gatewayMint function)
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

export { GATEWAY_MINTER_ADDRESS, GATEWAY_WALLET_ADDRESS };
