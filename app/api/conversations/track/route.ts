import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/conversations/track - Track a conversation between user and creator
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, userWalletAddress } = body;

    if (!creatorId || !userWalletAddress) {
      return NextResponse.json(
        { error: 'Missing creatorId or userWalletAddress' },
        { status: 400 }
      );
    }

    // First, get current count
    const { data: existing } = await supabase
      .from('user_conversations')
      .select('conversation_count')
      .eq('creator_id', creatorId)
      .eq('user_wallet_address', userWalletAddress.toLowerCase())
      .single();

    const newCount = (existing?.conversation_count || 0) + 1;

    // Upsert conversation count
    const { data, error } = await supabase
      .from('user_conversations')
      .upsert({
        creator_id: creatorId,
        user_wallet_address: userWalletAddress.toLowerCase(),
        conversation_count: newCount,
        last_conversation_at: new Date().toISOString(),
      }, {
        onConflict: 'creator_id,user_wallet_address',
      })
      .select()
      .single();

    if (error) {
      // If upsert fails, try insert
      const { data: insertData, error: insertError } = await supabase
        .from('user_conversations')
        .insert({
          creator_id: creatorId,
          user_wallet_address: userWalletAddress.toLowerCase(),
          conversation_count: 1,
          last_conversation_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({ conversation: insertData });
    }

    return NextResponse.json({ conversation: data });
  } catch (error: any) {
    console.error('Error tracking conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to track conversation' },
      { status: 500 }
    );
  }
}

// GET /api/conversations/track - Get conversation count
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creatorId = searchParams.get('creatorId');
    const userWalletAddress = searchParams.get('userWalletAddress');

    if (!creatorId || !userWalletAddress) {
      return NextResponse.json(
        { error: 'Missing creatorId or userWalletAddress' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('user_conversations')
      .select('conversation_count')
      .eq('creator_id', creatorId)
      .eq('user_wallet_address', userWalletAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return NextResponse.json({
      conversationCount: data?.conversation_count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching conversation count:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversation count' },
      { status: 500 }
    );
  }
}

