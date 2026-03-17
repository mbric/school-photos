"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Plus,
  Upload,
  Search,
  Pencil,
  Trash2,
  Users,
  X,
  Link2,
} from "lucide-react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string | null;
  studentId: string | null;
  parentEmail: string | null;
  familyId: string | null;
}

interface School {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  _count: { students: number; events: number };
}

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.schoolId as string;

  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [filters, setFilters] = useState<{ grades: string[]; teachers: string[] }>({ grades: [], teachers: [] });
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const fetchStudents = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (gradeFilter) qs.set("grade", gradeFilter);
    if (teacherFilter) qs.set("teacher", teacherFilter);

    const res = await fetch(`/api/schools/${schoolId}/students?${qs}`);
    const data = await res.json();
    setStudents(data.students || []);
    setFilters(data.filters || { grades: [], teachers: [] });
  }, [schoolId, search, gradeFilter, teacherFilter]);

  const fetchSchool = useCallback(async () => {
    const res = await fetch(`/api/schools/${schoolId}`);
    if (!res.ok) {
      router.push("/dashboard/schools");
      return;
    }
    const data = await res.json();
    setSchool(data.school);
  }, [schoolId, router]);

  useEffect(() => {
    Promise.all([fetchSchool(), fetchStudents()]).then(() => setLoading(false));
  }, [fetchSchool, fetchStudents]);

  async function handleDeleteStudent(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    fetchStudents();
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!school) return null;

  return (
    <div>
      <Link
        href="/dashboard/schools"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Schools
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{school.name}</h1>
          <p className="text-muted-foreground">
            {school._count.students} students &middot; {school._count.events} events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import CSV
          </Button>
          <Button onClick={() => setShowAddStudent(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Student
          </Button>
        </div>
      </div>

      {showImport && (
        <CsvImport
          schoolId={schoolId}
          onDone={() => {
            setShowImport(false);
            fetchStudents();
            fetchSchool();
          }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {showAddStudent && (
        <StudentForm
          schoolId={schoolId}
          onSave={() => {
            setShowAddStudent(false);
            fetchStudents();
            fetchSchool();
          }}
          onCancel={() => setShowAddStudent(false)}
        />
      )}

      {editingStudent && (
        <StudentForm
          schoolId={schoolId}
          student={editingStudent}
          onSave={() => {
            setEditingStudent(null);
            fetchStudents();
          }}
          onCancel={() => setEditingStudent(null)}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Grades</option>
          {filters.grades.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Teachers</option>
          {filters.teachers.map((t) => (
            <option key={t} value={t!}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Student Table */}
      {students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No students yet. Add students manually or import a CSV.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Grade</th>
                <th className="text-left px-4 py-3 font-medium">Teacher</th>
                <th className="text-left px-4 py-3 font-medium">Student ID</th>
                <th className="text-left px-4 py-3 font-medium">Parent Email</th>
                <th className="text-left px-4 py-3 font-medium">Family</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {student.lastName}, {student.firstName}
                  </td>
                  <td className="px-4 py-3">{student.grade}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {student.teacher || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {student.studentId || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {student.parentEmail || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {student.familyId ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        <Link2 className="h-3 w-3" />
                        {student.familyId.slice(0, 8)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditingStudent(student)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteStudent(
                            student.id,
                            `${student.firstName} ${student.lastName}`
                          )
                        }
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Student Form ─────────────────────────────────────

function StudentForm({
  schoolId,
  student,
  onSave,
  onCancel,
}: {
  schoolId: string;
  student?: Student;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      grade: fd.get("grade") as string,
      teacher: fd.get("teacher") as string,
      studentId: fd.get("studentId") as string,
      parentEmail: fd.get("parentEmail") as string,
    };

    const url = student
      ? `/api/students/${student.id}`
      : `/api/schools/${schoolId}/students`;
    const method = student ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSave();
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="font-semibold">
            {student ? "Edit Student" : "Add Student"}
          </h3>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="firstName"
              placeholder="First name *"
              defaultValue={student?.firstName}
              required
            />
            <Input
              name="lastName"
              placeholder="Last name *"
              defaultValue={student?.lastName}
              required
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input
              name="grade"
              placeholder="Grade *"
              defaultValue={student?.grade}
              required
            />
            <Input
              name="teacher"
              placeholder="Teacher"
              defaultValue={student?.teacher || ""}
            />
            <Input
              name="studentId"
              placeholder="Student ID"
              defaultValue={student?.studentId || ""}
            />
            <Input
              name="parentEmail"
              placeholder="Parent email"
              type="email"
              defaultValue={student?.parentEmail || ""}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : student ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── CSV Import ───────────────────────────────────────

interface CsvRow {
  [key: string]: string;
}

function CsvImport({
  schoolId,
  onDone,
  onCancel,
}: {
  schoolId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "result">("upload");
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{
    created: number;
    errors: { row: number; message: string }[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fields = [
    { key: "firstName", label: "First Name", required: true },
    { key: "lastName", label: "Last Name", required: true },
    { key: "grade", label: "Grade", required: true },
    { key: "teacher", label: "Teacher", required: false },
    { key: "studentId", label: "Student ID", required: false },
    { key: "parentEmail", label: "Parent Email", required: false },
  ];

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        const hdrs = results.meta.fields || [];
        setHeaders(hdrs);

        // Auto-map columns by fuzzy matching
        const autoMap: Record<string, string> = {};
        for (const field of fields) {
          const match = hdrs.find((h) => {
            const lower = h.toLowerCase().replace(/[^a-z]/g, "");
            if (field.key === "firstName") return lower.includes("first") || lower === "firstname";
            if (field.key === "lastName") return lower.includes("last") || lower === "lastname";
            if (field.key === "grade") return lower.includes("grade") || lower.includes("level");
            if (field.key === "teacher") return lower.includes("teacher") || lower.includes("class");
            if (field.key === "studentId") return lower.includes("studentid") || lower.includes("id");
            if (field.key === "parentEmail") return lower.includes("email") || lower.includes("parent");
            return false;
          });
          if (match) autoMap[field.key] = match;
        }
        setMapping(autoMap);
        setStep("map");
      },
    });
  }

  function getMappedStudents() {
    return csvData.map((row) => ({
      firstName: (row[mapping.firstName] || "").trim(),
      lastName: (row[mapping.lastName] || "").trim(),
      grade: (row[mapping.grade] || "").trim(),
      teacher: (row[mapping.teacher] || "").trim() || undefined,
      studentId: (row[mapping.studentId] || "").trim() || undefined,
      parentEmail: (row[mapping.parentEmail] || "").trim() || undefined,
    }));
  }

  async function handleImport() {
    setLoading(true);
    const students = getMappedStudents();

    const res = await fetch(`/api/schools/${schoolId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students }),
    });

    const data = await res.json();
    setImportResult(data);
    setStep("result");
    setLoading(false);
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Import Students from CSV</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "upload" && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Upload a CSV file with student data. The file should include columns for
              first name, last name, and grade at minimum.
            </p>
            <Input type="file" accept=".csv" onChange={handleFileSelect} />
          </div>
        )}

        {step === "map" && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Map your CSV columns to student fields. Found {csvData.length} rows.
            </p>
            <div className="space-y-2 mb-4">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm w-32">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </span>
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!mapping.firstName || !mapping.lastName || !mapping.grade}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Preview of first 5 rows. {csvData.length} students will be imported.
            </p>
            <div className="border rounded-md overflow-auto mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">First Name</th>
                    <th className="text-left px-3 py-2">Last Name</th>
                    <th className="text-left px-3 py-2">Grade</th>
                    <th className="text-left px-3 py-2">Teacher</th>
                    <th className="text-left px-3 py-2">Student ID</th>
                    <th className="text-left px-3 py-2">Parent Email</th>
                  </tr>
                </thead>
                <tbody>
                  {getMappedStudents()
                    .slice(0, 5)
                    .map((s, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{s.firstName}</td>
                        <td className="px-3 py-2">{s.lastName}</td>
                        <td className="px-3 py-2">{s.grade}</td>
                        <td className="px-3 py-2">{s.teacher || "—"}</td>
                        <td className="px-3 py-2">{s.studentId || "—"}</td>
                        <td className="px-3 py-2">{s.parentEmail || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Importing..." : `Import ${csvData.length} Students`}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && importResult && (
          <div>
            <div className="mb-4">
              <p className="text-sm font-medium text-green-700">
                Successfully imported {importResult.created} of {importResult.total} students.
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-destructive mb-2">
                    {importResult.errors.length} errors:
                  </p>
                  <ul className="text-sm text-destructive space-y-1 max-h-40 overflow-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={onDone}>Done</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
