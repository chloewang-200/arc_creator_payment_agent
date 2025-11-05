import type { Entitlements } from '@/types';

const ENTITLEMENTS_KEY = 'arc_entitlements';

export function getEntitlements(): Entitlements {
  if (typeof window === 'undefined') {
    return { postsUnlocked: {} };
  }
  
  const stored = localStorage.getItem(ENTITLEMENTS_KEY);
  if (!stored) {
    return { postsUnlocked: {} };
  }
  
  try {
    return JSON.parse(stored);
  } catch {
    return { postsUnlocked: {} };
  }
}

export function saveEntitlements(entitlements: Entitlements) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(entitlements));
}

export function isPostUnlocked(postId: string, entitlements: Entitlements): boolean {
  return entitlements.postsUnlocked[postId] === true || isSubscriptionActive(entitlements);
}

export function isSubscriptionActive(entitlements: Entitlements): boolean {
  if (!entitlements.subscriptionActiveUntil) return false;
  return new Date(entitlements.subscriptionActiveUntil) > new Date();
}

export function unlockPost(postId: string) {
  const entitlements = getEntitlements();
  entitlements.postsUnlocked[postId] = true;
  saveEntitlements(entitlements);
}

export function activateSubscription(days: number = 30) {
  const entitlements = getEntitlements();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  entitlements.subscriptionActiveUntil = expiryDate.toISOString();
  saveEntitlements(entitlements);
}

export function activateRecurringTip(creatorId: string, amount: number, days: number = 30) {
  const entitlements = getEntitlements();
  if (!entitlements.recurringTips) {
    entitlements.recurringTips = {};
  }
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  entitlements.recurringTips[creatorId] = {
    amount,
    activeUntil: expiryDate.toISOString(),
  };
  saveEntitlements(entitlements);
}

export function isRecurringTipActive(creatorId: string, entitlements: Entitlements): boolean {
  if (!entitlements.recurringTips?.[creatorId]) return false;
  return new Date(entitlements.recurringTips[creatorId].activeUntil) > new Date();
}

