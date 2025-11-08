import { NextRequest, NextResponse } from 'next/server';
import { getCreatorRefundBalance } from '@/lib/circle-refund-wallet';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/refunds/circle/balance?creatorId=xxx
// Returns creator's refund balance and settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId is required' },
        { status: 400 }
      );
    }

    // Get creator settings
    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('refund_balance_usd, refund_daily_limit_usd, refund_enabled')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Get today's refund usage
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyTotal } = await supabaseAdmin
      .from('daily_refund_totals')
      .select('total_refunded_usd')
      .eq('creator_id', creatorId)
      .eq('date', today)
      .maybeSingle();

    return NextResponse.json({
      balance: creator.refund_balance_usd || 0,
      dailyLimit: creator.refund_daily_limit_usd || 100,
      enabled: creator.refund_enabled || false,
      dailyUsed: dailyTotal?.total_refunded_usd || 0,
    });
  } catch (error: any) {
    console.error('Error getting balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balance' },
      { status: 500 }
    );
  }
}
