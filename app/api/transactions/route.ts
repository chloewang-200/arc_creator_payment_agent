import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, formatUnits } from 'viem';
import { PAYROUTER_ADDRESS, ARC_CHAIN_ID, ARC_RPC_URL, USDC_DECIMALS } from '@/lib/config';
import { PAYROUTER_ABI } from '@/lib/contracts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Transaction {
  id: string;
  type: 'unlock' | 'subscription' | 'recurringTip' | 'tip';
  transactionHash: string | null;
  amount?: number;
  createdAt: string;
  postId?: string;
  postTitle?: string;
  creatorId?: string;
  walletAddress: string;
  chainId?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress');
    const creatorId = searchParams.get('creatorId');
    const includeBlockchain = searchParams.get('includeBlockchain') === 'true'; // Optional: query blockchain too

    if (!walletAddress && !creatorId) {
      return NextResponse.json({ error: 'Wallet address or creator ID required' }, { status: 400 });
    }

    const transactions: Transaction[] = [];

    // Fetch post unlocks
    // First, if filtering by creatorId, get all post IDs for that creator
    let postIds: string[] | null = null;
    if (creatorId) {
      const { data: creatorPosts, error: postsError } = await supabase
        .from('posts')
        .select('id')
        .eq('creator_id', creatorId);

      if (creatorPosts && creatorPosts.length > 0) {
        postIds = creatorPosts.map(p => p.id);
      } else {
        // Creator has no posts, so no unlocks
        postIds = [];
      }
    }

    let unlockQuery = supabase
      .from('post_unlocks')
      .select(`
        id,
        post_id,
        transaction_hash,
        unlocked_at,
        wallet_address,
        chain_id,
        posts(id, title, price_usd, creator_id)
      `)
      .order('unlocked_at', { ascending: false });

    // For creator dashboard: filter by creatorId (through posts)
    // For user view: filter by walletAddress (buyer's wallet)
    // Don't filter by walletAddress if we're querying by creatorId - that's the creator's wallet, not the buyer's!
    if (creatorId && postIds !== null) {
      if (postIds.length === 0) {
        // No posts for this creator, so no unlocks
        unlockQuery = unlockQuery.eq('post_id', '00000000-0000-0000-0000-000000000000'); // Impossible ID to return 0 results
      } else {
        unlockQuery = unlockQuery.in('post_id', postIds);
      }
    } else if (walletAddress) {
      // Only filter by walletAddress if NOT filtering by creatorId
      // This is for user view (showing their own purchases)
      unlockQuery = unlockQuery.eq('wallet_address', walletAddress.toLowerCase());
    }

    const { data: unlocks, error: unlocksError } = await unlockQuery;

    if (!unlocksError && unlocks) {
      for (const unlock of unlocks) {
        const post = unlock.posts as any;
        transactions.push({
          id: unlock.id,
          type: 'unlock',
          transactionHash: unlock.transaction_hash,
          amount: post?.price_usd || 0,
          createdAt: unlock.unlocked_at,
          postId: unlock.post_id,
          postTitle: post?.title,
          creatorId: post?.creator_id,
          walletAddress: unlock.wallet_address,
          chainId: unlock.chain_id || 5042002, // Default to Arc Testnet if not specified
        });
      }
    }

    // Fetch subscriptions
    // For subscriptions: walletAddress is the buyer, creatorId is the creator receiving payment
    let subscriptionQuery = supabase
      .from('subscriptions')
      .select('id, creator_id, transaction_hash, active_until, wallet_address')
      .order('active_until', { ascending: false });

    // If both provided, prioritize creatorId (creator dashboard view)
    if (creatorId) {
      subscriptionQuery = subscriptionQuery.eq('creator_id', creatorId);
    } else if (walletAddress) {
      // Only filter by walletAddress if NOT filtering by creatorId (user view)
      subscriptionQuery = subscriptionQuery.eq('wallet_address', walletAddress.toLowerCase());
    }

    const { data: subscriptions, error: subscriptionsError } = await subscriptionQuery;

    if (!subscriptionsError && subscriptions) {
      for (const sub of subscriptions) {
        // Get creator pricing to determine subscription amount
        const { data: pricing } = await supabase
          .from('creator_pricing')
          .select('monthly_usd')
          .eq('creator_id', sub.creator_id)
          .single();

        transactions.push({
          id: sub.id,
          type: 'subscription',
          transactionHash: sub.transaction_hash,
          amount: pricing?.monthly_usd || 0,
          createdAt: sub.active_until, // Use active_until as created date proxy
          creatorId: sub.creator_id,
          walletAddress: sub.wallet_address,
        });
      }
    }

    // Fetch recurring tips
    // For recurring tips: walletAddress is the buyer, creatorId is the creator receiving payment
    let recurringTipQuery = supabase
      .from('recurring_tips')
      .select('id, creator_id, transaction_hash, active_until, wallet_address, amount_usd')
      .order('active_until', { ascending: false });

    // If both provided, prioritize creatorId (creator dashboard view)
    if (creatorId) {
      recurringTipQuery = recurringTipQuery.eq('creator_id', creatorId);
    } else if (walletAddress) {
      // Only filter by walletAddress if NOT filtering by creatorId (user view)
      recurringTipQuery = recurringTipQuery.eq('wallet_address', walletAddress.toLowerCase());
    }

    const { data: recurringTips, error: recurringTipsError } = await recurringTipQuery;

    if (!recurringTipsError && recurringTips) {
      for (const tip of recurringTips) {
        transactions.push({
          id: tip.id,
          type: 'recurringTip',
          transactionHash: tip.transaction_hash,
          amount: tip.amount_usd || 0,
          createdAt: tip.active_until, // Use active_until as created date proxy
          creatorId: tip.creator_id,
          walletAddress: tip.wallet_address,
        });
      }
    }

    // Optionally query blockchain for PayRouter Payment events
    // This catches any transactions that might have been missed in database logging
    if (includeBlockchain && PAYROUTER_ADDRESS && PAYROUTER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      try {
        const publicClient = createPublicClient({
          chain: {
            id: ARC_CHAIN_ID,
            name: 'Arc Testnet',
            network: 'arc-testnet',
            nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
            rpcUrls: { default: { http: [ARC_RPC_URL] } },
          },
          transport: http(ARC_RPC_URL),
        });

        // Query Payment events from PayRouter
        // Filter by creator address if provided, or by buyer if walletAddress provided
        const filterAddress = creatorId 
          ? undefined // Will need to query all and filter by creator
          : walletAddress?.toLowerCase();

        const fromBlock = BigInt(0); // From genesis (or use a recent block for performance)
        const toBlock = 'latest';

        // Use the Payment event from PAYROUTER_ABI
        const paymentEvent = PAYROUTER_ABI.find(
          (item: any) => item.type === 'event' && item.name === 'Payment'
        );

        if (!paymentEvent) {
          throw new Error('Payment event not found in ABI');
        }

        const logs = await publicClient.getLogs({
          address: PAYROUTER_ADDRESS,
          event: paymentEvent as any,
          args: filterAddress ? {
            buyer: filterAddress as `0x${string}`,
          } : undefined,
          fromBlock,
          toBlock: toBlock as any,
        });

        // Convert blockchain events to transaction format
        // Only add if not already in database (avoid duplicates)
        const existingTxHashes = new Set(transactions.map(t => t.transactionHash?.toLowerCase()));

        for (const log of logs) {
          if (log.transactionHash && !existingTxHashes.has(log.transactionHash.toLowerCase())) {
            const args = (log as any).args || {};
            const amount = args.amount ? parseFloat(formatUnits(args.amount, USDC_DECIMALS)) : 0;
            
            // Only include if matches our filter
            if (creatorId) {
              // Would need to check if creator address matches creatorId
              // For now, skip if filtering by creatorId (would need creator wallet mapping)
              continue;
            }

            transactions.push({
              id: log.transactionHash, // Use tx hash as ID for blockchain-only transactions
              type: 'unlock', // Default - could decode SKU to determine type
              transactionHash: log.transactionHash,
              amount,
              createdAt: new Date(Number(log.blockNumber) * 12000).toISOString(), // Approximate timestamp
              walletAddress: args.buyer?.toLowerCase() || '',
              creatorId: undefined, // Would need mapping from creator address to creatorId
            });
          }
        }
      } catch (blockchainError: any) {
        console.error('Error querying blockchain for transactions:', blockchainError);
        // Don't fail - just log error and return database results
      }
    }

    // Sort all transactions by date (newest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ 
      transactions,
      source: includeBlockchain ? 'database_and_blockchain' : 'database'
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

