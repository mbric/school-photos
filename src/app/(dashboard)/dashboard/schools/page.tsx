"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, School, Users, Calendar, Trash2, Pencil } from "lucide-react";

interface SchoolItem {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  _count: { students: number; events: number };
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchSchools() {
    const res = await fetch("/api/schools");
    const data = await res.json();
    setSchools(data.schools || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchSchools();
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its students? This cannot be undone.`)) return;
    await fetch(`/api/schools/${id}`, { method: "DELETE" });
    fetchSchools();
  }

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Schools</h1>
          <p className="text-muted-foreground">Manage your schools and rosters</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add School
        </Button>
      </div>

      {showCreate && (
        <SchoolForm
          onSave={() => {
            setShowCreate(false);
            fetchSchools();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search schools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <School className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{search ? "No schools match your search" : "No schools yet. Add your first school to get started."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              onDelete={() => handleDelete(school.id, school.name)}
              onUpdated={fetchSchools}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchoolCard({
  school,
  onDelete,
  onUpdated,
}: {
  school: SchoolItem;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SchoolForm
        school={school}
        onSave={() => {
          setEditing(false);
          onUpdated();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Link
            href={`/dashboard/schools/${school.id}`}
            className="text-lg font-semibold hover:text-primary transition-colors"
          >
            {school.name}
          </Link>
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {school.address && (
          <p className="text-sm text-muted-foreground mb-3">{school.address}</p>
        )}
        {school.contactName && (
          <p className="text-sm text-muted-foreground">
            Contact: {school.contactName}
          </p>
        )}
        <div className="flex gap-4 mt-4 pt-3 border-t text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {school._count.students} students
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {school._count.events} events
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SchoolForm({
  school,
  onSave,
  onCancel,
}: {
  school?: SchoolItem;
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
      name: fd.get("name") as string,
      address: fd.get("address") as string,
      contactName: fd.get("contactName") as string,
      contactEmail: fd.get("contactEmail") as string,
      contactPhone: fd.get("contactPhone") as string,
    };

    const url = school ? `/api/schools/${school.id}` : "/api/schools";
    const method = school ? "PATCH" : "POST";

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
          <h3 className="font-semibold mb-2">
            {school ? "Edit School" : "New School"}
          </h3>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <Input
            name="name"
            placeholder="School name *"
            defaultValue={school?.name}
            required
          />
          <Input
            name="address"
            placeholder="Address"
            defaultValue={school?.address || ""}
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              name="contactName"
              placeholder="Contact name"
              defaultValue={school?.contactName || ""}
            />
            <Input
              name="contactEmail"
              placeholder="Contact email"
              type="email"
              defaultValue={school?.contactEmail || ""}
            />
            <Input
              name="contactPhone"
              placeholder="Contact phone"
              defaultValue={school?.contactPhone || ""}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : school ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
