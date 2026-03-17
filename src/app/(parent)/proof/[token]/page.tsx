"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Camera, Lock, Heart, ChevronLeft, ChevronRight, X, ShoppingCart } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  studentId: string;
  sequence: number;
}

interface StudentGroup {
  student: { firstName: string; lastName: string; grade: string };
  photos: Photo[];
}

interface ProofData {
  schoolName: string;
  studentGroups: StudentGroup[];
  isFamily: boolean;
}

export default function ProofGalleryPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ProofData | null>(null);
  const [requiresCode, setRequiresCode] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);

  const fetchProofs = useCallback(
    async (accessCode?: string) => {
      const url = accessCode
        ? `/api/proofs/${token}?code=${encodeURIComponent(accessCode)}`
        : `/api/proofs/${token}`;
      const res = await fetch(url);
      const json = await res.json();

      if (res.status === 404) {
        setError("This proof link was not found.");
        setLoading(false);
        return;
      }
      if (res.status === 410) {
        setError("This proof link has expired.");
        setLoading(false);
        return;
      }

      if (json.requiresCode) {
        setRequiresCode(true);
        setSchoolName(json.schoolName);
        setLoading(false);
        return;
      }

      setData(json);
      setRequiresCode(false);
      setLoading(false);
    },
    [token]
  );

  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  const submitCode = () => {
    if (!code.trim()) return;
    setCodeError(false);
    setLoading(true);
    fetchProofs(code.trim()).then(() => {
      if (!data && requiresCode) setCodeError(true);
    });
  };

  const toggleSelect = (studentName: string, photoId: string) => {
    setSelectedPhotos((prev) => {
      if (prev[studentName] === photoId) {
        const next = { ...prev };
        delete next[studentName];
        return next;
      }
      return { ...prev, [studentName]: photoId };
    });
  };

  const submitSelections = async () => {
    await fetch(`/api/proofs/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: selectedPhotos }),
    });
    alert("Your pose preferences have been saved!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Camera className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-700 mb-2">Oops!</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (requiresCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full mx-4">
          <div className="text-center mb-6">
            <Lock className="h-10 w-10 text-blue-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold">{schoolName}</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your access code to view proofs</p>
          </div>
          <div className="space-y-4">
            <label htmlFor="access-code" className="sr-only">Access code</label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="Access code"
              aria-describedby={codeError ? "code-error" : undefined}
              aria-invalid={codeError}
              className="w-full px-4 py-3 border rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={6}
              autoFocus
            />
            {codeError && (
              <p id="code-error" role="alert" className="text-sm text-red-500 text-center">Invalid access code</p>
            )}
            <button
              onClick={submitCode}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              View Photos
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{data.schoolName}</h1>
              <p className="text-sm text-gray-500">Picture Day Proofs</p>
            </div>
            <Link
              href={`/proof/${token}/order`}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Order Photos
            </Link>
          </div>
        </div>
      </header>

      {/* Gallery */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {data.studentGroups.map((group) => {
          const name = `${group.student.firstName} ${group.student.lastName}`;
          return (
            <section key={name}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{name}</h2>
                <p className="text-sm text-gray-500">Grade {group.student.grade}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {group.photos.map((photo, idx) => {
                  const isSelected = selectedPhotos[name] === photo.id;
                  return (
                    <div
                      key={photo.id}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-transparent hover:border-gray-300"
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={`${name} - Pose ${photo.sequence || idx + 1}`}
                        className="w-full aspect-[3/4] object-cover"
                        onClick={() =>
                          setLightbox({ photos: group.photos, index: idx })
                        }
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-xs font-medium">
                            Pose {photo.sequence || idx + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(name, photo.id);
                            }}
                            aria-label={isSelected ? `Deselect pose ${photo.sequence || idx + 1} for ${name}` : `Select pose ${photo.sequence || idx + 1} for ${name}`}
                            aria-pressed={isSelected}
                            className={`p-1.5 rounded-full transition-colors ${
                              isSelected
                                ? "bg-blue-500 text-white"
                                : "bg-white/30 text-white hover:bg-white/50"
                            }`}
                          >
                            <Heart
                              className="h-4 w-4"
                              fill={isSelected ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Submit preferences */}
        {Object.keys(selectedPhotos).length > 0 && (
          <div className="sticky bottom-4">
            <div className="bg-blue-600 text-white rounded-xl shadow-lg p-4 flex items-center justify-between max-w-lg mx-auto">
              <span className="text-sm font-medium">
                {Object.keys(selectedPhotos).length} pose(s) selected
              </span>
              <button
                onClick={submitSelections}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          role="dialog"
          aria-label="Photo viewer"
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(null);
            if (e.key === "ArrowLeft")
              setLightbox((prev) =>
                prev ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length } : null
              );
            if (e.key === "ArrowRight")
              setLightbox((prev) =>
                prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : null
              );
          }}
          tabIndex={0}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
            aria-label="Close photo viewer"
          >
            <X className="h-6 w-6" />
          </button>
          <button
            onClick={() =>
              setLightbox((prev) =>
                prev
                  ? {
                      ...prev,
                      index:
                        (prev.index - 1 + prev.photos.length) % prev.photos.length,
                    }
                  : null
              )
            }
            className="absolute left-4 text-white p-2 hover:bg-white/10 rounded-full"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <img
            src={lightbox.photos[lightbox.index].url}
            alt={`Photo ${lightbox.index + 1} of ${lightbox.photos.length}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          <button
            onClick={() =>
              setLightbox((prev) =>
                prev
                  ? {
                      ...prev,
                      index: (prev.index + 1) % prev.photos.length,
                    }
                  : null
              )
            }
            className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-full"
            aria-label="Next photo"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          <div className="absolute bottom-4 text-white text-sm" aria-live="polite">
            {lightbox.index + 1} / {lightbox.photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
