import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// PUT /api/refunds/circle/settings
// Update creator's refund settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, dailyLimit, enabled } = body;

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId is required' },
        { status: 400 }
      );
    }

    console.log('[Settings] Updating for creator:', creatorId, {
      dailyLimit,
      enabled,
    });

    // Update creator settings
    const { error } = await supabaseAdmin
      .from('creators')
      .update({
        refund_daily_limit_usd: dailyLimit || 100,
        refund_enabled: enabled !== undefined ? enabled : false,
      })
      .eq('id', creatorId);

    if (error) {
      console.error('[Settings] Update failed:', error);
      throw error;
    }

    console.log('[Settings] Update successful');

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    console.error('[Settings] Error updating settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
