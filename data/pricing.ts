import type { SitePricing } from '@/types';

export const defaultPricing: SitePricing = {
  monthlyUSD: 5,
  tipPresetsUSD: [1, 2, 5],
  recurringTipUSD: 10, // Default recurring tip for all creators
};

