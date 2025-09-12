// /app/api/payin/pwa-debug/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import crypto from 'crypto';

function hmac(secret, plain) {
  return crypto.createHmac('sha256', secret).update(plain).digest('hex');
}

// GET /api/payin/pwa-debug?customertransactionid=...&item=...&amount=...&checksum=...
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const customertransactionid = searchParams.get('customertransactionid') || searchParams.get('customerTransactionid');
    const item = searchParams.get('item');
    const amount = searchParams.get('amount');
    const provided = (searchParams.get('checksum') || '').toLowerCase();

    if (!customertransactionid || !item || !amount || !provided) {
      return NextResponse.json(
        { error: 'missing params', need: ['customertransactionid', 'item', 'amount', 'checksum'] },
        { status: 400 }
      );
    }

    const secret = process.env.SWICH_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'missing SWICH_SECRET_KEY in env' }, { status: 500 });
    }

    // Compute exactly from the URL values (no reformatting)
    const plain = `Swich:${customertransactionid}:${item}:${amount}`;
    const expected = hmac(secret, plain).toLowerCase();

    return NextResponse.json({
      inputs: { customertransactionid, item, amount },
      plain,
      expectedChecksum: expected,
      providedChecksum: provided,
      matches: expected === provided,
    });
  } catch (e) {
    return NextResponse.json({ error: 'unexpected', message: e.message }, { status: 500 });
  }
}
