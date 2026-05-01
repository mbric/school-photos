"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Link2,
  Eye,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Users,
  User,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProcessProgress } from "@/components/ProcessProgress";

interface ProofLink {
  id: string;
  token: string;
  accessCode: string | null;
  expiresAt: string;
  viewCount: number;
  lastViewedAt: string | null;
  emailSentAt: string | null;
  familyId: string | null;
  studentId: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
    parentEmail: string | null;
    familyId: string | null;
  } | null;
}

interface StudentWithPhotos {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  parentEmail: string | null;
  familyId: string | null;
}

interface Stats {
  totalLinks: number;
  emailsSent: number;
  totalViews: number;
}

export default function ProofsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [proofLinks, setProofLinks] = useState<ProofLink[]>([]);
  const [studentsWithPhotos, setStudentsWithPhotos] = useState<StudentWithPhotos[]>([]);
  const [stats, setStats] = useState<Stats>({ totalLinks: 0, emailsSent: 0, totalViews: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [useAccessCode, setUseAccessCode] = useState(false);
  const [groupByFamily, setGroupByFamily] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/proofs`);
    if (res.ok) {
      const data = await res.json();
      setProofLinks(data.proofLinks);
      setStudentsWithPhotos(data.studentsWithPhotos);
      setStats(data.stats);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateAll = async () => {
    setGenerating(true);
    const res = await fetch(`/api/events/${eventId}/proofs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-all",
        useAccessCode,
        expiresInDays,
        groupByFamily,
      }),
    });
    if (res.ok) {
      await fetchData();
    }
    setGenerating(false);
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/proof/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/events/${eventId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Proof Links</h1>
            <p className="text-sm text-muted-foreground">
              {studentsWithPhotos.length} students with matched photos
            </p>
          </div>
        </div>
      </div>

      <ProcessProgress currentStepId="notify-parents" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.totalLinks}</p>
              <p className="text-xs text-muted-foreground">Links Generated</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.totalViews}</p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.emailsSent}</p>
              <p className="text-xs text-muted-foreground">Emails Sent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Proof Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={groupByFamily}
                onChange={(e) => setGroupByFamily(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Group siblings into family links</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAccessCode}
                onChange={(e) => setUseAccessCode(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Require access code</span>
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Expires in</Label>
              <Input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-20"
                min={1}
                max={365}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={generateAll} disabled={generating || studentsWithPhotos.length === 0}>
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" /> Generate All Links
                </>
              )}
            </Button>
            {proofLinks.length > 0 && (
              <p className="text-sm text-amber-600 self-center">
                This will replace {proofLinks.length} existing links
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proof Links List */}
      {proofLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Links ({proofLinks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {proofLinks.map((link) => (
                <div key={link.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {link.familyId ? (
                      <Users className="h-4 w-4 text-blue-500" />
                    ) : (
                      <User className="h-4 w-4 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {link.student
                          ? `${link.student.firstName} ${link.student.lastName}`
                          : "Unknown"}
                        {link.familyId && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Family
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Grade {link.student?.grade}</span>
                        {link.accessCode && <span>Code: {link.accessCode}</span>}
                        <span>{link.viewCount} views</span>
                        {link.student?.parentEmail && <span>{link.student.parentEmail}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(link.token, link.id)}
                    >
                      {copiedId === link.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <a
                      href={`/proof/${link.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
