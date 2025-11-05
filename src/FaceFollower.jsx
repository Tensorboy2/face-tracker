import React, { useRef, useEffect, useState } from "react";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs";

export default function FaceFollower() {
  const videoRef = useRef(null);
  const zoomCanvasRef = useRef(null);
  const boxCanvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState("Initializing camera...");
  const [showBoxes, setShowBoxes] = useState(false);

  const smooth = useRef({ x: 0, y: 0, zoom: 1, initialized: false });

  // Load the model
  useEffect(() => {
    blazeface.load().then(setModel);
  }, []);

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Looking for a face...");
      } catch (err) {
        console.error(err);
        setStatus("Camera access denied or unavailable.");
      }
    }
    startCamera();
  }, []);

  // Adjust canvas sizes
  const adjustCanvas = (canvas) => {
    const v = videoRef.current;
    if (!v || !canvas) return;
    const vw = v.videoWidth || 640;
    const vh = v.videoHeight || 480;

    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.5;
    const aspect = vw / vh;
    let width = maxWidth;
    let height = width / aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }

    canvas.width = vw;
    canvas.height = vh;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  };

  useEffect(() => {
    const resize = () => {
      adjustCanvas(zoomCanvasRef.current);
      adjustCanvas(boxCanvasRef.current);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Main loop
  useEffect(() => {
    if (!model) return;
    const v = videoRef.current;
    const alpha = 0.05;

    const loop = async () => {
      if (v.readyState !== 4 || v.videoWidth === 0) {
        requestAnimationFrame(loop);
        return;
      }

      const preds = await model.estimateFaces(v, false);
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const s = smooth.current;

      const drawMirrored = (ctx) => {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-ctx.canvas.width, 0);
      };
      const restoreCtx = (ctx) => ctx.restore();

      if (showBoxes) {
        const c = boxCanvasRef.current;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);

        drawMirrored(ctx);
        ctx.drawImage(v, 0, 0, c.width, c.height);

        if (preds.length > 0) {
          preds.forEach(pred => {
            const [x, y] = pred.topLeft;
            const [x2, y2] = pred.bottomRight;
            const w = x2 - x;
            const h = y2 - y;

            // Draw box (canvas is mirrored, no extra flip needed)
            ctx.strokeStyle = "#0f0";
            ctx.lineWidth = 2;
            ctx.strokeRect(x * (c.width / vw), y * (c.height / vh), w * (c.width / vw), h * (c.height / vh));

            // Draw text: temporarily undo mirroring to make it readable
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
            ctx.fillStyle = "#0f0";
            ctx.font = "16px sans-serif";
            // Flip X manually for text to match mirrored box
            ctx.fillText(
              `${(pred.probability[0] * 100).toFixed(0)}%`,
              (vw - x2) * (c.width / vw),
              y * (c.height / vh) - 5
            );
            ctx.restore();
          });
          setStatus(`${preds.length} face(s) detected`);
        } else {
          setStatus("No face detected");
        }

        restoreCtx(ctx);
      } else {
        const c = zoomCanvasRef.current;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);

        drawMirrored(ctx);

        if (preds.length > 0) {
          const [x, y] = preds[0].topLeft;
          const [x2, y2] = preds[0].bottomRight;
          const boxW = x2 - x;
          const boxH = y2 - y;
          const cx = x + boxW / 2;
          const cy = y + boxH / 2;

          const targetZoom = Math.min(2.5, Math.max(1, Math.min(vw, vh) / boxW));
          if (!s.initialized) Object.assign(s, { x: cx, y: cy, zoom: targetZoom, initialized: true });
          else {
            s.x = s.x * (1 - alpha) + cx * alpha;
            s.y = s.y * (1 - alpha) + cy * alpha;
            s.zoom = s.zoom * (1 - alpha) + targetZoom * alpha;
          }

          const cropW = vw / s.zoom;
          const cropH = vh / s.zoom;
          const cropX = Math.max(0, Math.min(vw - cropW, s.x - cropW / 2));
          const cropY = Math.max(0, Math.min(vh - cropH, s.y - cropH / 2));

          ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, c.width, c.height);
          setStatus("Face detected");
        } else {
          s.x = s.x * (1 - alpha) + vw / 2 * alpha;
          s.y = s.y * (1 - alpha) + vh / 2 * alpha;
          s.zoom = s.zoom * (1 - alpha) + 1 * alpha;
          ctx.drawImage(v, 0, 0, c.width, c.height);
          setStatus("No face detected");
        }

        restoreCtx(ctx);
      }

      requestAnimationFrame(loop);
    };

    loop();
  }, [model, showBoxes]);

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
        boxSizing: "border-box"
      }}
    >
      <h2 style={{ margin: "0.2em" }}>Face Tracker</h2>
      <p style={{ maxWidth: 500, color: "#ccc", margin: "0.2em" }}>
        Default mode zooms into the first detected face. Toggle below to see bounding boxes with confidence scores.
      </p>

      <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />

      {!showBoxes ? (
        <canvas
          ref={zoomCanvasRef}
          style={{
            borderRadius: "1rem",
            border: "2px solid #444",
            backgroundColor: "black",
            width: "100%",
            height: "auto",
            maxHeight: "60vh"
          }}
        />
      ) : (
        <canvas
          ref={boxCanvasRef}
          style={{
            borderRadius: "1rem",
            border: "2px solid #444",
            backgroundColor: "black",
            width: "100%",
            height: "auto",
            maxHeight: "60vh"
          }}
        />
      )}

      <label style={{ marginTop: "0.5em" }}>
        <input type="checkbox" checked={showBoxes} onChange={() => setShowBoxes(!showBoxes)} /> Show face boxes
      </label>

      <div style={{ fontSize: "0.9rem", color: "#aaa", marginTop: "0.5em" }}>{status}</div>
    </div>
  );
}
