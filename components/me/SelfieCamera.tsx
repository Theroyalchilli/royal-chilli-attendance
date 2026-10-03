"use client";

import { useEffect, useRef, useState } from "react";
import { faceInFrame, loadFaceDetector } from "@/lib/face-detector";

// The clock-in / clock-out photo: a live front-camera preview with a face
// outline. The photo is taken automatically once a face has been steady in
// the outline for a moment — pointing the phone at a wall or the ceiling
// never takes one. On a phone where the face check can't run, a "Take photo"
// button appears instead and the photo is marked as not face-checked for the
// manager. If the camera can't be opened at all, the punch goes ahead
// without a photo (flagged "no photo", as before).

/** null = they tapped Cancel (no punch). */
export type SelfieResult = { photo: string | null; face: boolean | null } | null;

const HOLD_MS = 700;
const FALLBACK_AFTER_MS = 8000;

export default function SelfieCamera({ label, onDone }: { label: string; onDone: (r: SelfieResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const [state, setState] = useState<"opening" | "looking" | "seen" | "manual">("opening");
  const manualRef = useRef<() => void>(() => {});
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const finish = (r: SelfieResult) => {
      if (finished.current) return;
      finished.current = true;
      if (timer) clearInterval(timer);
      if (fallback) clearTimeout(fallback);
      stream?.getTracks().forEach((t) => t.stop());
      onDone(r);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return finish({ photo: null, face: null });
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        return finish({ photo: null, face: null });
      }
      if (cancelled) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setState("looking");

      // No face check on this phone (or it's still loading after 8 s): offer a manual photo.
      fallback = setTimeout(() => { if (!finished.current) setState((s) => (s === "looking" ? "manual" : s)); }, FALLBACK_AFTER_MS);
      const detector = await loadFaceDetector();
      if (cancelled || finished.current) return;
      if (!detector) { setState("manual"); return; }

      let seenSince = 0;
      timer = setInterval(() => {
        if (finished.current || video.readyState < 2) return;
        let ok = false;
        try { ok = faceInFrame(detector, video, performance.now()); } catch { ok = false; }
        if (!ok) { seenSince = 0; setState((s) => (s === "seen" ? "looking" : s)); return; }
        if (!seenSince) { seenSince = Date.now(); setState("seen"); }
        if (Date.now() - seenSince >= HOLD_MS) finish({ photo: grab(video), face: true });
      }, 150);
    })();

    // Exposed for the manual button / cancel below.
    manualRef.current = () => finish({ photo: videoRef.current ? grab(videoRef.current) : null, face: false });
    cancelRef.current = () => finish(null);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (fallback) clearTimeout(fallback);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ring = state === "seen" ? "border-emerald-400" : "border-white/80";
  const hint =
    state === "opening" ? "Opening the camera…"
    : state === "seen" ? "Hold still…"
    : state === "manual" ? "Face your camera, then tap Take photo"
    : "Show your face in the circle";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <p className="mb-3 text-lg font-semibold text-white">{label}</p>
      <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-neutral-900">
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        <div className={`pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[66%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 ${ring} transition-colors`} />
      </div>
      <p className={`mt-3 text-center text-sm ${state === "seen" ? "text-emerald-300" : "text-white/80"}`}>{hint}</p>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={() => cancelRef.current()} className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25">
          Cancel
        </button>
        {state === "manual" && (
          <button type="button" onClick={() => manualRef.current()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">
            Take photo
          </button>
        )}
      </div>
    </div>
  );
}

function grab(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null;
  const w = 480;
  const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.5);
}
