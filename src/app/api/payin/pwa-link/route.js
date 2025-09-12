// /app/api/payin/pwa-link/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import crypto from 'crypto';

function hmac(secret, plain) {
  return crypto.createHmac('sha256', secret).update(plain).digest('hex');
}

export async function POST(req) {
  try {
    const {
      env = 'sandbox',
      clientid,
      customertransactionid,
      item,
      amount,                  // number or string
      payeename,
      email,
      msisdn,
      currency = 'PKR',
      transactionType,         // required for QR/RTP only
      billReferenceNo,         // required for Bank payments
      successRedirectUrl,      // success only, optional
      description,             // optional (defaults to item)
      channel = '0',           // per doc default
    } = await req.json();

    // Basic validation required by the PWA (per docs)
    if (!clientid || !customertransactionid || !item || amount == null || !payeename || !email || !msisdn) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // Use the MERCHANT "SecretKey" (not OAuth client_secret!)
    const secret = "5E9DC6C2D45F69A2";
    if (!secret) {
      return NextResponse.json({ error: 'missing_secret', message: 'Set SWICH_SECRET_KEY in .env.local' }, { status: 500 });
    }

    // The PWA tends to expect a string amount with 2 decimals.
    const amountStr = Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : String(amount);

    // Compute checksum EXACTLY on the strings you will send.
    // Formula: Swich:customer_transaction_id:item:amount  (HMAC-SHA256 with SecretKey)
    const plain = `Swich:${customertransactionid}:${item}:${amountStr}`;

       console.log('--- PWA checksum debug ---');
    console.log('customertransactionid:', customertransactionid);
    console.log('item:', item);
    console.log('amountStr:', amountStr);
    console.log('plain string:', plain);
    console.log('--------------------------');

    const checksum = hmac(secret, plain);

    const base =
      env === 'production'
        ? 'https://payin-pwa.swichnow.com'
        : 'https://sandbox-payin-pwa.swichnow.com';

    // Build query string. Include BOTH casings where the PDF is inconsistent.
    const qs = new URLSearchParams();

    // Always lower-case keys that are unambiguous
    qs.set('clientid', clientid);
    qs.set('item', item);
    qs.set('amount', amountStr);
    qs.set('channel', String(channel));
    qs.set('description', description || item);
    qs.set('currency', currency);
    qs.set('checksum', checksum);

    // Duplicated keys with case variants (to satisfy the PWA parser in all environments)
    qs.set('customertransactionid', customertransactionid);
    qs.set('customerTransactionid', customertransactionid);

    qs.set('payeename', payeename);
    qs.set('PayeeName', payeename);

    qs.set('email', email);
    qs.set('Email', email);

    qs.set('msisdn', msisdn);
    qs.set('MSISDN', msisdn);

    // Conditionals from the doc
    if (transactionType) qs.set('transactionType', transactionType);
    if (billReferenceNo) qs.set('billReferenceNo', billReferenceNo);
    if (successRedirectUrl) qs.set('successRedirectUrl', successRedirectUrl);

    const url = `${base}?${qs.toString()}`;
    return NextResponse.json({ url, checksum, plain });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', message: err.message }, { status: 500 });
  }
}
