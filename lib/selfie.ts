"use client";

/**
 * One-shot front-camera capture. Opens the camera, grabs a single ~40 KB JPEG,
 * closes it again. Resolves null if the camera is unavailable or denied — a
 * punch is never blocked by a camera problem (the server flags photo_missing).
 * Needs a secure origin (HTTPS or localhost).
 */
export async function captureSelfie(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    // let the sensor settle
    await new Promise((r) => setTimeout(r, 350));

    const w = 480;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.videoWidth === 0) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.45);
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

/** Current position, or null on denial/timeout/no support. */
export function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}
