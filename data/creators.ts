import type { Creator } from '@/types';
import { defaultPricing } from './pricing';

export const creators: Creator[] = [
  {
    id: 'creator1',
    name: 'Alex Creator',
    username: 'alex-creator',
    avatar: '/images/avatars/creator1.jpg',
    bio: 'Web3 enthusiast and blockchain developer sharing insights on decentralized payments and creator economies.',
    pricing: defaultPricing,
    hasContent: true,
    stats: {
      followers: 1240,
      totalEarnings: 5420,
    },
    // AI Customization
    aiTone: 'friendly and casual',
    aiPersonality: 'tech-savvy, helpful, curious about web3',
    aiBackground: 'I write deep technical posts about blockchain and decentralized systems. My audience loves actionable code examples and tutorials.',
  },
  {
    id: 'creator2',
    name: 'Sarah Designer',
    username: 'sarah-designer',
    avatar: '/images/avatars/creator2.jpg',
    bio: 'I am a digital artist and NFT creator. Really appreciate your support in helping me create more content! 🎨',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [5, 10, 25, 50],
      recurringTipUSD: 10,
    },
    hasContent: false, // Tip-only creator
    stats: {
      followers: 890,
      totalEarnings: 3200,
    },
  },
  {
    id: 'creator3',
    name: 'Tech Podcast',
    username: 'tech-podcast',
    avatar: '/images/avatars/creator3.jpg',
    bio: 'Weekly deep dives into crypto, DeFi, and blockchain technology.',
    pricing: {
      monthlyUSD: 8,
      tipPresetsUSD: [2, 5, 10],
      recurringTipUSD: 10,
    },
    hasContent: true,
    stats: {
      followers: 2100,
      totalEarnings: 8900,
    },
    // AI Customization
    aiTone: 'professional and informative',
    aiPersonality: 'analytical, clear, focused on education',
    aiBackground: 'I create weekly podcast episodes breaking down complex crypto topics. My subscribers value clear explanations and staying updated on industry trends.',
  },
  {
    id: 'creator4',
    name: 'Mark Musician',
    username: 'mark-music',
    avatar: '/images/avatars/creator4.jpg',
    bio: 'Independent musician creating original compositions. Support helps me keep making music! 🎵',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [3, 5, 10, 20],
      recurringTipUSD: 15,
    },
    hasContent: false,
    stats: {
      followers: 1560,
      totalEarnings: 4200,
    },
  },
  {
    id: 'creator5',
    name: 'James Writer',
    username: 'james-writes',
    avatar: '/images/avatars/creator5.jpg',
    bio: 'Freelance writer and storyteller. Tips help me focus on creating more content! ✍️',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [2, 5, 10, 25],
      recurringTipUSD: 12,
    },
    hasContent: false,
    stats: {
      followers: 980,
      totalEarnings: 2800,
    },
  },
  {
    id: 'creator6',
    name: 'Lucas Artist',
    username: 'lucas-art',
    avatar: '/images/avatars/creator6.jpg',
    bio: 'Digital illustrator and concept artist. Every tip helps me continue creating! 🎨',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [5, 10, 25, 50],
      recurringTipUSD: 20,
    },
    hasContent: false,
    stats: {
      followers: 2340,
      totalEarnings: 6700,
    },
  },
  {
    id: 'creator7',
    name: 'River Streamer',
    username: 'river-streams',
    avatar: '/images/avatars/creator7.jpg',
    bio: 'Gaming content creator and streamer. Tips help support my streaming setup! 🎮',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [1, 3, 5, 10],
      recurringTipUSD: 8,
    },
    hasContent: false,
    stats: {
      followers: 3200,
      totalEarnings: 5100,
    },
  },
  {
    id: 'creator8',
    name: 'Zoe Photographer',
    username: 'zoe-photos',
    avatar: '/images/avatars/creator8.jpg',
    bio: 'Travel and portrait photographer. Tips help fund my next adventure! 📸',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [5, 15, 30, 50],
      recurringTipUSD: 25,
    },
    hasContent: false,
    stats: {
      followers: 1890,
      totalEarnings: 3800,
    },
  },
  {
    id: 'creator9',
    name: 'Sam Developer',
    username: 'sam-dev',
    avatar: '/images/avatars/creator9.jpg',
    bio: 'Open source developer building free tools. Support keeps the projects going! 💻',
    pricing: {
      monthlyUSD: 0,
      tipPresetsUSD: [2, 5, 10, 20],
      recurringTipUSD: 10,
    },
    hasContent: false,
    stats: {
      followers: 2750,
      totalEarnings: 7200,
    },
  },
];
