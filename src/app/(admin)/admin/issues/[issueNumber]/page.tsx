"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CircleDot,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: GitHubLabel[];
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
  comments: number;
  html_url: string;
}

interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser | null;
  created_at: string;
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

function CommentBody({ user, createdAt, body }: { user: GitHubUser | null; createdAt: string; body: string }) {
  return (
    <CardContent className="p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b text-sm">
        {user?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt={user.login} className="w-6 h-6 rounded-full" />
        )}
        <span className="font-medium">{user?.login ?? "unknown"}</span>
        <span className="text-muted-foreground">· {relativeTime(createdAt)}</span>
      </div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{body}</div>
    </CardContent>
  );
}

export default function IssueDetailPage() {
  const { issueNumber } = useParams<{ issueNumber: string }>();
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingState, setTogglingState] = useState(false);

  async function fetchIssue() {
    const res = await fetch(`/api/github/issues/${issueNumber}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load issue");
      setLoading(false);
      return;
    }
    setIssue(data.issue);
    setComments(data.comments || []);
    setLoading(false);
  }

  useEffect(() => { fetchIssue(); }, [issueNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleState() {
    if (!issue) return;
    setTogglingState(true);
    await fetch(`/api/github/issues/${issueNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: issue.state === "open" ? "closed" : "open" }),
    });
    await fetchIssue();
    setTogglingState(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    await fetch(`/api/github/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    setNewComment("");
    setCommenting(false);
    await fetchIssue();
    setSubmitting(false);
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  if (error || !issue) {
    return (
      <div>
        <Link href="/admin/issues" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Issues
        </Link>
        <p className="text-destructive">{error || "Issue not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/issues"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Issues
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-3">
          {issue.state === "open" ? (
            <CircleDot className="h-5 w-5 mt-1 text-green-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mt-1 text-purple-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-snug">{issue.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              #{issue.number} · {issue.state === "open" ? "Opened" : "Closed"}{" "}
              {relativeTime(issue.created_at)} by {issue.user?.login}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> GitHub
            </a>
            <Button variant="outline" size="sm" onClick={toggleState} disabled={togglingState}>
              {issue.state === "open" ? "Close Issue" : "Reopen Issue"}
            </Button>
          </div>
        </div>
        {issue.labels.length > 0 && (
          <div className="flex gap-1.5 flex-wrap ml-8">
            {issue.labels.map((label) => (
              <LabelBadge key={label.id} label={label} />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <Card className="mb-6">
        <CommentBody
          user={issue.user}
          createdAt={issue.created_at}
          body={issue.body || ""}
        />
        {!issue.body && (
          <CardContent className="pt-0 pb-4">
            <p className="text-sm text-muted-foreground italic">No description provided.</p>
          </CardContent>
        )}
      </Card>

      {/* Comments */}
      {comments.length > 0 && (
        <div className="space-y-4 mb-6">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </h2>
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CommentBody user={comment.user} createdAt={comment.created_at} body={comment.body} />
            </Card>
          ))}
        </div>
      )}

      {/* Add comment */}
      {commenting ? (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-medium mb-3">Leave a comment</h3>
            <form onSubmit={submitComment} className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={4}
                autoFocus
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCommenting(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
                  {submitting ? "Submitting..." : "Comment"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setCommenting(true)}>
          <MessageSquare className="h-4 w-4 mr-2" /> Add Comment
        </Button>
      )}
    </div>
  );
}
