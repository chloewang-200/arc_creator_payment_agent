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
        recurring_tip_usd,
        refund_conversation_threshold,
        refund_auto_threshold_usd,
        refund_contact_email
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
      refundWalletAddress: data.refund_wallet_address,
      refundWalletChainId: data.refund_wallet_chain_id,
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
      voiceSampleUrl: data.voice_sample_url,
      voiceSampleDurationSeconds: data.voice_sample_duration_seconds,
      voicePreviewEnabled: data.voice_preview_enabled ?? false,
      voiceCloneStatus: data.voice_clone_status || 'missing',
      elevenLabsVoiceId: data.elevenlabs_voice_id,
    };

    const pricing = data.creator_pricing?.[0] ? {
      monthlyUSD: data.creator_pricing[0].monthly_usd ?? null, // Use null instead of 0 for empty values
      tipPresetsUSD: data.creator_pricing[0].tip_presets_usd || [1, 2, 5],
      recurringTipUSD: data.creator_pricing[0].recurring_tip_usd ?? null,
      refundConversationThreshold: data.creator_pricing[0].refund_conversation_threshold ?? 3,
      refundAutoThresholdUSD: data.creator_pricing[0].refund_auto_threshold_usd ?? 1.00,
      refundContactEmail: data.creator_pricing[0].refund_contact_email ?? null,
    } : {
      monthlyUSD: null,
      tipPresetsUSD: [1, 2, 5],
      recurringTipUSD: 10,
      refundConversationThreshold: 3,
      refundAutoThresholdUSD: 1.00,
      refundContactEmail: null,
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
      creatorId,
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
      refundWalletAddress,
      refundWalletChainId,
      voiceSampleUrl,
      voiceSampleDurationSeconds,
      voicePreviewEnabled,
      voiceCloneStatus,
      elevenLabsVoiceId,
    } = body;

    // Support updating by creatorId OR email+username+name
    if (creatorId) {
      // Update existing creator by ID (for refund wallet address updates)
      const updateData: any = {};
      if (refundWalletAddress !== undefined) updateData.refund_wallet_address = refundWalletAddress;
      if (refundWalletChainId !== undefined) updateData.refund_wallet_chain_id = refundWalletChainId;
      if (walletAddress !== undefined) updateData.wallet_address = walletAddress;
      if (username !== undefined) updateData.username = username;
      if (name !== undefined) updateData.name = name;
      if (bio !== undefined) updateData.bio = bio;
      if (avatar !== undefined) updateData.avatar_url = avatar;
      if (coverImage !== undefined) updateData.cover_image_url = coverImage;
      if (aiTone !== undefined) updateData.ai_tone = aiTone;
      if (aiPersonality !== undefined) updateData.ai_personality = aiPersonality;
      if (aiBackground !== undefined) updateData.ai_background = aiBackground;
      if (voiceSampleUrl !== undefined) updateData.voice_sample_url = voiceSampleUrl;
      if (voiceSampleDurationSeconds !== undefined) updateData.voice_sample_duration_seconds = voiceSampleDurationSeconds;
      if (voicePreviewEnabled !== undefined) updateData.voice_preview_enabled = voicePreviewEnabled;
      if (voiceCloneStatus !== undefined) updateData.voice_clone_status = voiceCloneStatus;
      if (elevenLabsVoiceId !== undefined) updateData.elevenlabs_voice_id = elevenLabsVoiceId;

      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .update(updateData)
        .eq('id', creatorId)
        .select()
        .single();

      if (creatorError) throw creatorError;

      return NextResponse.json({
        success: true,
        creator: {
          id: creator.id,
          walletAddress: creator.wallet_address,
          refundWalletAddress: creator.refund_wallet_address,
          username: creator.username,
          name: creator.name,
        },
      });
    }

    if (!email || !username || !name) {
      return NextResponse.json(
        { error: 'email, username, and name are required (or creatorId for updates)' },
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
        refund_wallet_address: refundWalletAddress,
        refund_wallet_chain_id: refundWalletChainId,
        voice_sample_url: voiceSampleUrl,
        voice_sample_duration_seconds: voiceSampleDurationSeconds,
        voice_preview_enabled: voicePreviewEnabled,
        voice_clone_status: voiceCloneStatus,
        elevenlabs_voice_id: elevenLabsVoiceId,
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
          monthly_usd: pricing.monthlyUSD ?? null, // Use null instead of default 5
          tip_presets_usd: pricing.tipPresetsUSD || [1, 2, 5],
          recurring_tip_usd: pricing.recurringTipUSD ?? null,
          refund_conversation_threshold: pricing.refundConversationThreshold ?? 3,
          refund_auto_threshold_usd: pricing.refundAutoThresholdUSD ?? 1.00,
          refund_contact_email: pricing.refundContactEmail ?? null,
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
