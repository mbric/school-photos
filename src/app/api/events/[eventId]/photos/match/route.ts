import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { autoMatchPhotos } from "@/lib/matching";

export async function POST(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await prisma.event.findFirst({
    where: { id: params.eventId, photographerId: session.userId },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const result = await autoMatchPhotos(params.eventId);
  return NextResponse.json(result);
}
