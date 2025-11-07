export type Post = {
  id: string;
  title: string;
  intro: string;   // free portion
  body: string;    // locked content
  priceUSD: number; // per-post unlock
  includedInSubscription: true; // always true for MVP
  creatorId: string;
  createdAt: string;
  contentType: 'post' | 'podcast' | 'video' | 'article';
};

export type SitePricing = {
  monthlyUSD: number | null; // e.g., 5, or null if not set
  tipPresetsUSD: number[]; // [1, 2, 5]
  recurringTipUSD?: number | null; // Optional recurring tip amount
  refundConversationThreshold?: number; // Number of conversations required before refund (default: 3)
  refundAutoThresholdUSD?: number; // Amount under which refunds can be auto-processed (default: 1.00)
  refundContactEmail?: string | null; // Email for refunds above threshold
};

export type Entitlements = {
  postsUnlocked: Record<string, boolean>;
  subscriptionActiveUntil?: string; // ISO date
  recurringTips?: Record<string, { amount: number; activeUntil: string }>; // creatorId -> recurring tip info
};

export type Creator = {
  id: string;
  name: string;
  username: string; // URL-friendly
  avatar?: string;
  bio?: string;
  coverImage?: string;
  pricing: SitePricing;
  hasContent: boolean; // false for tip-only creators
  walletAddress?: `0x${string}`; // Creator's wallet address for receiving payments
  refundWalletAddress?: `0x${string}`; // Smart contract wallet for automated refunds
  stats?: {
    followers?: number;
    totalEarnings?: number;
  };
  // AI customization fields
  aiTone?: string; // e.g., "friendly", "professional", "casual", "enthusiastic"
  aiBackground?: string; // Additional context for the AI
  aiPersonality?: string; // Custom personality traits
};

export type PaymentIntent = {
  kind: 'unlock' | 'subscription' | 'tip' | 'recurringTip';
  postId?: string;
  creatorId?: string;
  creatorAddress?: `0x${string}`; // Creator's wallet address for receiving payments
  amountUSD: number;
  title?: string;
};

export type AvatarMessage = {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'avatar' | 'user';
};
