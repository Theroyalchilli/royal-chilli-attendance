"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Front-camera capture for the kiosk. Holds one long-lived <video> stream and
 * grabs a small JPEG frame on demand. A camera problem never blocks a punch —
 * capture() just resolves null and the server flags photo_missing.
 *
 * Needs a secure origin (HTTPS or localhost); plain http silently gets nothing.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setTried(true);
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setReady(false);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = useCallback(async (): Promise<string | null> => {
    const v = videoRef.current;
    if (!v || !ready || v.videoWidth === 0) return null;
    try {
      const w = 480;
      const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.45);
    } catch {
      return null;
    }
  }, [ready]);

  const videoEl = (
    <video
      ref={videoRef}
      muted
      playsInline
      className="pointer-events-none fixed h-px w-px opacity-0"
    />
  );

  return { videoEl, capture, ready, tried };
}
