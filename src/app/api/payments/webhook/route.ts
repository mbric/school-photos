import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { package: { select: { digital: true } } },
          },
        },
      });

      if (order && order.status !== "paid") {
        // Update order to paid
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "paid",
            stripePaymentId: session.payment_intent as string || session.id,
          },
        });

        // Generate digital download tokens if any items are digital
        const hasDigital = order.items.some((item) => item.package.digital);
        if (hasDigital) {
          await prisma.digitalDownload.create({
            data: {
              token: randomBytes(16).toString("hex"),
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              orderId: order.id,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
