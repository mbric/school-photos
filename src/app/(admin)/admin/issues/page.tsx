"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CircleDot, CheckCircle2, Plus, Search, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: GitHubLabel[];
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  comments: number;
  html_url: string;
}

function relativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function LabelBadge({ label }: { label: GitHubLabel }) {
  const r = parseInt(label.color.slice(0, 2), 16);
  const g = parseInt(label.color.slice(2, 4), 16);
  const b = parseInt(label.color.slice(4, 6), 16);
  const textColor = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#000" : "#fff";
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `#${label.color}`, color: textColor }}
    >
      {label.name}
    </span>
  );
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [state, setState] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [labels, setLabels] = useState<GitHubLabel[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ state, page: String(page) });
    if (search) params.set("q", search);
    if (selectedLabel) params.set("label", selectedLabel);

    const res = await fetch(`/api/github/issues?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load issues");
      setLoading(false);
      return;
    }
    setIssues(data.issues || []);
    setOpenCount(data.openCount ?? 0);
    setClosedCount(data.closedCount ?? 0);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [state, search, selectedLabel, page]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  useEffect(() => {
    fetch("/api/github/labels")
      .then((r) => r.json())
      .then((d) => setLabels(d.labels || []));
  }, []);

  function switchState(next: "open" | "closed") {
    setState(next);
    setPage(1);
  }

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-muted-foreground">Tracked in GitHub</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Issue
        </Button>
      </div>

      {showCreate && (
        <NewIssueForm
          labels={labels}
          onSave={() => { setShowCreate(false); fetchIssues(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-md border overflow-hidden text-sm">
          <button
            onClick={() => switchState("open")}
            className={`flex items-center gap-1.5 px-4 py-2 transition-colors ${state === "open" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            <CircleDot className="h-3.5 w-3.5 text-green-600" />
            {openCount} Open
          </button>
          <button
            onClick={() => switchState("closed")}
            className={`flex items-center gap-1.5 px-4 py-2 border-l transition-colors ${state === "closed" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
            {closedCount} Closed
          </button>
        </div>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>

        {labels.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedLabel && (
              <button
                onClick={() => setSelectedLabel("")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear filter
              </button>
            )}
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => setSelectedLabel(selectedLabel === label.name ? "" : label.name)}
                className={`text-xs rounded-full px-2 py-0.5 border transition-opacity ${selectedLabel && selectedLabel !== label.name ? "opacity-40" : ""}`}
                style={{
                  borderColor: `#${label.color}`,
                  color: `#${label.color}`,
                  backgroundColor: `#${label.color}20`,
                }}
              >
                {label.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Issue list */}
      {error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-2">{error}</p>
          {(error.includes("GITHUB_TOKEN") || error.includes("GITHUB_REPO")) && (
            <p className="text-sm text-muted-foreground">
              Add <code className="bg-muted px-1 rounded">GITHUB_TOKEN</code> and{" "}
              <code className="bg-muted px-1 rounded">GITHUB_REPO</code> to your .env.local file.
            </p>
          )}
        </div>
      ) : loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : issues.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CircleDot className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No {state} issues found.</p>
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {issues.map((issue) => (
              <div
                key={issue.number}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {issue.state === "open" ? (
                  <CircleDot className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/issues/${issue.number}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {issue.title}
                    </Link>
                    {issue.labels.map((label) => (
                      <LabelBadge key={label.id} label={label} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    #{issue.number} · opened {relativeTime(issue.created_at)} by {issue.user?.login}
                  </p>
                </div>
                {issue.comments > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 mt-0.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {issue.comments}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function NewIssueForm({
  labels,
  onSave,
  onCancel,
}: {
  labels: GitHubLabel[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/github/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title") as string,
        body: fd.get("body") as string,
        labels: selectedLabels,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create issue");
      setLoading(false);
      return;
    }
    setLoading(false);
    onSave();
  }

  function toggleLabel(name: string) {
    setSelectedLabels((prev) =>
      prev.includes(name) ? prev.filter((l) => l !== name) : [...prev, name]
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">New Issue</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
          )}
          <Input name="title" placeholder="Issue title *" required />
          <textarea
            name="body"
            placeholder="Describe the issue..."
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {labels.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Labels</p>
              <div className="flex gap-1.5 flex-wrap">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.name)}
                    className={`text-xs rounded-full px-2 py-0.5 border transition-all ${
                      selectedLabels.includes(label.name)
                        ? "ring-2 ring-offset-1 opacity-100"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      borderColor: `#${label.color}`,
                      color: `#${label.color}`,
                      backgroundColor: `#${label.color}20`,
                    }}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
