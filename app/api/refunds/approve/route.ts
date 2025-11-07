import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/refunds/approve - Update refund status after creator approves/rejects transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refundId, transactionHash, status, rejected } = body;

    if (!refundId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: refundId, status' },
        { status: 400 }
      );
    }

    // If rejected, update status to 'rejected'
    if (rejected || status === 'rejected') {
      const { data: updatedRefund, error: updateError } = await supabase
        .from('refunds')
        .update({
          status: 'rejected',
          reason: 'Transaction was rejected by creator',
        })
        .eq('id', refundId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update refund record', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        refund: updatedRefund,
        message: 'Refund request was rejected',
      });
    }

    // If approved, require transaction hash
    if (!transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash required for approved refunds' },
        { status: 400 }
      );
    }

    // Update refund record with transaction hash and status
    const { data: updatedRefund, error: updateError } = await supabase
      .from('refunds')
      .update({
        refund_transaction_hash: transactionHash,
        status: status, // 'processing' or 'completed'
        processed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', refundId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update refund record', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refund: updatedRefund,
    });
  } catch (error: any) {
    console.error('Error updating refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update refund' },
      { status: 500 }
    );
  }
}

