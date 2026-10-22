"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; z: number; phase: number };

export default function SignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = [];
    const columns = 13;
    const rows = 9;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        particles.push({
          x: column / (columns - 1),
          y: row / (rows - 1),
          z: Math.sin(column * 0.8 + row * 0.55),
          phase: column * 0.51 + row * 0.29,
        });
      }
    }

    let width = 0;
    let height = 0;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.7);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      targetX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 14;
      targetY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 10;
    };
    const onPointerLeave = () => { targetX = 0; targetY = 0; };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const draw = (time: number) => {
      const t = reducedMotion ? 0.35 : time * 0.00022;
      pointerX += (targetX - pointerX) * 0.035;
      pointerY += (targetY - pointerY) * 0.035;
      context.clearRect(0, 0, width, height);
      const points = particles.map((particle) => {
        const wave = Math.sin(t + particle.phase) * 9 + Math.cos(t * 0.7 + particle.phase * 1.7) * 5;
        return {
          x: width * (0.12 + particle.x * 0.76) + pointerX * (particle.y - 0.5),
          y: height * (0.12 + particle.y * 0.76) + wave + pointerY * (particle.x - 0.5),
          pulse: (Math.sin(t * 1.4 + particle.phase) + 1) / 2,
          row: Math.round(particle.y * (rows - 1)),
          column: Math.round(particle.x * (columns - 1)),
        };
      });

      context.lineWidth = 0.7;
      for (const point of points) {
        const right = points.find((candidate) => candidate.row === point.row && candidate.column === point.column + 1);
        const below = points.find((candidate) => candidate.column === point.column && candidate.row === point.row + 1);
        for (const neighbor of [right, below]) {
          if (!neighbor) continue;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(neighbor.x, neighbor.y);
          context.strokeStyle = `rgba(104, 165, 164, ${0.12 + point.pulse * 0.16})`;
          context.stroke();
        }
      }
      for (const [index, point] of points.entries()) {
        const accent = index % 13 === 4 || index % 17 === 0;
        context.beginPath();
        context.arc(point.x, point.y, accent ? 1.4 + point.pulse * 1.5 : 0.8, 0, Math.PI * 2);
        context.fillStyle = accent
          ? `rgba(255, 137, 112, ${0.4 + point.pulse * 0.45})`
          : `rgba(166, 221, 208, ${0.26 + point.pulse * 0.4})`;
        context.fill();
      }

      // Three offset document contours make the field read as information in motion.
      const centerX = width * 0.52 + pointerX * 0.22;
      const centerY = height * 0.48 + pointerY * 0.22;
      for (let layer = 2; layer >= 0; layer--) {
        const offset = layer * 12 + Math.sin(t + layer) * 3;
        const w = Math.min(width * 0.48, 238) - layer * 8;
        const h = Math.min(height * 0.58, 276) - layer * 8;
        const x = centerX - w / 2 + offset;
        const y = centerY - h / 2 - offset * 0.7;
        context.beginPath();
        context.roundRect(x, y, w, h, 13);
        context.fillStyle = `rgba(13, 25, 31, ${0.09 + (2 - layer) * 0.045})`;
        context.fill();
        context.strokeStyle = layer === 0 ? "rgba(166, 221, 208, 0.52)" : "rgba(166, 221, 208, 0.18)";
        context.lineWidth = layer === 0 ? 1.15 : 0.75;
        context.stroke();
        if (layer === 0) {
          for (let line = 0; line < 5; line++) {
            const lineY = y + 49 + line * 24;
            const lineWidth = w * (line === 0 ? 0.54 : 0.72 - (line % 3) * 0.12);
            context.beginPath();
            context.moveTo(x + 20, lineY);
            context.lineTo(x + 20 + lineWidth, lineY);
            context.strokeStyle = line === 0 ? "rgba(255, 137, 112, 0.75)" : "rgba(166, 221, 208, 0.27)";
            context.lineWidth = line === 0 ? 2 : 1;
            context.stroke();
          }
          context.beginPath();
          context.arc(x + w - 25, y + 24, 4, 0, Math.PI * 2);
          context.fillStyle = "rgba(255, 137, 112, 0.85)";
          context.fill();
        }
      }
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="signal-field" aria-hidden="true" />;
}
