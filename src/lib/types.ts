// Shared domain types used across dashboard pages and API responses.

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string | null;
  grade: string;
  teacher: string | null;
  enrollmentId?: string;
  parentEmail?: string | null;
  familyId?: string | null;
}

export interface ClassGroup {
  grade: string;
  teacher: string;
}

export interface CheckIn {
  id: string;
  studentId: string;
  status: string;
  sequence: number | null;
  notes: string | null;
  checkedInAt: string | null;
  student: Pick<Student, "id" | "firstName" | "lastName" | "studentId" | "grade" | "teacher">;
}

export interface CheckInLogEntry {
  id: string;
  action: string;
  sequence: number | null;
  timestamp: string;
  student: Pick<Student, "id" | "firstName" | "lastName" | "studentId" | "grade" | "teacher">;
}

export interface Photo {
  id: string;
  filename: string;
  storagePath: string;
  url: string;
  thumbnailUrl: string | null;
  sequence: number | null;
  poseNumber: number | null;
  isQrSeparator: boolean;
  matched: boolean;
  flagged: boolean;
  flagReason: string | null;
  studentId: string | null;
  student: Pick<Student, "id" | "firstName" | "lastName" | "grade" | "studentId"> | null;
}
