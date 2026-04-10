import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Canvas, { CanvasRenderingContext2D } from 'react-native-canvas';

interface JarvisAnimationProps {
  mode: 'idle' | 'recording' | 'processing' | 'playing';
  amplitude: number;
  size?: number;
}

const N = 800; // Reduced from 2000 for mobile performance, but still dense
const MAX_LINES = 150;
const MAX_ELECTRONS = 40;
const LINE_DIST = 35;

export default function JarvisAnimation({ mode, amplitude, size = 300 }: JarvisAnimationProps) {
  const canvasRef = useRef<Canvas | null>(null);
  const requestRef = useRef<number>();
  const stateRef = useRef(mode);
  const ampRef = useRef(amplitude);

  useEffect(() => { stateRef.current = mode; }, [mode]);
  useEffect(() => { ampRef.current = amplitude; }, [amplitude]);

  const handleCanvas = (canvas: Canvas) => {
    if (!canvas) return;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    // --- Particle Setup ---
    const particles = Array.from({ length: N }).map(() => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.8,
    }));

    const electrons = Array.from({ length: MAX_ELECTRONS }).map(() => ({
      p1: Math.floor(Math.random() * N),
      p2: Math.floor(Math.random() * N),
      t: Math.random(),
      speed: 0.02 + Math.random() * 0.05,
    }));

    let rotation = 0;

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      const centerX = size / 2;
      const centerY = size / 2;
      rotation += 0.005;

      // --- Dynamic Targets based on State ---
      let targetRadius = 80;
      let targetSpeed = 1.0;
      let lineAlpha = 0.15;

      if (stateRef.current === 'recording') {
        targetRadius = 80 + ampRef.current * 60;
        targetSpeed = 2.5;
        lineAlpha = 0.3;
      } else if (stateRef.current === 'playing') {
        targetRadius = 90 + Math.sin(Date.now() / 200) * 10;
        targetSpeed = 1.5;
      } else if (stateRef.current === 'processing') {
        targetRadius = 50;
        targetSpeed = 4.0;
        lineAlpha = 0.05;
      }

      // --- Draw Particles ---
      ctx.fillStyle = '#00d4ff';
      const projected: {x: number, y: number, z: number}[] = [];

      particles.forEach((p, i) => {
        const pSpeed = p.speed * targetSpeed;
        const r = targetRadius + Math.sin(Date.now() / 1000 * pSpeed + p.phase) * 5;
        
        // 3D Rotation
        const x1 = p.x * Math.cos(rotation) - p.z * Math.sin(rotation);
        const z1 = p.x * Math.sin(rotation) + p.z * Math.cos(rotation);
        const y1 = p.y * Math.cos(rotation * 0.5) - z1 * Math.sin(rotation * 0.5);
        const z2 = p.y * Math.sin(rotation * 0.5) + z1 * Math.cos(rotation * 0.5);

        const px = centerX + x1 * r;
        const py = centerY + y1 * r;
        projected.push({ x: px, y: py, z: z2 });

        const opacity = (z2 + 1) / 2 * 0.6;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(px, py, 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Draw Lines ---
      ctx.strokeStyle = '#00d4ff';
      let linesCount = 0;
      for (let i = 0; i < N && linesCount < MAX_LINES; i += 5) {
        for (let j = i + 1; j < N && linesCount < MAX_LINES; j += 15) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < LINE_DIST) {
            const alpha = (1 - dist / LINE_DIST) * lineAlpha;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
            linesCount++;
          }
        }
      }

      // --- Draw Electrons ---
      ctx.fillStyle = '#ffffff';
      electrons.forEach(e => {
        e.t += e.speed * targetSpeed;
        if (e.t >= 1) {
          e.t = 0;
          e.p1 = e.p2;
          e.p2 = Math.floor(Math.random() * N);
        }

        const x = projected[e.p1].x + (projected[e.p2].x - projected[e.p1].x) * e.t;
        const y = projected[e.p1].y + (projected[e.p2].y - projected[e.p1].y) * e.t;
        
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Core Glow ---
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40);
      grad.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
      grad.addColorStop(1, 'rgba(0, 212, 255, 0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
      ctx.fill();

      requestRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas ref={handleCanvas} style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
