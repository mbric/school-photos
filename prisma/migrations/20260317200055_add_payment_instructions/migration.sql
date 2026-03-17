-- AlterTable
ALTER TABLE "School" ADD COLUMN "paymentInstructions" TEXT;

-- CreateTable
CREATE TABLE "CheckInLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "sequence" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkInId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "CheckInLog_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckInLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckInLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'initial',
    "date" DATETIME NOT NULL,
    "startTime" TEXT,
    "notes" TEXT,
    "classOrder" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "posesPerStudent" INTEGER NOT NULL DEFAULT 1,
    "matchingMethod" TEXT NOT NULL DEFAULT 'sequence',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "schoolId" TEXT NOT NULL,
    "photographerId" TEXT NOT NULL,
    CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("classOrder", "createdAt", "date", "id", "notes", "photographerId", "schoolId", "startTime", "status", "type", "updatedAt") SELECT "classOrder", "createdAt", "date", "id", "notes", "photographerId", "schoolId", "startTime", "status", "type", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_schoolId_idx" ON "Event"("schoolId");
CREATE INDEX "Event_date_idx" ON "Event"("date");
CREATE TABLE "new_Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "fileSize" INTEGER,
    "sequence" INTEGER,
    "poseNumber" INTEGER,
    "isQrSeparator" BOOLEAN NOT NULL DEFAULT false,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT,
    CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("createdAt", "eventId", "fileSize", "filename", "flagReason", "flagged", "id", "matched", "mimeType", "sequence", "storagePath", "studentId", "thumbnailPath") SELECT "createdAt", "eventId", "fileSize", "filename", "flagReason", "flagged", "id", "matched", "mimeType", "sequence", "storagePath", "studentId", "thumbnailPath" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE INDEX "Photo_eventId_matched_idx" ON "Photo"("eventId", "matched");
CREATE INDEX "Photo_studentId_idx" ON "Photo"("studentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CheckInLog_eventId_timestamp_idx" ON "CheckInLog"("eventId", "timestamp");

-- CreateIndex
CREATE INDEX "CheckInLog_checkInId_idx" ON "CheckInLog"("checkInId");
