// EIP-2612 Permit signing utility for Circle Paymaster
// Allows paymaster to spend USDC on behalf of smart accounts

import { maxUint256, parseErc6492Signature, type Address, type TypedData, type WalletClient } from 'viem';
import { getContract, type PublicClient, type Account } from 'viem';
import { erc20Abi } from 'viem';

// Extended ERC20 ABI with permit support
export const eip2612Abi = [
  ...erc20Abi,
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
    name: 'nonces',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface PermitData {
  types: {
    EIP712Domain: Array<{ name: string; type: string }>;
    Permit: Array<{ name: string; type: string }>;
  };
  primaryType: 'Permit';
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  message: {
    owner: string;
    spender: string;
    value: string;
    nonce: string;
    deadline: string;
  };
}

/**
 * Build EIP-2612 permit data for signing
 */
export async function eip2612Permit({
  token,
  chain,
  ownerAddress,
  spenderAddress,
  value,
}: {
  token: ReturnType<typeof getContract>;
  chain: { id: number };
  ownerAddress: Address;
  spenderAddress: Address;
  value: bigint;
}): Promise<PermitData> {
  const [name, version, nonce] = await Promise.all([
    token.read.name(),
    token.read.version(),
    token.read.nonces([ownerAddress]),
  ]);

  return {
    types: {
      // Required for compatibility with Circle PW Sign Typed Data API
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    domain: {
      name,
      version,
      chainId: chain.id,
      verifyingContract: token.address,
    },
    message: {
      // Convert bigint fields to string to match EIP-712 JSON schema expectations
      owner: ownerAddress,
      spender: spenderAddress,
      value: value.toString(),
      nonce: nonce.toString(),
      // The paymaster cannot access block.timestamp due to 4337 opcode
      // restrictions, so the deadline must be MAX_UINT256.
      deadline: maxUint256.toString(),
    },
  };
}

/**
 * Sign EIP-2612 permit for USDC to allow paymaster to spend
 *
 * Uses wallet's signTypedData - works with MetaMask, WalletConnect, etc.
 * NO private key needed - wallet prompts user to sign.
 */
export async function signPermit({
  tokenAddress,
  client,
  ownerAddress,
  spenderAddress,
  permitAmount,
  walletClient,
}: {
  tokenAddress: Address;
  client: PublicClient;
  ownerAddress: Address;
  spenderAddress: Address;
  permitAmount: bigint;
  walletClient: WalletClient;
}): Promise<`0x${string}`> {
  const token = getContract({
    client,
    address: tokenAddress,
    abi: eip2612Abi,
  });

  const permitData = await eip2612Permit({
    token,
    chain: client.chain!,
    ownerAddress,
    spenderAddress,
    value: permitAmount,
  });

  // Use wallet's signTypedData - MetaMask will prompt user
  const wrappedPermitSignature = await walletClient.signTypedData({
    account: ownerAddress,
    ...permitData,
  });

  // Verify the signature
  const isValid = await client.verifyTypedData({
    ...permitData,
    address: ownerAddress,
    signature: wrappedPermitSignature,
  });

  if (!isValid) {
    throw new Error(
      `Invalid permit signature for ${ownerAddress}: ${wrappedPermitSignature}`,
    );
  }

  const { signature } = parseErc6492Signature(wrappedPermitSignature);
  return signature;
}

