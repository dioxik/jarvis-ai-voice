import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  vec,
  RadialGradient,
  useValue,
  useFrame,
  BlurMask,
  Points,
} from '@shopify/react-native-skia';

interface JarvisAnimationProps {
  mode: 'idle' | 'recording' | 'processing' | 'playing';
  amplitude: number;
  size?: number;
}

const N = 1000; 

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
      speed: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  // --- Animation Values ---
  const rotation = useValue(0);
  const radiusValue = useValue(85);
  const currentAmp = useValue(0);
  
  // Points for Skia rendering
  const points = useValue(particles.map(() => vec(centerX, centerY)));

  useFrame((t) => {
    rotation.current += 0.006;
    currentAmp.current = currentAmp.current + (amplitude - currentAmp.current) * 0.15;

    let targetR = 85;
    if (mode === 'recording') targetR = 85 + currentAmp.current * 75;
    else if (mode === 'playing') targetR = 95 + Math.sin(t / 250) * 12;
    else if (mode === 'processing') targetR = 55 + Math.sin(t / 120) * 8;
    
    radiusValue.current = radiusValue.current + (targetR - radiusValue.current) * 0.12;

    const r = radiusValue.current;
    const rot = rotation.current;
    
    const newPoints = particles.map(p => {
      // 3D Rotation
      const x1 = p.x * Math.cos(rot) - p.z * Math.sin(rot);
      const z1 = p.x * Math.sin(rot) + p.z * Math.cos(rot);
      const y1 = p.y * Math.cos(rot * 0.5) - z1 * Math.sin(rot * 0.5);
      const z2 = p.y * Math.sin(rot * 0.5) + z1 * Math.cos(rot * 0.5);

      return vec(centerX + x1 * r, centerY + y1 * r);
    });
    
    points.current = newPoints;
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background Glow */}
        <Circle cx={centerX} cy={centerY} r={130}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={130}
            colors={['rgba(0, 212, 255, 0.25)', 'transparent']}
          />
        </Circle>

        {/* Core Glow */}
        <Circle cx={centerX} cy={centerY} r={45}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={45}
            colors={['rgba(0, 212, 255, 0.7)', 'transparent']}
          />
          <BlurMask blur={12} style="normal" />
        </Circle>
        <Circle cx={centerX} cy={centerY} r={14} color="#00d4ff" />

        {/* High-performance Points rendering */}
        <Points
          points={points}
          mode="points"
          color="#00d4ff"
          strokeWidth={1.2}
          strokeCap="round"
        />
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
