import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const download = await prisma.digitalDownload.findUnique({
    where: { token: params.token },
    include: {
      order: {
        include: {
          items: {
            include: {
              photo: { select: { storagePath: true, filename: true } },
              student: { select: { firstName: true, lastName: true } },
              package: { select: { digital: true } },
            },
          },
        },
      },
    },
  });

  if (!download) {
    return NextResponse.json({ error: "Download not found" }, { status: 404 });
  }

  if (new Date() > download.expiresAt) {
    return NextResponse.json({ error: "Download link has expired" }, { status: 410 });
  }

  if (download.order.status !== "paid" && download.order.status !== "delivered") {
    return NextResponse.json({ error: "Order has not been paid" }, { status: 403 });
  }

  // Get all digital photos from the order
  const storage = getStorage();
  const digitalItems = download.order.items.filter((item) => item.package.digital && item.photo);

  const files = digitalItems.map((item) => ({
    filename: item.photo!.filename,
    url: storage.getUrl(item.photo!.storagePath),
    studentName: `${item.student.firstName} ${item.student.lastName}`,
  }));

  // Mark as downloaded
  if (!download.downloadedAt) {
    await prisma.digitalDownload.update({
      where: { id: download.id },
      data: { downloadedAt: new Date() },
    });
  }

  return NextResponse.json({
    orderNumber: download.order.orderNumber,
    expiresAt: download.expiresAt,
    files,
  });
}
