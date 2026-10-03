"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";

// On-device face detection for the clock-in selfie (MediaPipe BlazeFace,
// served from this site: /mediapipe — the engine is copied in at build time by
// scripts/copy-mediapipe.mjs, the model is in public/mediapipe). Nothing is
// sent anywhere: it only answers "is there a face in the frame, and where".
// Loaded once and kept; preloaded when the staff home page opens so the first
// clock-in doesn't wait for the ~11 MB engine download.

let loading: Promise<FaceDetector | null> | null = null;

export function loadFaceDetector(): Promise<FaceDetector | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        return await FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite", delegate: "CPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.6,
        });
      } catch (e) {
        console.warn("Face detector unavailable:", e);
        loading = null; // allow a retry next time
        return null;
      }
    })();
  }
  return loading;
}

/** Start loading in the background when the browser is idle. */
export function preloadFaceDetector() {
  const start = () => { loadFaceDetector(); };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 5000 });
  else setTimeout(start, 2000);
}

/**
 * Is there one clear face in the middle of the frame, big enough to be the
 * person holding the phone? Returns false for no face, a face at the edge, or
 * a tiny face in the background.
 */
export function faceInFrame(detector: FaceDetector, video: HTMLVideoElement, now: number): boolean {
  const { detections } = detector.detectForVideo(video, now);
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return false;
  return detections.some((d) => {
    const score = d.categories?.[0]?.score ?? 0;
    const b = d.boundingBox;
    if (!b || score < 0.7) return false;
    const cx = (b.originX + b.width / 2) / w;
    const cy = (b.originY + b.height / 2) / h;
    return b.width / w >= 0.22 && cx > 0.2 && cx < 0.8 && cy > 0.15 && cy < 0.85;
  });
}
