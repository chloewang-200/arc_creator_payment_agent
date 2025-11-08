import { NextRequest, NextResponse } from 'next/server';
import {
  getCreatorCircleWallet,
  initializeCreatorCircleWallet,
} from '@/lib/circle-refund-wallet';

// GET /api/refunds/circle/wallet?creatorId=xyz
// Returns the creator's Circle wallet address
export async function GET(request: NextRequest) {
  try {
    const creatorId = request.nextUrl.searchParams.get('creatorId');
    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId is required' },
        { status: 400 }
      );
    }

    const wallet = await getCreatorCircleWallet(creatorId);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Circle wallet not initialized', initialized: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      initialized: true,
      ...wallet,
    });
  } catch (error: any) {
    console.error('Error getting creator wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get Circle wallet' },
      { status: 500 }
    );
  }
}

// POST /api/refunds/circle/wallet
// Initialize the creator's wallet (one-time setup)
export async function POST(request: NextRequest) {
  try {
    const { creatorId } = await request.json();

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId is required' },
        { status: 400 }
      );
    }

    const result = await initializeCreatorCircleWallet(creatorId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      initialized: true,
      walletSetId: result.walletSetId,
      walletId: result.walletId,
      address: result.address,
      chain: result.chain,
    });
  } catch (error: any) {
    console.error('Error initializing creator wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize Circle wallet' },
      { status: 500 }
    );
  }
}
