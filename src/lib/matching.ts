import { prisma } from "./db";

interface MatchResult {
  photoId: string;
  studentId: string | null;
  method: "filename" | "sequence" | "qr" | "unmatched";
  poseNumber?: number;
}

/**
 * Auto-match photos to students.
 *
 * Strategy 0: QR match - detect QR code separator photos, group subsequent photos to identified student
 * Strategy 1: Filename match - if filename contains a student ID (e.g., LS-001-pose1.jpg)
 * Strategy 2: Sequence match - match photos in upload order to students in check-in sequence order
 *             Supports multi-pose: posesPerStudent photos per student
 * Strategy 3: Unmatched - place in queue for manual assignment
 */
export async function autoMatchPhotos(eventId: string): Promise<{
  matched: number;
  unmatched: number;
  results: MatchResult[];
}> {
  // Get event config
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { schoolId: true, posesPerStudent: true, matchingMethod: true },
  });
  if (!event) return { matched: 0, unmatched: 0, results: [] };

  const posesPerStudent = event.posesPerStudent || 1;

  // Get unmatched photos for this event, ordered by sequence
  const photos = await prisma.photo.findMany({
    where: { eventId, matched: false, isQrSeparator: false },
    orderBy: { sequence: "asc" },
  });

  // Get students for this event's school
  const students = await prisma.student.findMany({
    where: { schoolId: event.schoolId },
  });

  // Get check-ins ordered by sequence (for sequence matching)
  const checkIns = await prisma.checkIn.findMany({
    where: { eventId, status: "photographed" },
    orderBy: { sequence: "asc" },
    include: { student: true },
  });

  // Build lookup maps
  const studentIdMap = new Map(
    students.filter((s) => s.studentId).map((s) => [s.studentId!.toLowerCase(), s.id])
  );

  const results: MatchResult[] = [];
  let matched = 0;
  let unmatched = 0;

  // Strategy 0: QR-based matching
  if (event.matchingMethod === "qr") {
    const qrResults = await matchByQR(eventId, posesPerStudent);
    if (qrResults.matched > 0) {
      return qrResults;
    }
    // If QR matching found nothing, fall through to other strategies
  }

  for (const photo of photos) {
    let studentId: string | null = null;
    let method: MatchResult["method"] = "unmatched";
    let poseNumber: number | undefined;

    // Strategy 1: Filename contains student ID
    const filenameBase = photo.filename.replace(/\.[^.]+$/, "").toLowerCase();
    for (const [sid, id] of Array.from(studentIdMap.entries())) {
      if (filenameBase.includes(sid)) {
        studentId = id;
        method = "filename";
        // Try to extract pose number from filename (e.g., LS-001_pose2.bmp -> 2)
        const poseMatch = filenameBase.match(/pose(\d+)/i);
        poseNumber = poseMatch ? parseInt(poseMatch[1]) : undefined;
        break;
      }
    }

    // Strategy 2: Sequence match with multi-pose support
    if (!studentId && photo.sequence != null) {
      const checkInIndex = Math.floor((photo.sequence - 1) / posesPerStudent);
      const checkIn = checkIns[checkInIndex];
      if (checkIn) {
        // Count how many matched photos this student already has for this event
        const existingCount = await prisma.photo.count({
          where: { eventId, studentId: checkIn.studentId, matched: true },
        });
        if (existingCount < posesPerStudent) {
          studentId = checkIn.studentId;
          method = "sequence";
          poseNumber = ((photo.sequence - 1) % posesPerStudent) + 1;
        }
      }
    }

    if (studentId) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: { studentId, matched: true, poseNumber: poseNumber ?? null },
      });
      matched++;
    } else {
      unmatched++;
    }

    results.push({ photoId: photo.id, studentId, method, poseNumber });
  }

  return { matched, unmatched, results };
}

/**
 * QR-based matching: detect QR separator photos and group subsequent photos to students.
 * Requires sharp and jsqr to be installed.
 */
async function matchByQR(
  eventId: string,
  posesPerStudent: number
): Promise<{ matched: number; unmatched: number; results: MatchResult[] }> {
  let detectQR: ((imagePath: string) => Promise<string | null>) | null = null;
  let parseQRCode: ((text: string) => string | null) | null = null;

  try {
    const qrLib = await import("./qr");
    detectQR = qrLib.detectQR;
    parseQRCode = qrLib.parseQRCode;
  } catch {
    // QR libraries not available, skip QR matching
    return { matched: 0, unmatched: 0, results: [] };
  }

  // Get ALL unmatched photos (including potential QR separators) ordered by sequence
  const allPhotos = await prisma.photo.findMany({
    where: { eventId, matched: false },
    orderBy: { sequence: "asc" },
  });

  const results: MatchResult[] = [];
  let matched = 0;
  let unmatched = 0;

  // First pass: detect QR codes and build groups
  let currentStudentId: string | null = null;
  let poseCounter = 0;

  for (const photo of allPhotos) {
    // Try to detect QR code in this photo
    const storagePath = photo.storagePath;
    // Convert storage path to filesystem path
    const fsPath = storagePath.startsWith("/")
      ? storagePath
      : `${process.cwd()}/${storagePath}`;

    const qrText = await detectQR(fsPath);
    const detectedStudentId = qrText ? parseQRCode(qrText) : null;

    if (detectedStudentId) {
      // This is a QR separator photo
      await prisma.photo.update({
        where: { id: photo.id },
        data: { isQrSeparator: true, matched: true, studentId: detectedStudentId },
      });
      currentStudentId = detectedStudentId;
      poseCounter = 0;
      results.push({
        photoId: photo.id,
        studentId: detectedStudentId,
        method: "qr",
      });
      matched++;
    } else if (currentStudentId) {
      // Regular photo after a QR separator
      poseCounter++;
      await prisma.photo.update({
        where: { id: photo.id },
        data: {
          studentId: currentStudentId,
          matched: true,
          poseNumber: poseCounter,
        },
      });
      results.push({
        photoId: photo.id,
        studentId: currentStudentId,
        method: "qr",
        poseNumber: poseCounter,
      });
      matched++;
    } else {
      // No QR context yet - unmatched
      unmatched++;
      results.push({ photoId: photo.id, studentId: null, method: "unmatched" });
    }
  }

  return { matched, unmatched, results };
}
