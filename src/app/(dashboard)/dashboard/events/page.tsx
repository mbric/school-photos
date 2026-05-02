"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  Users,
  Camera,
  Trash2,
  X,
} from "lucide-react";

interface EventItem {
  id: string;
  type: string;
  date: string;
  startTime: string | null;
  notes: string | null;
  status: string;
  school: { id: string; name: string };
  _count: { checkIns: number; photos: number; orders: number; enrollments: number };
}

function phaseInfo(event: EventItem): { label: string; color: string } {
  if (event.status === "completed")   return { label: "Completed",   color: "#16a34a" };
  if (event.status === "photos_ready") return { label: "Selection",   color: "#7c3aed" };
  if (event.status === "post_shoot")  return { label: "Upload",       color: "#d97706" };
  if (event.status === "in_progress") return { label: "Picture Day",  color: "#ea580c" };
  // scheduled — distinguish setup (no students) from pre-shoot (students enrolled)
  if (event._count.enrollments > 0)  return { label: "Pre-Shoot",    color: "#0d9488" };
  return                                     { label: "Onboarding",   color: "#2563eb" };
}

interface SchoolOption {
  id: string;
  name: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchEvents() {
    const res = await fetch("/api/events");
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    fetchEvents();
  }

  const upcoming = events
    .filter((e) => new Date(e.date) >= new Date() && e.status !== "completed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = events
    .filter((e) => new Date(e.date) < new Date() || e.status === "completed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">Schedule and manage picture days</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Picture Day
        </Button>
      </div>

      {showCreate && (
        <EventForm
          onSave={() => {
            setShowCreate(false);
            fetchEvents();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No events scheduled. Create your first picture day.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} onDelete={() => handleDelete(event.id)} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Past</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} onDelete={() => handleDelete(event.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event, onDelete }: { event: EventItem; onDelete: () => void }) {
  const date = new Date(event.date);
  const isPast = date < new Date() || event.status === "completed";
  const phase = phaseInfo(event);

  return (
    <Card className={isPast ? "opacity-70" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{
                color: phase.color,
                backgroundColor: `${phase.color}15`,
                borderColor: `${phase.color}30`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: phase.color }}
              />
              {phase.label}
            </span>
          </div>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <Link
          href={`/dashboard/events/${event.id}`}
          className="block text-lg font-semibold hover:text-primary transition-colors mb-1"
        >
          {event.school.name}
        </Link>

        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </div>
          {event.startTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              {event.startTime}
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {event._count.checkIns} check-ins
          </span>
          <span className="flex items-center gap-1">
            <Camera className="h-3 w-3" /> {event._count.photos} photos
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EventForm({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/schools")
      .then((r) => r.json())
      .then((d) => setSchools(d.schools || []));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      schoolId: fd.get("schoolId") as string,
      date: fd.get("date") as string,
      startTime: fd.get("startTime") as string,
      notes: fd.get("notes") as string,
    };

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create event");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSave();
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">New Picture Day</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <Label>School *</Label>
            <select
              name="schoolId"
              required
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a school</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input name="date" type="date" required />
            </div>
            <div className="space-y-1">
              <Label>Start Time</Label>
              <Input name="startTime" type="time" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Setup details, location, etc." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
