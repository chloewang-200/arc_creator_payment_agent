import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/creators/profile?wallet=0x... or ?username=alex-creator or ?email=user@example.com or ?id=uuid
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const username = request.nextUrl.searchParams.get('username');
  const email = request.nextUrl.searchParams.get('email');
  const id = request.nextUrl.searchParams.get('id');

  if (!wallet && !username && !email && !id) {
    return NextResponse.json(
      { error: 'wallet, username, email, or id parameter required' },
      { status: 400 }
    );
  }

  try {
    let query = supabase.from('creators').select(`
      *,
      creator_pricing (
        monthly_usd,
        tip_presets_usd,
        recurring_tip_usd
      )
    `);

    if (id) {
      query = query.eq('id', id);
    } else if (wallet) {
      query = query.eq('wallet_address', wallet);
    } else if (username) {
      query = query.eq('username', username);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
      }
      throw error;
    }

    // Transform to match frontend format
    const creator = {
      id: data.id,
      name: data.name,
      username: data.username,
      walletAddress: data.wallet_address,
      bio: data.bio,
      avatar: data.avatar_url,
      coverImage: data.cover_image_url,
      hasContent: data.has_content ?? true,
      aiTone: data.ai_tone,
      aiPersonality: data.ai_personality,
      aiBackground: data.ai_background,
      stats: {
        followers: data.followers || 0,
        totalEarnings: data.total_earnings || 0,
      },
    };

    const pricing = data.creator_pricing?.[0] ? {
      monthlyUSD: data.creator_pricing[0].monthly_usd || 0,
      tipPresetsUSD: data.creator_pricing[0].tip_presets_usd || [1, 2, 5],
      recurringTipUSD: data.creator_pricing[0].recurring_tip_usd || 10,
    } : {
      monthlyUSD: 0,
      tipPresetsUSD: [1, 2, 5],
      recurringTipUSD: 10,
    };

    return NextResponse.json({ creator, pricing });
  } catch (error: any) {
    console.error('Error fetching creator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch creator' },
      { status: 500 }
    );
  }
}

// PUT /api/creators/profile - Create or update creator profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      walletAddress,
      username,
      name,
      bio,
      avatar,
      coverImage,
      aiTone,
      aiPersonality,
      aiBackground,
      pricing,
    } = body;

    if (!email || !username || !name) {
      return NextResponse.json(
        { error: 'email, username, and name are required' },
        { status: 400 }
      );
    }

    // Upsert creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .upsert({
        email,
        wallet_address: walletAddress,
        username,
        name,
        bio,
        avatar_url: avatar,
        cover_image_url: coverImage,
        ai_tone: aiTone,
        ai_personality: aiPersonality,
        ai_background: aiBackground,
      }, {
        onConflict: 'email',
      })
      .select()
      .single();

    if (creatorError) throw creatorError;

    // Upsert pricing if provided
    if (pricing && creator) {
      const { error: pricingError } = await supabase
        .from('creator_pricing')
        .upsert({
          creator_id: creator.id,
          monthly_usd: pricing.monthlyUSD || 5,
          tip_presets_usd: pricing.tipPresetsUSD || [1, 2, 5],
          recurring_tip_usd: pricing.recurringTipUSD,
        }, {
          onConflict: 'creator_id',
        });

      if (pricingError) throw pricingError;
    }

    return NextResponse.json({
      success: true,
      creator: {
        id: creator.id,
        walletAddress: creator.wallet_address,
        username: creator.username,
        name: creator.name,
      },
    });
  } catch (error: any) {
    console.error('Error updating creator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update creator' },
      { status: 500 }
    );
  }
}
