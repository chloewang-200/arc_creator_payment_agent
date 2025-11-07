// Hook for managing Circle smart wallets and paymaster
// This allows users to pay gas fees in USDC instead of native tokens
// Uses wallet signatures (signTypedData) - NO private keys needed!

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { encodePacked, encodeFunctionData, concat, type Address, type Hex } from 'viem';
// import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
// Note: This package is not installed. The useSmartWallet hook is not currently being used.
// If needed in the future, install: npm install @circle-fin/modular-wallets-core
import { signPermit } from './permit';
import { getPaymasterAddress, isPaymasterAvailable, DEFAULT_PERMIT_AMOUNT, getBundlerEndpoint, getFactoryAddress, ENTRYPOINT_V07_ADDRESS } from './paymaster-config';
import { getGatewayUSDCAddress } from './gateway';

export interface SmartWalletState {
  account: any | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  smartAccountAddress: Address | null;
}

// ABI for Circle Smart Account Factory
const FACTORY_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' }
    ],
    name: 'createAccount',
    outputs: [{ name: 'account', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' }
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface PaymasterData {
  paymaster: `0x${string}`;
  paymasterData: `0x${string}`;
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
  isFinal: boolean;
}

/**
 * Hook to manage Circle smart wallet with paymaster
 * 
 * Uses the connected wallet (MetaMask, etc.) to sign permits and user operations.
 * NO private keys needed - everything is signed via wallet's signTypedData.
 */
export function useSmartWallet() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [state, setState] = useState<SmartWalletState>({
    account: null,
    isInitialized: false,
    isLoading: false,
    error: null,
    smartAccountAddress: null,
  });

  const paymasterAddress = getPaymasterAddress(chainId);
  const usdcAddress = getGatewayUSDCAddress(chainId);
  const factoryAddress = getFactoryAddress(chainId);
  const isAvailable = isPaymasterAvailable(chainId) && !!paymasterAddress && !!usdcAddress && !!factoryAddress;

  /**
   * Get smart account address (counterfactual - works even if not deployed)
   */
  const getSmartAccountAddress = useCallback(async (): Promise<Address | null> => {
    if (!eoaAddress || !factoryAddress || !publicClient) {
      return null;
    }

    try {
      // Use salt = 0 for the first smart account
      const salt = BigInt(0);

      const address = await publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'getAddress',
        args: [eoaAddress, salt],
      });

      return address;
    } catch (error) {
      console.error('Failed to get smart account address:', error);
      return null;
    }
  }, [eoaAddress, factoryAddress, publicClient]);

  /**
   * Check if smart account is deployed
   */
  const isAccountDeployed = useCallback(async (address: Address): Promise<boolean> => {
    if (!publicClient) return false;

    try {
      const code = await publicClient.getBytecode({ address });
      return !!code && code !== '0x';
    } catch (error) {
      console.error('Failed to check if account is deployed:', error);
      return false;
    }
  }, [publicClient]);

  /**
   * Generate initCode for deploying smart account
   * Returns '0x' if account is already deployed
   */
  const getInitCode = useCallback(async (): Promise<Hex> => {
    if (!eoaAddress || !factoryAddress || !publicClient) {
      return '0x';
    }

    try {
      const smartAccountAddress = await getSmartAccountAddress();
      if (!smartAccountAddress) {
        return '0x';
      }

      // Check if already deployed
      const deployed = await isAccountDeployed(smartAccountAddress);
      if (deployed) {
        return '0x';
      }

      // Generate factory call data
      const salt = BigInt(0);
      const callData = encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: 'createAccount',
        args: [eoaAddress, salt],
      });

      // initCode = factory address + factory calldata
      return concat([factoryAddress, callData]);
    } catch (error) {
      console.error('Failed to generate initCode:', error);
      return '0x';
    }
  }, [eoaAddress, factoryAddress, publicClient, getSmartAccountAddress, isAccountDeployed]);

  /**
   * Initialize smart wallet from connected EOA wallet
   * Uses walletClient to sign - no private key needed!
   */
  const initializeSmartWallet = useCallback(async () => {
    if (!isConnected || !eoaAddress || !isAvailable || !walletClient || !publicClient) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Create a smart account adapter that uses the connected wallet
      // The walletClient will handle signing via MetaMask/wallet prompts
      // TODO: Install @circle-fin/modular-wallets-core if smart wallets are needed
      // const account = await toCircleSmartAccount({
      //   client: publicClient,
      //   owner: walletClient.account, // Uses connected wallet, not private key
      // });
      
      // For now, return null as this hook is not being used
      const account = null;

      // Get the smart account address
      const smartAccountAddress = await getSmartAccountAddress();

      setState({
        account,
        isInitialized: true,
        isLoading: false,
        error: null,
        smartAccountAddress,
      });
    } catch (error: any) {
      setState({
        account: null,
        isInitialized: false,
        isLoading: false,
        error: error as Error,
        smartAccountAddress: null,
      });
    }
  }, [isConnected, eoaAddress, isAvailable, walletClient, publicClient, getSmartAccountAddress]);

  /**
   * Get paymaster data for user operation
   * Uses wallet's signTypedData to sign the EIP-2612 permit
   */
  const getPaymasterData = useCallback(async () => {
    if (!walletClient || !paymasterAddress || !usdcAddress || !publicClient) {
      return null;
    }

    try {
      // Sign permit using connected wallet (MetaMask will prompt user)
      // This uses walletClient.signTypedData - no private key needed!
      const permitSignature = await signPermit({
        tokenAddress: usdcAddress,
        client: publicClient,
        ownerAddress: walletClient.account.address, // Uses walletClient address, not private key
        spenderAddress: paymasterAddress,
        permitAmount: DEFAULT_PERMIT_AMOUNT,
        walletClient, // Pass walletClient for signing
      });

      const paymasterData = encodePacked(
        ['uint8', 'address', 'uint256', 'bytes'],
        [0, usdcAddress, DEFAULT_PERMIT_AMOUNT, permitSignature],
      );

      return {
        paymaster: paymasterAddress,
        paymasterData,
        paymasterVerificationGasLimit: BigInt(200000),
        paymasterPostOpGasLimit: BigInt(15000),
        isFinal: true,
      } as PaymasterData;
    } catch (error) {
      console.error('Failed to get paymaster data:', error);
      return null;
    }
  }, [walletClient, paymasterAddress, usdcAddress, publicClient]);

  return {
    ...state,
    isAvailable,
    initializeSmartWallet,
    getPaymasterData,
    getInitCode,
    getSmartAccountAddress,
    isAccountDeployed,
    paymasterAddress,
    usdcAddress,
    factoryAddress,
  };
}

/**
 * Utility to check if smart wallet should be used
 * Returns true if:
 * - Paymaster is available on current chain
 * - User might benefit from USDC gas payments
 */
export function shouldUseSmartWallet(chainId: number): boolean {
  return isPaymasterAvailable(chainId);
}

