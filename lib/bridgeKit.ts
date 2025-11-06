// Bridge Kit wrapper using Ethers adapter (browser wallet / MetaMask)
import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-ethers-v6';

// Map EVM chainId to Bridge Kit chain keys
const CHAIN_ID_TO_BK: Record<number, string> = {
  11155111: 'Ethereum_Sepolia',
  84532: 'Base_Sepolia',
  421614: 'Arbitrum_Sepolia',
  5042002: 'Arc_Testnet',
};

export type BridgeParams = {
  fromChainId: number;
  toChainId: number;
  amountUSD: string;
  recipientAddress?: string;
};

export async function bridgeUSDCWithBridgeKit({
  fromChainId,
  toChainId,
  amountUSD,
  recipientAddress,
}: BridgeParams): Promise<{ success: boolean; steps?: any; error?: string }> {
  try {
    const from = CHAIN_ID_TO_BK[fromChainId];
    const to = CHAIN_ID_TO_BK[toChainId];
    if (!from || !to) return { success: false, error: `Unsupported chain(s): from ${fromChainId} to ${toChainId}` };

    const provider = (globalThis as any).ethereum;
    if (!provider) return { success: false, error: 'No injected wallet provider found (MetaMask not detected).' };

    const adapter = await createAdapterFromProvider({ provider });
    const kit = new BridgeKit();
    const bridgeInput: any = {
      from: { adapter, chain: from },
      to: { adapter, chain: to },
      amount: amountUSD,
    };
    if (recipientAddress) bridgeInput.recipient = recipientAddress;

    const result = await kit.bridge(bridgeInput);
    const steps = (result as any)?.steps || [];
    // Consider the bridge successful ONLY if all steps report state === 'success'
    const allSuccess =
      Array.isArray(steps) &&
      steps.length > 0 &&
      steps.every((s: any) => s?.state === 'success');
    return { success: allSuccess, steps };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}


