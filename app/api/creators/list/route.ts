import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/creators/list - Get all creators with their pricing
export async function GET() {
  try {
    const { data: creators, error } = await supabase
      .from('creators')
      .select(`
        *,
        creator_pricing (
          monthly_usd,
          tip_presets_usd,
          recurring_tip_usd,
          refund_conversation_threshold,
          refund_auto_threshold_usd,
          refund_contact_email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to frontend format
    const transformedCreators = (creators || []).map((creator) => ({
      id: creator.id,
      name: creator.name,
      username: creator.username,
      walletAddress: creator.wallet_address,
      bio: creator.bio,
      avatar: creator.avatar_url,
      coverImage: creator.cover_image_url,
      aiTone: creator.ai_tone,
      aiPersonality: creator.ai_personality,
      aiBackground: creator.ai_background,
      hasContent: creator.has_content ?? true, // Use database value or default to true
      pricing: creator.creator_pricing?.[0] ? {
        monthlyUSD: creator.creator_pricing[0].monthly_usd ?? null,
        tipPresetsUSD: creator.creator_pricing[0].tip_presets_usd || [1, 2, 5],
        recurringTipUSD: creator.creator_pricing[0].recurring_tip_usd ?? null,
        refundConversationThreshold: creator.creator_pricing[0].refund_conversation_threshold ?? 3,
        refundAutoThresholdUSD: creator.creator_pricing[0].refund_auto_threshold_usd ?? 1.00,
        refundContactEmail: creator.creator_pricing[0].refund_contact_email ?? null,
      } : {
        monthlyUSD: null,
        tipPresetsUSD: [1, 2, 5],
        recurringTipUSD: 10,
        refundConversationThreshold: 3,
        refundAutoThresholdUSD: 1.00,
        refundContactEmail: null,
      },
      stats: {
        followers: creator.followers || 0,
        totalEarnings: creator.total_earnings || 0,
      },
    }));

    return NextResponse.json({ creators: transformedCreators });
  } catch (error: any) {
    console.error('Error fetching creators:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}
