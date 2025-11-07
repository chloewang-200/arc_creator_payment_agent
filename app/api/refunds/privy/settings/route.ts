import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PUT /api/refunds/privy/settings - Update creator's refund settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, dailyLimit, enabled } = body;

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId required' },
        { status: 400 }
      );
    }

    // Validate dailyLimit if provided
    if (dailyLimit !== undefined && (dailyLimit < 0 || isNaN(dailyLimit))) {
      return NextResponse.json(
        { error: 'dailyLimit must be a positive number' },
        { status: 400 }
      );
    }

    // Build update object
    const updates: any = {};
    if (dailyLimit !== undefined) {
      updates.refund_daily_limit_usd = dailyLimit;
    }
    if (enabled !== undefined) {
      updates.refund_enabled = enabled;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No settings to update' },
        { status: 400 }
      );
    }

    // Update creator settings
    const { data, error } = await supabase
      .from('creators')
      .update(updates)
      .eq('id', creatorId)
      .select('refund_balance_usd, refund_daily_limit_usd, refund_enabled')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update settings', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: {
        balance: data.refund_balance_usd,
        dailyLimit: data.refund_daily_limit_usd,
        enabled: data.refund_enabled,
      },
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating refund settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
