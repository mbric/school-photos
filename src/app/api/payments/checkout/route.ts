import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { generateOrderNumber } from "@/lib/orders";

const checkoutSchema = z.object({
  eventId: z.string().min(1),
  parentName: z.string().min(1, "Name is required"),
  parentEmail: z.string().email("Valid email is required"),
  items: z.array(
    z.object({
      packageId: z.string().min(1),
      studentId: z.string().min(1),
      photoId: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
    })
  ).min(1),
  proofToken: z.string().optional(), // for linking back to proof page
});

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Verify event exists and get school info
  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    include: { school: { select: { name: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Look up packages and build line items
  const packageIds = Array.from(new Set(parsed.data.items.map((i) => i.packageId)));
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds }, active: true },
  });
  const pkgMap = new Map(packages.map((p) => [p.id, p]));

  // Look up student names for descriptions
  const studentIds = Array.from(new Set(parsed.data.items.map((i) => i.studentId)));
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const lineItems = [];
  let totalAmount = 0;

  for (const item of parsed.data.items) {
    const pkg = pkgMap.get(item.packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: `Package not found: ${item.packageId}` },
        { status: 400 }
      );
    }
    const student = studentMap.get(item.studentId);
    const studentName = student
      ? `${student.firstName} ${student.lastName}`
      : "Student";

    totalAmount += pkg.price * item.quantity;

    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: pkg.name,
          description: `${studentName} — ${event.school.name}`,
        },
        unit_amount: pkg.price,
      },
      quantity: item.quantity,
    });
  }

  // Create the order first (pending)
  const orderNumber = await generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      status: "pending",
      source: "online",
      totalAmount,
      parentName: parsed.data.parentName,
      parentEmail: parsed.data.parentEmail,
      eventId: parsed.data.eventId,
      items: {
        create: parsed.data.items.map((item) => ({
          packageId: item.packageId,
          studentId: item.studentId,
          photoId: item.photoId || null,
          quantity: item.quantity,
          unitPrice: pkgMap.get(item.packageId)?.price || 0,
        })),
      },
    },
  });

  // Build success/cancel URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const successUrl = parsed.data.proofToken
    ? `${appUrl}/proof/${parsed.data.proofToken}/order?success=true&order=${order.orderNumber}`
    : `${appUrl}/order-confirmation?order=${order.orderNumber}`;
  const cancelUrl = parsed.data.proofToken
    ? `${appUrl}/proof/${parsed.data.proofToken}/order?canceled=true`
    : `${appUrl}`;

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: parsed.data.parentEmail,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
    },
  });

  // Store the Stripe session ID on the order
  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentId: session.id },
  });

  return NextResponse.json({
    sessionId: session.id,
    url: session.url,
    orderNumber: order.orderNumber,
  });
}
