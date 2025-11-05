import React, { useRef, useEffect, useState } from "react";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs";

export default function FaceFollower() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState("Initializing camera...");

  const smooth = useRef({
    x: 0,
    y: 0,
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
          video: { facingMode: "user" },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Looking for a face...");
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera access denied or unavailable.");
      }
    }
    startCamera();
  }, []);

  // Adjust canvas to camera aspect ratio
  useEffect(() => {
    const resizeCanvas = () => {
      const c = canvasRef.current;
      const vw = videoRef.current?.videoWidth || 640;
      const vh = videoRef.current?.videoHeight || 480;

      // Compute max size that fits viewport
      const maxWidth = window.innerWidth * 0.9;
      const maxHeight = window.innerHeight * 0.5;

      const aspect = vw / vh;
      let width = maxWidth;
      let height = width / aspect;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
      }

      c.width = vw;
      c.height = vh;

      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [videoRef.current]);

  // Main loop
  useEffect(() => {
    if (!model) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const alpha = 0.05; // smoothing

    const loop = async () => {
      if (v.readyState === 4 && v.videoWidth > 0) {
        const preds = await model.estimateFaces(v, false);
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        const s = smooth.current;

        if (preds.length > 0) {
          const [x, y] = preds[0].topLeft;
          const [x2, y2] = preds[0].bottomRight;
          const boxW = x2 - x;
          const boxH = y2 - y;
          const cx = x + boxW / 2;
          const cy = y + boxH / 2;

          // Automatic zoom based on face size
          const targetZoom = Math.min(2.5, Math.max(1, Math.min(vw, vh) / boxW));

          setStatus(`Face detected`);

          if (!s.initialized) {
            Object.assign(s, { x: cx, y: cy, zoom: targetZoom, initialized: true });
          } else {
            s.x = s.x * (1 - alpha) + cx * alpha;
            s.y = s.y * (1 - alpha) + cy * alpha;
            s.zoom = s.zoom * (1 - alpha) + targetZoom * alpha;
          }
        } else {
          setStatus("No face detected");
          s.x = s.x * (1 - alpha) + vw / 2 * alpha;
          s.y = s.y * (1 - alpha) + vh / 2 * alpha;
          s.zoom = s.zoom * (1 - alpha) + 1 * alpha;
        }

        const cropW = vw / s.zoom;
        const cropH = vh / s.zoom;
        const cropX = Math.max(0, Math.min(vw - cropW, s.x - cropW / 2));
        const cropY = Math.max(0, Math.min(vh - cropH, s.y - cropH / 2));

        ctx.save();
        ctx.scale(-1, 1);
        ctx.clearRect(-c.width, 0, c.width, c.height);
        ctx.drawImage(v, cropX, cropY, cropW, cropH, -c.width, 0, c.width, c.height);
        ctx.restore();
      }
      requestAnimationFrame(loop);
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
        width: "100vw",
        background: "#111",
        color: "white",
        fontFamily: "sans-serif",
        textAlign: "center",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ margin: "0.2em" }}>Face Tracker</h2>
      <p style={{ maxWidth: 500, color: "#ccc", margin: "0.2em" }}>
        Automatically centers and zooms into your face.
      </p>

      <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />

      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "1rem",
          border: "2px solid #444",
          backgroundColor: "black",
        }}
      />

      <div style={{ fontSize: "0.9rem", color: "#aaa", marginTop: "0.5em" }}>{status}</div>
    </div>
  );
}
