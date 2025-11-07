import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/refunds/privy/balance - Get creator's refund balance and settings
export async function GET(request: NextRequest) {
  try {
    const creatorId = request.nextUrl.searchParams.get('creatorId');

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId required' },
        { status: 400 }
      );
    }

    // Get creator's refund settings
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('refund_balance_usd, refund_daily_limit_usd, refund_enabled')
      .eq('id', creatorId)
      .single();

    if (creatorError) {
      return NextResponse.json(
        { error: 'Creator not found', details: creatorError.message },
        { status: 404 }
      );
    }

    // Get today's refund usage
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyTotal } = await supabase
      .from('daily_refund_totals')
      .select('total_refunded_usd')
      .eq('creator_id', creatorId)
      .eq('date', today)
      .single();

    return NextResponse.json({
      balance: creator.refund_balance_usd || 0,
      dailyLimit: creator.refund_daily_limit_usd || 100,
      enabled: creator.refund_enabled || false,
      dailyUsed: dailyTotal?.total_refunded_usd || 0,
    });
  } catch (error: any) {
    console.error('Error fetching refund balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
