// /app/api/payin/route.js
import { NextResponse } from 'next/server';

const BASES = {
  sandbox: {
    auth: 'https://sandbox-auth.swichnow.com/connect/token',
    api: 'https://sandbox-api.swichnow.com',
  },
  production: {
    auth: 'https://auth.swichnow.com/connect/token',
    api: 'https://api.swichnow.com',
  },
};

// Helper: fetch bearer token (x-www-form-urlencoded) – required by /connect/token
async function fetchToken({ env = 'sandbox', clientId, clientSecret }) {
  const base = BASES[env] ?? BASES.sandbox;

  const cid = process.env.NEXT_PUBLIC_CLIENT_ID || clientId;
  const csec = process.env.NEXT_PUBLIC_CLIENT_SECRET || clientSecret;
  if (!cid || !csec) {
    return { ok: false, status: 400, data: { error: 'missing_credentials', message: 'client_id/client_secret required' } };
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', cid);
  body.append('client_secret', csec);

  const res = await fetch(base.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function validateMsisdn(msisdn) {
  return typeof msisdn === 'string' && /^03\d{9}$/.test(msisdn);
}

export async function POST(req) {
  try {
    const {
      op = 'purchase',          // "token" | "purchase"
      env = 'sandbox',          // "sandbox" | "production"
      purchaseType = 'ewallet', // "ewallet" | "biller"
      clientId,                 // optional; if omitted, .env is used
      clientSecret,             // optional; if omitted, .env is used
      token,                    // optional pre-fetched token
      payload = {},             // payin payload
    } = await req.json();

    const base = BASES[env] ?? BASES.sandbox;

    // 1) Token path (server-side)
    if (op === 'token') {
      const tok = await fetchToken({ env, clientId, clientSecret });
      return NextResponse.json(tok.data, { status: tok.status || (tok.ok ? 200 : 400) });
    }

    // 2) Purchase path (server-side)
    // Obtain token if one wasn't provided
    let accessToken = token;
    if (!accessToken) {
      const tok = await fetchToken({ env, clientId, clientSecret });
      if (!tok.ok) {
        return NextResponse.json({ error: 'token_error', details: tok.data }, { status: tok.status || 400 });
      }
      accessToken = tok.data?.access_token;
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'no_token', message: 'Could not obtain access token' }, { status: 401 });
    }

    // Basic client-side validations before hitting Swich
    const { customerTransactionId, item, amount, channelId, categoryId, msisdn, email } = payload;

    if (!customerTransactionId) {
      return NextResponse.json({ error: 'validation', message: 'customerTransactionId is required' }, { status: 400 });
    }
    if (!item) {
      return NextResponse.json({ error: 'validation', message: 'item is required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: 'validation', message: 'amount must be a number' }, { status: 400 });
    }
    if (!channelId && channelId !== 0) {
      return NextResponse.json({ error: 'validation', message: 'channelId is required' }, { status: 400 });
    }
    if (purchaseType === 'ewallet' && (categoryId === undefined || categoryId === null || categoryId === '')) {
      return NextResponse.json({ error: 'validation', message: 'categoryId is required for E‑Wallet' }, { status: 400 });
    }
    if (!validateMsisdn(msisdn)) {
      return NextResponse.json({ error: 'validation', message: 'msisdn must be 11 digits and start with 03 (e.g., 03001234567)' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'validation', message: 'email is required' }, { status: 400 });
    }

    // Decide endpoint
    let endpoint = '';
    if (purchaseType === 'ewallet') {
      endpoint = '/gateway/payin/purchase/ewallet'; // E‑Wallet purchase :contentReference[oaicite:0]{index=0}
    } else if (purchaseType === 'biller') {
      endpoint = '/gateway/payin/purchase/biller';  // Biller (1Bill) purchase :contentReference[oaicite:1]{index=1}
    } else {
      return NextResponse.json({ error: 'unsupported_purchaseType' }, { status: 400 });
    }

    // Build the outgoing payload (strip undefined)
    const out = {
      customerTransactionId,
      item,
      amount,
      msisdn,
      email,
      channelId: Number(channelId),
      ...(categoryId !== undefined ? { categoryId: Number(categoryId) } : {}),
    };

    const payinRes = await fetch(`${base.api}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(out),
      cache: 'no-store',
    });

    const data = await payinRes.json().catch(() => ({}));
    // Return raw Swich response + HTTP status we saw from Swich
    return NextResponse.json(
      { statusCode: payinRes.status, data },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', message: err?.message || String(err) }, { status: 500 });
  }
}
