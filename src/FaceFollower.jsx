import React, { useRef, useEffect, useState } from "react";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs";

export default function FaceFollower() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);

  const smooth = useRef({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    zoom: 1,
    initialized: false,
  });

  // Load model
  useEffect(() => {
    blazeface.load().then(setModel);
  }, []);

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
    startCamera();
  }, []);

  // Main loop
  useEffect(() => {
    if (!model) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");

    const alpha = 0.1; // smoothing

    const loop = async () => {
      if (v.readyState === 4 && v.videoWidth > 0) {
        const preds = await model.estimateFaces(v, false);
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        const s = smooth.current;

        if (preds.length > 0) {
          // Face found → update smooth state
          const [x, y] = preds[0].topLeft;
          const [x2, y2] = preds[0].bottomRight;
          const box = { x, y, w: x2 - x, h: y2 - y };
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
          const targetZoom = Math.min(3, Math.max(1, 180 / box.w));

          if (!s.initialized) {
            Object.assign(s, { x: cx, y: cy, w: box.w, h: box.h, zoom: targetZoom, initialized: true });
          } else {
            s.x = s.x * (1 - alpha) + cx * alpha;
            s.y = s.y * (1 - alpha) + cy * alpha;
            s.zoom = s.zoom * (1 - alpha) + targetZoom * alpha;
          }
        } else {
          // No face found → slowly reset to full view
          s.x = s.x * (1 - alpha) + vw / 2 * alpha;
          s.y = s.y * (1 - alpha) + vh / 2 * alpha;
          s.zoom = s.zoom * (1 - alpha) + 1 * alpha;
        }

        // Compute crop area
        const cropW = vw / s.zoom;
        const cropH = vh / s.zoom;
        const cropX = Math.max(0, Math.min(vw - cropW, s.x - cropW / 2));
        const cropY = Math.max(0, Math.min(vh - cropH, s.y - cropH / 2));

        // Draw mirrored image
        ctx.save();
        ctx.scale(-1, 1);
        ctx.clearRect(-c.width, 0, c.width, c.height);
        ctx.drawImage(v, cropX, cropY, cropW, cropH, -c.width, 0, c.width, c.height);
        ctx.restore();

        requestAnimationFrame(loop);
      } else {
        requestAnimationFrame(loop);
      }
    };
    loop();
  }, [model]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "black",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          borderRadius: "1rem",
          border: "2px solid #444",
          backgroundColor: "black",
        }}
      />
    </div>
  );
}
