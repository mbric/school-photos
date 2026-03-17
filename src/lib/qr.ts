import QRCode from "qrcode";

const QR_PREFIX = "SPH:";

/**
 * Generate a QR code data URL for a student.
 * Encodes the internal student ID with a prefix for detection.
 */
export async function generateStudentQR(studentId: string): Promise<string> {
  return QRCode.toDataURL(`${QR_PREFIX}${studentId}`, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "H",
  });
}

/**
 * Generate a QR code SVG string for a student (used in printable sheets).
 */
export async function generateStudentQRSvg(studentId: string): Promise<string> {
  return QRCode.toString(`${QR_PREFIX}${studentId}`, {
    type: "svg",
    width: 200,
    margin: 1,
    errorCorrectionLevel: "H",
  });
}

/**
 * Parse a QR code text to extract the student ID.
 * Returns null if the text doesn't match our format.
 */
export function parseQRCode(text: string): string | null {
  if (text.startsWith(QR_PREFIX)) {
    return text.slice(QR_PREFIX.length);
  }
  return null;
}

/**
 * Detect a QR code in an image file.
 * Returns the decoded text or null if no QR code found.
 */
export async function detectQR(imagePath: string): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const jsQR = (await import("jsqr")).default;

    // Read and decode image to raw pixel data
    const { data, info } = await sharp(imagePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // jsQR expects Uint8ClampedArray of RGBA pixels
    const imageData = new Uint8ClampedArray(data.buffer);
    const result = jsQR(imageData, info.width, info.height);

    return result?.data ?? null;
  } catch {
    return null;
  }
}
