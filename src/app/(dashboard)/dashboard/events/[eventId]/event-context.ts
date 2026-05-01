"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string | null;
  studentId: string | null;
  enrollmentId: string;
}

export interface ClassGroup {
  grade: string;
  teacher: string;
}

export interface EventDetail {
  id: string;
  type: string;
  date: string;
  startTime: string | null;
  notes: string | null;
  classOrder: string | null;
  status: string;
  posesPerStudent: number;
  matchingMethod: string;
  school: { id: string; name: string; students: Student[] };
  _count: { checkIns: number; photos: number; orders: number };
}

interface EventContextValue {
  event: EventDetail | null;
  classOrder: ClassGroup[];
  setClassOrder: Dispatch<SetStateAction<ClassGroup[]>>;
  refreshEvent: () => void;
}

export const EventContext = createContext<EventContextValue>({
  event: null,
  classOrder: [],
  setClassOrder: () => {},
  refreshEvent: () => {},
});

export function useEvent() {
  return useContext(EventContext);
}
