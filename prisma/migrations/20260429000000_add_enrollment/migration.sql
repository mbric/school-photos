-- CreateTable: Enrollment (grade/teacher per student per event)
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grade" TEXT NOT NULL,
    "teacher" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_eventId_key" ON "Enrollment"("studentId", "eventId");
CREATE INDEX "Enrollment_eventId_grade_teacher_idx" ON "Enrollment"("eventId", "grade", "teacher");
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- Backfill: create enrollment for every (student, event) at the same school
-- Uses the student's current grade/teacher as the best historical approximation
INSERT INTO "Enrollment" ("id", "grade", "teacher", "createdAt", "studentId", "eventId")
SELECT
    'enr' || lower(hex(randomblob(9))),
    s."grade",
    s."teacher",
    CURRENT_TIMESTAMP,
    s."id",
    e."id"
FROM "Student" s
INNER JOIN "Event" e ON e."schoolId" = s."schoolId";

-- RedefineTables: drop grade/teacher from Student (SQLite requires table recreation)
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "studentId" TEXT,
    "parentEmail" TEXT,
    "familyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "schoolId" TEXT NOT NULL,
    CONSTRAINT "new_Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Student" ("id", "firstName", "lastName", "studentId", "parentEmail", "familyId", "createdAt", "updatedAt", "schoolId")
SELECT "id", "firstName", "lastName", "studentId", "parentEmail", "familyId", "createdAt", "updatedAt", "schoolId"
FROM "Student";

DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";

-- Recreate indexes
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");
CREATE INDEX "Student_familyId_idx" ON "Student"("familyId");
CREATE UNIQUE INDEX "Student_studentId_schoolId_key" ON "Student"("studentId", "schoolId") WHERE "studentId" IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
