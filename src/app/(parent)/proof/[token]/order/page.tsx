"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  ShoppingCart,
  CreditCard,
  Smartphone,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";

interface PkgOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  contents: string;
  digital: boolean;
}

interface StudentGroup {
  studentId: string;
  studentName: string;
}

interface CartItem {
  packageId: string;
  packageName: string;
  studentId: string;
  studentName: string;
  quantity: number;
  unitPrice: number;
}

export default function OrderPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const orderNumber = searchParams.get("order");
  const isCanceled = searchParams.get("canceled") === "true";

  const [packages, setPackages] = useState<PkgOption[]>([]);
  const [students, setStudents] = useState<StudentGroup[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [venmoOrderResult, setVenmoOrderResult] = useState<{
    orderNumber: string;
    totalAmount: number;
  } | null>(null);

  // First fetch proof data to get student info, then fetch packages
  const fetchData = useCallback(async () => {
    try {
      // Get proof data for student names
      const proofRes = await fetch(`/api/proofs/${token}`);
      if (!proofRes.ok) {
        setError("Could not load proof data.");
        setLoading(false);
        return;
      }
      const proofData = await proofRes.json();

      if (proofData.requiresCode) {
        setError("Please view your proofs first before ordering.");
        setLoading(false);
        return;
      }

      setSchoolName(proofData.schoolName);

      const studentList: StudentGroup[] = proofData.studentGroups.map(
        (g: { student: { firstName: string; lastName: string }; photos: { studentId: string }[] }) => ({
          studentId: g.photos[0]?.studentId,
          studentName: `${g.student.firstName} ${g.student.lastName}`,
        })
      ).filter((s: StudentGroup) => s.studentId);
      setStudents(studentList);

      // Now get the event ID from the proof link to fetch packages
      // We need to get packages via a different approach — fetch from proof token context
      const proofDetailRes = await fetch(`/api/proofs/${token}`);
      const proofDetail = await proofDetailRes.json();

      // Use the event endpoint to get packages
      // We'll need to extract eventId — let's add it to the proof response
      // For now, parse it from the proof link API response
      if (proofDetail.eventId) {
        const pkgRes = await fetch(`/api/events/${proofDetail.eventId}/orders`);
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          setPackages(pkgData.packages || []);
          setPaymentInstructions(pkgData.paymentInstructions);
          setStripeEnabled(pkgData.stripeEnabled);
        }
      }
    } catch {
      setError("Failed to load order data.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!isSuccess) fetchData();
    else setLoading(false);
  }, [fetchData, isSuccess]);

  function addToCart(pkg: PkgOption, student: StudentGroup) {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.packageId === pkg.id && i.studentId === student.studentId
      );
      if (existing) {
        return prev.map((i) =>
          i.packageId === pkg.id && i.studentId === student.studentId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          packageId: pkg.id,
          packageName: pkg.name,
          studentId: student.studentId,
          studentName: student.studentName,
          quantity: 1,
          unitPrice: pkg.price,
        },
      ];
    });
  }

  function updateQuantity(packageId: string, studentId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.packageId === packageId && i.studentId === studentId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(packageId: string, studentId: string) {
    setCart((prev) =>
      prev.filter((i) => !(i.packageId === packageId && i.studentId === studentId))
    );
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  async function handleVenmoOrder() {
    if (!parentName.trim() || !parentEmail.trim()) {
      alert("Please enter your name and email.");
      return;
    }
    setSubmitting(true);

    // We need the eventId — get it from the proof
    const proofRes = await fetch(`/api/proofs/${token}`);
    const proofData = await proofRes.json();

    if (!proofData.eventId) {
      alert("Could not determine event. Please try again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch(`/api/events/${proofData.eventId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        paymentMethod: "venmo",
        proofToken: token,
        items: cart.map((i) => ({
          packageId: i.packageId,
          studentId: i.studentId,
          quantity: i.quantity,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to place order.");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    setVenmoOrderResult({
      orderNumber: data.order.orderNumber,
      totalAmount: data.order.totalAmount,
    });
    setSubmitting(false);
  }

  async function handleCardCheckout() {
    if (!parentName.trim() || !parentEmail.trim()) {
      alert("Please enter your name and email.");
      return;
    }
    setSubmitting(true);

    // Get eventId from proof
    const proofRes = await fetch(`/api/proofs/${token}`);
    const proofData = await proofRes.json();

    if (!proofData.eventId) {
      alert("Could not determine event. Please try again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: proofData.eventId,
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        proofToken: token,
        items: cart.map((i) => ({
          packageId: i.packageId,
          studentId: i.studentId,
          quantity: i.quantity,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to create checkout session.");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    // Redirect to Stripe checkout
    if (data.url) {
      window.location.href = data.url;
    }
  }

  function formatCents(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // ─── Success state ───
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
          {orderNumber && (
            <p className="text-gray-500 mb-4">
              Order number: <span className="font-mono font-semibold">{orderNumber}</span>
            </p>
          )}
          <p className="text-gray-500 mb-6">
            Thank you for your order. You will receive a confirmation email shortly.
          </p>
          <Link
            href={`/proof/${token}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Proofs
          </Link>
        </div>
      </div>
    );
  }

  // ─── Venmo order placed ───
  if (venmoOrderResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <Smartphone className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-2">
            Order number: <span className="font-mono font-semibold">{venmoOrderResult.orderNumber}</span>
          </p>
          <p className="text-lg font-semibold mb-4">
            Total: {formatCents(venmoOrderResult.totalAmount)}
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-medium text-blue-800 mb-1">
              Please send payment:
            </p>
            <p className="text-sm text-blue-700 whitespace-pre-wrap">
              {paymentInstructions}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Include order number <span className="font-mono">{venmoOrderResult.orderNumber}</span> in the memo.
            </p>
          </div>
          <Link
            href={`/proof/${token}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Proofs
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Camera className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/proof/${token}`}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Proofs
              </Link>
              <h1 className="text-xl font-bold">{schoolName}</h1>
              <p className="text-sm text-gray-500">Order Photo Packages</p>
            </div>
            {cart.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
                <ShoppingCart className="h-4 w-4" />
                {cart.length} item(s)
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Package selection per student */}
        {students.map((student) => (
          <section key={student.studentId} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{student.studentName}</h2>
            <div className="grid gap-3">
              {packages.map((pkg) => {
                const inCart = cart.find(
                  (i) => i.packageId === pkg.id && i.studentId === student.studentId
                );
                let contentsText = "";
                try {
                  const items = JSON.parse(pkg.contents);
                  contentsText = items
                    .map((c: { qty: number; size?: string; type: string }) => `${c.qty}x ${c.size || c.type}`)
                    .join(", ");
                } catch {
                  contentsText = pkg.contents;
                }

                return (
                  <div
                    key={pkg.id}
                    className={`bg-white rounded-lg border p-4 transition-all ${
                      inCart ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{pkg.name}</span>
                          {pkg.digital && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              digital
                            </span>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-sm text-gray-500">{pkg.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{contentsText}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold">{formatCents(pkg.price)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(pkg.id, student.studentId, -1)}
                            className="p-1 rounded-md border hover:bg-gray-50"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{inCart.quantity}</span>
                          <button
                            onClick={() => updateQuantity(pkg.id, student.studentId, 1)}
                            className="p-1 rounded-md border hover:bg-gray-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(pkg.id, student.studentId)}
                            className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(pkg, student)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                          Add to Order
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {packages.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No packages available for ordering at this time.</p>
          </div>
        )}

        {/* Checkout section */}
        {cart.length > 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-6 mt-8">
            <h2 className="text-lg font-semibold mb-4">Checkout</h2>

            {/* Cart summary */}
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={`${item.packageId}-${item.studentId}`} className="border-t">
                      <td className="px-3 py-2">
                        {item.packageName} — {item.studentName}
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCents(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-semibold">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-lg">
                      {formatCents(cartTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email *</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Payment buttons */}
            <div className="space-y-3">
              {stripeEnabled && (
                <button
                  onClick={handleCardCheckout}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <CreditCard className="h-5 w-5" />
                  {submitting ? "Processing..." : `Pay ${formatCents(cartTotal)} with Card`}
                </button>
              )}

              {paymentInstructions && (
                <button
                  onClick={handleVenmoOrder}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-white border-2 border-blue-400 text-blue-700 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <Smartphone className="h-5 w-5" />
                  {submitting ? "Placing Order..." : `Pay ${formatCents(cartTotal)} via Venmo/Zelle`}
                </button>
              )}

              {!stripeEnabled && !paymentInstructions && (
                <p className="text-center text-gray-500 text-sm">
                  Payment is not yet configured. Please contact the photographer.
                </p>
              )}
            </div>

            {isCanceled && (
              <p className="text-sm text-red-500 text-center mt-3">
                Payment was canceled. You can try again.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
