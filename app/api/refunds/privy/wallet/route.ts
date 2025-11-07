import { NextRequest, NextResponse } from 'next/server';
import { getPlatformRefundWallet } from '@/lib/privy-refund-wallet';

// GET /api/refunds/privy/wallet - Get platform refund wallet address
export async function GET(request: NextRequest) {
  try {
    const wallet = await getPlatformRefundWallet();

    if (!wallet) {
      return NextResponse.json(
        { error: 'Platform refund wallet not initialized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      address: wallet.address,
      walletId: wallet.walletId,
    });
  } catch (error: any) {
    console.error('Error fetching platform wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}
