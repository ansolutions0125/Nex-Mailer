// /app/api/payin/callback/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import crypto from "crypto";

function hmac(secret, plain) {
  return crypto.createHmac("sha256", secret).update(plain).digest("hex");
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const PaymentType = searchParams.get("PaymentType") || "";
    const Status = searchParams.get("Status") || ""; // pending | success | failed | ...
    const OrderId = searchParams.get("OrderId") || "";
    const CustomerTransactionId =
      searchParams.get("CustomerTransactionId") || "";
    const Amount = searchParams.get("Amount") || "";
    const Checksum = searchParams.get("Checksum") || "";

    // Build plain string exactly as required by Swich:
    const plain = `SWCallback:${CustomerTransactionId}:${OrderId}:${Amount}:${Status}`;
    const expected = hmac(process.env.SWICH_SECRET_KEY, plain);

    if (!Checksum || Checksum.toLowerCase() !== expected.toLowerCase()) {
      // Signature mismatch — don’t accept; return 200 to avoid infinite retries only if you want to drop it.
      return NextResponse.json(
        { status: "ignored", reason: "bad-signature" },
        { status: 200 }
      );
    }

    // TODO: upsert transaction in your DB by CustomerTransactionId
    // save { status: Status, orderId: OrderId, amount: Amount, paymentType: PaymentType, receivedAt: new Date() }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (e) {
    // Return 5xx to let Swich retry later
    return NextResponse.json(
      { status: "error", message: e.message },
      { status: 500 }
    );
  }
}
