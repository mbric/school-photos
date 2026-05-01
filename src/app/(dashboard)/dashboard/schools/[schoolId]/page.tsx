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
  Package,
  DollarSign,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string | null;
  parentEmail: string | null;
  familyId: string | null;
}

interface School {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  paymentInstructions: string | null;
  _count: { students: number; events: number };
}

interface PkgItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  contents: string;
  digital: boolean;
  active: boolean;
  sortOrder: number;
}

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.schoolId as string;

  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<"roster" | "packages">("roster");
  const [packages, setPackages] = useState<PkgItem[]>([]);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PkgItem | null>(null);

  const fetchStudents = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);

    const res = await fetch(`/api/schools/${schoolId}/students?${qs}`);
    const data = await res.json();
    setStudents(data.students || []);
  }, [schoolId, search]);

  const fetchSchool = useCallback(async () => {
    const res = await fetch(`/api/schools/${schoolId}`);
    if (!res.ok) {
      router.push("/dashboard/schools");
      return;
    }
    const data = await res.json();
    setSchool(data.school);
  }, [schoolId, router]);

  const fetchPackages = useCallback(async () => {
    const res = await fetch(`/api/schools/${schoolId}/packages`);
    if (res.ok) {
      const data = await res.json();
      setPackages(data.packages || []);
    }
  }, [schoolId]);

  useEffect(() => {
    Promise.all([fetchSchool(), fetchStudents(), fetchPackages()]).then(() => setLoading(false));
  }, [fetchSchool, fetchStudents, fetchPackages]);

  async function handleDeleteStudent(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    fetchStudents();
  }

  async function handleDeletePackage(id: string, name: string) {
    if (!confirm(`Delete package "${name}"?`)) return;
    await fetch(`/api/schools/${schoolId}/packages/${id}`, { method: "DELETE" });
    fetchPackages();
  }

  async function handleSavePaymentInstructions(instructions: string) {
    await fetch(`/api/schools/${schoolId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentInstructions: instructions }),
    });
    fetchSchool();
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setActiveTab("roster")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roster"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 inline mr-1.5" />
          Roster
        </button>
        <button
          onClick={() => setActiveTab("packages")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "packages"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4 inline mr-1.5" />
          Packages & Pricing
        </button>
      </div>

      {/* ─── Roster Tab ─── */}
      {activeTab === "roster" && (
        <>
          <div className="flex gap-2 mb-4 justify-end">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={() => setShowAddStudent(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
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

          {/* Search */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
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
        </>
      )}

      {/* ─── Packages Tab ─── */}
      {activeTab === "packages" && (
        <>
          {/* Payment Instructions */}
          <PaymentInstructionsEditor
            value={school.paymentInstructions || ""}
            onSave={handleSavePaymentInstructions}
          />

          {/* Package list */}
          <div className="flex items-center justify-between mb-4 mt-6">
            <h2 className="text-lg font-semibold">Photo Packages</h2>
            <Button onClick={() => setShowAddPackage(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Package
            </Button>
          </div>

          {showAddPackage && (
            <PackageForm
              schoolId={schoolId}
              onSave={() => {
                setShowAddPackage(false);
                fetchPackages();
              }}
              onCancel={() => setShowAddPackage(false)}
            />
          )}

          {editingPackage && (
            <PackageForm
              schoolId={schoolId}
              pkg={editingPackage}
              onSave={() => {
                setEditingPackage(null);
                fetchPackages();
              }}
              onCancel={() => setEditingPackage(null)}
            />
          )}

          {packages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No packages configured. Add packages that parents can order.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={!pkg.active ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <DollarSign className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{pkg.name}</span>
                        {pkg.digital && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            digital
                          </span>
                        )}
                        {!pkg.active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            inactive
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          try {
                            const items = JSON.parse(pkg.contents);
                            return items.map((c: { type: string; size?: string; qty: number }) =>
                              `${c.qty}x ${c.size || c.type}`
                            ).join(", ");
                          } catch {
                            return pkg.contents;
                          }
                        })()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">${(pkg.price / 100).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditingPackage(pkg)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
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
          <div className="grid grid-cols-2 gap-3">
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
                disabled={!mapping.firstName || !mapping.lastName}
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

// ─── Payment Instructions Editor ─────────────────────

function PaymentInstructionsEditor({
  value,
  onSave,
}: {
  value: string;
  onSave: (instructions: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setEditing(false);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm">Venmo / Zelle Payment Instructions</h3>
            <p className="text-xs text-muted-foreground">
              Shown to parents as an alternative to credit card payment
            </p>
          </div>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => { setText(value); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='e.g. "Venmo: @JaneDoePhotos" or "Zelle: jane@email.com — include student name in memo"'
              className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm">
            {value || <span className="text-muted-foreground italic">Not configured — parents will only see credit card option</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Package Form ────────────────────────────────────

function PackageForm({
  schoolId,
  pkg,
  onSave,
  onCancel,
}: {
  schoolId: string;
  pkg?: PkgItem;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Parse existing contents or start with a default
  const defaultContents = pkg
    ? (() => { try { return JSON.parse(pkg.contents); } catch { return []; } })()
    : [{ type: "print", size: "8x10", qty: 1 }];
  const [contents, setContents] = useState<{ type: string; size: string; qty: number }[]>(defaultContents);

  function addContentItem() {
    setContents([...contents, { type: "print", size: "", qty: 1 }]);
  }

  function removeContentItem(index: number) {
    setContents(contents.filter((_, i) => i !== index));
  }

  function updateContentItem(index: number, field: string, value: string | number) {
    setContents(contents.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const priceStr = fd.get("price") as string;
    const priceCents = Math.round(parseFloat(priceStr) * 100);

    if (isNaN(priceCents) || priceCents < 0) {
      setError("Invalid price");
      setLoading(false);
      return;
    }

    const body = {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      price: priceCents,
      contents: JSON.stringify(contents),
      digital: fd.get("digital") === "on",
      sortOrder: parseInt(fd.get("sortOrder") as string) || 0,
    };

    const url = pkg
      ? `/api/schools/${schoolId}/packages/${pkg.id}`
      : `/api/schools/${schoolId}/packages`;
    const method = pkg ? "PATCH" : "POST";

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
            {pkg ? "Edit Package" : "Add Package"}
          </h3>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="text-xs">Package Name *</Label>
              <Input name="name" placeholder='e.g. "Basic Package"' defaultValue={pkg?.name} required />
            </div>
            <div>
              <Label htmlFor="price" className="text-xs">Price ($) *</Label>
              <Input
                name="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="25.00"
                defaultValue={pkg ? (pkg.price / 100).toFixed(2) : ""}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Input name="description" placeholder="Brief description for parents" defaultValue={pkg?.description || ""} />
          </div>

          {/* Package contents */}
          <div>
            <Label className="text-xs">Contents</Label>
            <div className="space-y-2 mt-1">
              {contents.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={item.qty}
                    onChange={(e) => updateContentItem(i, "qty", parseInt(e.target.value) || 0)}
                    type="number"
                    min="1"
                    className="w-16"
                    placeholder="Qty"
                  />
                  <span className="text-sm text-muted-foreground">x</span>
                  <select
                    value={item.type}
                    onChange={(e) => updateContentItem(i, "type", e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="print">Print</option>
                    <option value="digital">Digital</option>
                    <option value="sheet">Sheet</option>
                  </select>
                  <Input
                    value={item.size}
                    onChange={(e) => updateContentItem(i, "size", e.target.value)}
                    placeholder='Size (e.g. "8x10")'
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeContentItem(i)}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addContentItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="digital" defaultChecked={pkg?.digital} className="rounded" />
              Includes digital download
            </label>
            <div className="flex items-center gap-2">
              <Label htmlFor="sortOrder" className="text-xs whitespace-nowrap">Sort Order</Label>
              <Input name="sortOrder" type="number" className="w-20" defaultValue={pkg?.sortOrder || 0} />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : pkg ? "Update" : "Add Package"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
