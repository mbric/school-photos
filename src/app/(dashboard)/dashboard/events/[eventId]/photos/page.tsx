"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Upload,
  Wand2,
  Image,
  CheckCircle,
  AlertCircle,
  Flag,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ProcessProgress } from "@/components/ProcessProgress";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  studentId: string | null;
}

interface Photo {
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
  student: Student | null;
}

interface Stats {
  total: number;
  matched: number;
  unmatched: number;
  flagged: number;
}

export default function PhotosPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, matched: 0, unmatched: 0, flagged: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [matching, setMatching] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/photos?filter=${filter}`);
    const data = await res.json();
    setPhotos(data.photos || []);
    setStats(data.stats || { total: 0, matched: 0, unmatched: 0, flagged: 0 });
    setStudents(data.students || []);
    setLoading(false);
  }, [eventId, filter]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  async function handleUpload(files: File[]) {
    setUploading(true);

    // Upload in batches of 5
    const batchSize = 5;
    let uploaded = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const formData = new FormData();
      batch.forEach((f) => formData.append("photos", f));

      setUploadProgress(`Uploading ${uploaded + batch.length} of ${files.length}...`);

      await fetch(`/api/events/${eventId}/photos`, {
        method: "POST",
        body: formData,
      });

      uploaded += batch.length;
    }

    setUploadProgress("");
    setUploading(false);
    fetchPhotos();
  }

  async function handleAutoMatch() {
    setMatching(true);
    const res = await fetch(`/api/events/${eventId}/photos/match`, { method: "POST" });
    const data = await res.json();
    setMatching(false);
    alert(`Matched ${data.matched} photos. ${data.unmatched} unmatched.`);
    fetchPhotos();
  }

  async function assignPhoto(photoId: string, studentId: string | null) {
    await fetch(`/api/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    fetchPhotos();
  }

  async function toggleFlag(photoId: string, flagged: boolean) {
    await fetch(`/api/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged }),
    });
    fetchPhotos();
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".bmp"] },
    onDrop: handleUpload,
    disabled: uploading,
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <Link
        href={`/dashboard/events/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold">Photos</h1>
          <p className="text-muted-foreground">Upload and match photos to students</p>
        </div>
        <Button onClick={handleAutoMatch} disabled={matching || stats.unmatched === 0}>
          <Wand2 className="h-4 w-4 mr-2" />
          {matching ? "Matching..." : "Auto-Match"}
        </Button>
      </div>

      <ProcessProgress currentStepId="upload-photos" />

      {/* Stats */}
      <div className="grid gap-3 grid-cols-4 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "all" ? "border-primary bg-primary/5" : ""}`}
        >
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </button>
        <button
          onClick={() => setFilter("matched")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "matched" ? "border-green-500 bg-green-50" : ""}`}
        >
          <p className="text-2xl font-bold text-green-600">{stats.matched}</p>
          <p className="text-xs text-muted-foreground">Matched</p>
        </button>
        <button
          onClick={() => setFilter("unmatched")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "unmatched" ? "border-yellow-500 bg-yellow-50" : ""}`}
        >
          <p className="text-2xl font-bold text-yellow-600">{stats.unmatched}</p>
          <p className="text-xs text-muted-foreground">Unmatched</p>
        </button>
        <button
          onClick={() => setFilter("flagged")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "flagged" ? "border-red-500 bg-red-50" : ""}`}
        >
          <p className="text-2xl font-bold text-red-600">{stats.flagged}</p>
          <p className="text-xs text-muted-foreground">Flagged</p>
        </button>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {uploading ? (
          <p className="text-sm text-muted-foreground">{uploadProgress}</p>
        ) : isDragActive ? (
          <p className="text-sm text-primary font-medium">Drop photos here...</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag & drop photos here, or click to select</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP supported</p>
          </>
        )}
      </div>

      {/* Photo Grid */}
      {photos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{stats.total === 0 ? "No photos uploaded yet." : "No photos match this filter."}</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              students={students}
              onAssign={(studentId) => assignPhoto(photo.id, studentId)}
              onFlag={() => toggleFlag(photo.id, !photo.flagged)}
              onReview={() => setReviewIndex(index)}
            />
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewIndex !== null && photos[reviewIndex] && (
        <ReviewModal
          photo={photos[reviewIndex]}
          students={students}
          onAssign={(studentId) => assignPhoto(photos[reviewIndex].id, studentId)}
          onFlag={() => toggleFlag(photos[reviewIndex].id, !photos[reviewIndex].flagged)}
          onPrev={() => setReviewIndex(Math.max(0, reviewIndex - 1))}
          onNext={() => setReviewIndex(Math.min(photos.length - 1, reviewIndex + 1))}
          onClose={() => setReviewIndex(null)}
          current={reviewIndex + 1}
          total={photos.length}
        />
      )}
    </div>
  );
}

// ─── Photo Card ───────────────────────────────────────

function PhotoCard({
  photo,
  students,
  onAssign,
  onFlag,
  onReview,
}: {
  photo: Photo;
  students: Student[];
  onAssign: (studentId: string | null) => void;
  onFlag: () => void;
  onReview: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div
        className="aspect-[3/4] bg-muted relative cursor-pointer group"
        onClick={onReview}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.filename}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

        {/* Status badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {photo.matched && (
            <span className="bg-green-500 text-white rounded-full p-0.5">
              <CheckCircle className="h-3 w-3" />
            </span>
          )}
          {photo.flagged && (
            <span className="bg-red-500 text-white rounded-full p-0.5">
              <Flag className="h-3 w-3" />
            </span>
          )}
          {!photo.matched && !photo.flagged && (
            <span className="bg-yellow-500 text-white rounded-full p-0.5">
              <AlertCircle className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 text-xs text-white bg-black/50 px-2 py-1 flex justify-between">
          <span>#{photo.sequence}</span>
          {photo.poseNumber && (
            <span className="bg-white/20 rounded px-1">Pose {photo.poseNumber}</span>
          )}
        </div>
      </div>
      <CardContent className="p-2">
        {photo.student ? (
          <p className="text-xs font-medium truncate">
            {photo.student.lastName}, {photo.student.firstName}
          </p>
        ) : (
          <select
            value=""
            onChange={(e) => onAssign(e.target.value || null)}
            className="w-full text-xs h-7 rounded border border-input bg-background px-1"
          >
            <option value="">Assign student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName}, {s.firstName} ({s.grade})
              </option>
            ))}
          </select>
        )}
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-muted-foreground truncate">{photo.filename}</span>
          <button
            onClick={onFlag}
            className={`p-0.5 rounded ${photo.flagged ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
          >
            <Flag className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Review Modal ─────────────────────────────────────

function ReviewModal({
  photo,
  students,
  onAssign,
  onFlag,
  onPrev,
  onNext,
  onClose,
  current,
  total,
}: {
  photo: Photo;
  students: Student[];
  onAssign: (studentId: string | null) => void;
  onFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  current: number;
  total: number;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{current} of {total}</span>
            <span className="text-sm font-medium">{photo.filename}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Image */}
          <div className="flex-1 relative bg-muted flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.filename}
              className="max-w-full max-h-[70vh] object-contain"
            />

            {/* Nav arrows */}
            <button
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Sidebar */}
          <div className="w-64 border-l p-4 overflow-auto">
            <h3 className="font-semibold mb-3">Assignment</h3>

            {photo.student ? (
              <div className="mb-4">
                <p className="text-sm font-medium">
                  {photo.student.lastName}, {photo.student.firstName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Grade {photo.student.grade} &middot; {photo.student.studentId || "No ID"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => onAssign(null)}
                >
                  Unassign
                </Button>
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => onAssign(e.target.value || null)}
                className="w-full text-sm h-9 rounded-md border border-input bg-background px-2 mb-4"
              >
                <option value="">Select student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName}, {s.firstName} ({s.grade})
                  </option>
                ))}
              </select>
            )}

            <h3 className="font-semibold mb-2">Details</h3>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>Sequence: #{photo.sequence}</p>
              {photo.poseNumber && <p>Pose: {photo.poseNumber}</p>}
              <p>Status: {photo.matched ? "Matched" : "Unmatched"}</p>
            </div>

            <Button
              size="sm"
              variant={photo.flagged ? "destructive" : "outline"}
              className="mt-4 w-full"
              onClick={onFlag}
            >
              <Flag className="h-3.5 w-3.5 mr-1" />
              {photo.flagged ? "Unflag" : "Flag for Review"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
