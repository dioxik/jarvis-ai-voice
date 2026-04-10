import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  vec,
  RadialGradient,
  useComputedValue,
  useValue,
  useFrame,
  Skia,
  Paint,
  BlurMask,
} from '@shopify/react-native-skia';

interface JarvisAnimationProps {
  mode: 'idle' | 'recording' | 'processing' | 'playing';
  amplitude: number;
  size?: number;
}

const N = 1200; // High density for mobile
const MAX_LINES = 100;
const MAX_ELECTRONS = 30;
const LINE_DIST = 40;

export default function JarvisAnimation({ mode, amplitude, size = 300 }: JarvisAnimationProps) {
  const centerX = size / 2;
  const centerY = size / 2;

  // --- Particle Setup ---
  const particles = useMemo(() => {
    return Array.from({ length: N }).map(() => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.8,
    }));
  }, []);

  const electrons = useMemo(() => {
    return Array.from({ length: MAX_ELECTRONS }).map(() => ({
      p1: Math.floor(Math.random() * N),
      p2: Math.floor(Math.random() * N),
      t: Math.random(),
      speed: 0.01 + Math.random() * 0.03,
    }));
  }, []);

  // --- Animation Values ---
  const rotation = useValue(0);
  const ampValue = useValue(0);
  const radiusValue = useValue(80);

  useFrame((t) => {
    rotation.current += 0.005;
    ampValue.current = amplitude;

    // Smooth radius transition
    let targetR = 80;
    if (mode === 'recording') targetR = 80 + amplitude * 70;
    else if (mode === 'playing') targetR = 90 + Math.sin(t / 200) * 10;
    else if (mode === 'processing') targetR = 50 + Math.sin(t / 100) * 5;
    
    radiusValue.current = radiusValue.current + (targetR - radiusValue.current) * 0.1;
  });

  // --- Projected Points ---
  const projectedPoints = useComputedValue(() => {
    const r = radiusValue.current;
    const rot = rotation.current;
    return particles.map(p => {
      // 3D Rotation
      const x1 = p.x * Math.cos(rot) - p.z * Math.sin(rot);
      const z1 = p.x * Math.sin(rot) + p.z * Math.cos(rot);
      const y1 = p.y * Math.cos(rot * 0.5) - z1 * Math.sin(rot * 0.5);
      const z2 = p.y * Math.sin(rot * 0.5) + z1 * Math.cos(rot * 0.5);

      return {
        x: centerX + x1 * r,
        y: centerY + y1 * r,
        z: z2,
        opacity: (z2 + 1) / 2 * 0.6
      };
    });
  }, [rotation, radiusValue]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background Glow */}
        <Circle cx={centerX} cy={centerY} r={120}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={120}
            colors={['rgba(0, 212, 255, 0.2)', 'transparent']}
          />
        </Circle>

        {/* Particles */}
        {projectedPoints.current.map((p, i) => (
          <Circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r={0.8}
            color="#00d4ff"
            opacity={p.opacity}
          />
        ))}

        {/* Lines (Sampled for performance) */}
        {Array.from({ length: MAX_LINES }).map((_, idx) => {
          const i = (idx * 7) % N;
          const j = (i + 13) % N;
          const p1 = projectedPoints.current[i];
          const p2 = projectedPoints.current[j];
          
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > LINE_DIST) return null;
          
          return (
            <Line
              key={`l-${idx}`}
              p1={vec(p1.x, p1.y)}
              p2={vec(p2.x, p2.y)}
              color="#00d4ff"
              strokeWidth={0.3}
              opacity={(1 - dist / LINE_DIST) * 0.2}
            />
          );
        })}

        {/* Electrons */}
        {electrons.map((e, i) => {
          const p1 = projectedPoints.current[e.p1];
          const p2 = projectedPoints.current[e.p2];
          
          // Update electron position in frame would be better, but this is a start
          const ex = p1.x + (p2.x - p1.x) * e.t;
          const ey = p1.y + (p2.y - p1.y) * e.t;

          return (
            <Circle
              key={`e-${i}`}
              cx={ex}
              cy={ey}
              r={1.2}
              color="#ffffff"
              opacity={0.8}
            />
          );
        })}

        {/* Core */}
        <Circle cx={centerX} cy={centerY} r={40}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={40}
            colors={['rgba(0, 212, 255, 0.6)', 'transparent']}
          />
          <BlurMask blur={10} style="normal" />
        </Circle>
        <Circle cx={centerX} cy={centerY} r={12} color="#00d4ff" />
      </Canvas>
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
