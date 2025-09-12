// /app/api/payin/inquire/route.js
export const runtime = 'nodejs';
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

async function fetchToken({ env = 'sandbox', clientId, clientSecret }) {
  const base = BASES[env] ?? BASES.sandbox;
  const cid = process.env.NEXT_PUBLIC_CLIENT_ID || clientId;
  const csec = process.env.NEXT_PUBLIC_CLIENT_SECRET || clientSecret;
  if (!cid || !csec) {
    return { ok: false, status: 400, data: { error: 'missing_credentials' } };
  }

  const form = new URLSearchParams();
  form.set('grant_type', 'client_credentials');
  form.set('client_id', cid);
  form.set('client_secret', csec);

  const r = await fetch(base.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const env = url.searchParams.get('env') || 'sandbox';
    const customerTransactionId = url.searchParams.get('customerTransactionId');
    const clientId = url.searchParams.get('clientId') || undefined;
    const clientSecret = url.searchParams.get('clientSecret') || undefined;

    if (!customerTransactionId) {
      return NextResponse.json({ error: 'validation', message: 'customerTransactionId is required' }, { status: 400 });
    }

    const base = BASES[env] ?? BASES.sandbox;
    const tok = await fetchToken({ env, clientId, clientSecret });
    if (!tok.ok) {
      return NextResponse.json({ error: 'token_error', details: tok.data }, { status: tok.status || 400 });
    }
    const accessToken = tok.data?.access_token;

    const r = await fetch(
      `${base.api}/gateway/payin/inquire?CustomerTransactionId=${encodeURIComponent(customerTransactionId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json({ statusCode: r.status, data }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'unexpected', message: e.message }, { status: 500 });
  }
}
