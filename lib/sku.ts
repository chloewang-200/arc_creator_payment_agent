import { keccak256, stringToBytes } from 'viem';

// SKU encoding helpers
export const skuPost = (postId: string): `0x${string}` => {
  const message = `post:${postId}`;
  return keccak256(stringToBytes(message));
};

export const skuSub = (): `0x${string}` => {
  return keccak256(stringToBytes('sub:monthly'));
};

export const skuTip = (usd: number): `0x${string}` => {
  const message = `tip:${usd.toFixed(2)}`;
  return keccak256(stringToBytes(message));
};

export const skuRecurringTip = (creatorId: string, usd: number): `0x${string}` => {
  const message = `recurringTip:${creatorId}:${usd.toFixed(2)}`;
  return keccak256(stringToBytes(message));
};

