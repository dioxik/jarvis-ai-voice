import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

const N = 100; // Optimized for SVG performance in Expo Go
const MAX_LINES = 60;
const MAX_ELECTRONS = 15;

interface ParticleData {
  id: number;
  angle: number;
  phi: number;
  speed: number;
  size: number;
}

const Particle = ({ data, amplitude, mode, rotation }: { 
  data: ParticleData, 
  amplitude: Animated.SharedValue<number>, 
  mode: string,
  rotation: Animated.SharedValue<number>
}) => {
  const phase = useSharedValue(Math.random() * Math.PI * 2);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(phase.value + Math.PI * 2, {
        duration: 4000 / data.speed,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    let r = 75 + Math.sin(phase.value) * 8;
    
    if (mode === 'recording') {
      r += amplitude.value * 60 * Math.sin(phase.value * 2 + data.id);
    } else if (mode === 'playing') {
      r += Math.sin(phase.value * 4) * 12;
    } else if (mode === 'processing') {
      r = 45 + Math.sin(phase.value * 8) * 6;
    }

    const x = 150 + r * Math.cos(data.angle + rotation.value * data.speed * 0.02) * Math.sin(data.phi);
    const y = 150 + r * Math.sin(data.angle + rotation.value * data.speed * 0.02) * Math.sin(data.phi);

    return {
      cx: x,
      cy: y,
      r: data.size * (mode === 'recording' ? 1 + amplitude.value * 0.5 : 1),
      opacity: mode === 'processing' ? 0.4 : 0.7 + Math.sin(phase.value) * 0.2,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill="#00d4ff" />;
};

const Electron = ({ p1, p2, rotation, mode }: { p1: ParticleData, p2: ParticleData, rotation: Animated.SharedValue<number>, mode: string }) => {
  const t = useSharedValue(Math.random());
  
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 800 + Math.random() * 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const r1 = 75;
    const r2 = 75;
    
    const x1 = 150 + r1 * Math.cos(p1.angle + rotation.value * p1.speed * 0.02) * Math.sin(p1.phi);
    const y1 = 150 + r1 * Math.sin(p1.angle + rotation.value * p1.speed * 0.02) * Math.sin(p1.phi);
    
    const x2 = 150 + r2 * Math.cos(p2.angle + rotation.value * p2.speed * 0.02) * Math.sin(p2.phi);
    const y2 = 150 + r2 * Math.sin(p2.angle + rotation.value * p2.speed * 0.02) * Math.sin(p2.phi);

    return {
      cx: x1 + (x2 - x1) * t.value,
      cy: y1 + (y2 - y1) * t.value,
      r: 1.5,
      opacity: mode === 'processing' ? 0.9 : 0.6,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill="#ffffff" />;
};

export default function JarvisAnimation({ mode, amplitude, size = 300 }: { 
  mode: 'idle' | 'recording' | 'processing' | 'playing', 
  amplitude: number, 
  size?: number 
}) {
  const ampShared = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    ampShared.value = withSpring(amplitude, { damping: 15, stiffness: 150 });
  }, [amplitude]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 25000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const particles = useMemo(() => {
    return Array.from({ length: N }).map((_, i) => ({
      id: i,
      angle: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      speed: 0.6 + Math.random() * 1.4,
      size: 0.8 + Math.random() * 1.5,
    }));
  }, []);

  const electrons = useMemo(() => {
    return Array.from({ length: MAX_ELECTRONS }).map((_, i) => ({
      id: i,
      p1: particles[Math.floor(Math.random() * N)],
      p2: particles[Math.floor(Math.random() * N)],
    }));
  }, [particles]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg viewBox="0 0 300 300" width={size} height={size}>
        <Defs>
          <RadialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00d4ff" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Background Glow */}
        <Circle cx="150" cy="150" r="110" fill="url(#coreGrad)" opacity="0.15" />

        {/* Rotating Outer Rings */}
        <AnimatedG style={{ transform: [{ rotate: rotation.value + 'deg' }] }} origin="150, 150">
          <Circle cx="150" cy="150" r="145" stroke="#00d4ff" strokeWidth="0.3" strokeDasharray="4 12" opacity="0.25" />
          <Circle cx="150" cy="150" r="125" stroke="#00d4ff" strokeWidth="0.15" opacity="0.15" />
        </AnimatedG>

        {/* Connection Lines (Sampled for performance) */}
        {particles.slice(0, MAX_LINES).map((p, i) => {
          const nextP = particles[(i + 1) % N];
          return (
            <AnimatedLine
              key={`line-${i}`}
              x1={150} y1={150} x2={150} y2={150} // Placeholder, logic in props
              stroke="#00d4ff"
              strokeWidth="0.2"
              opacity={0.1}
              animatedProps={useAnimatedProps(() => {
                const r = 75;
                const x1 = 150 + r * Math.cos(p.angle + rotation.value * p.speed * 0.02) * Math.sin(p.phi);
                const y1 = 150 + r * Math.sin(p.angle + rotation.value * p.speed * 0.02) * Math.sin(p.phi);
                const x2 = 150 + r * Math.cos(nextP.angle + rotation.value * nextP.speed * 0.02) * Math.sin(nextP.phi);
                const y2 = 150 + r * Math.sin(nextP.angle + rotation.value * nextP.speed * 0.02) * Math.sin(nextP.phi);
                return { x1, y1, x2, y2 };
              })}
            />
          );
        })}

        {/* Particles */}
        {particles.map(p => (
          <Particle key={`p-${p.id}`} data={p} amplitude={ampShared} mode={mode} rotation={rotation} />
        ))}

        {/* Electrons */}
        {electrons.map(e => (
          <Electron key={`e-${e.id}`} p1={e.p1} p2={e.p2} rotation={rotation} mode={mode} />
        ))}

        {/* Core */}
        <AnimatedCircle
          cx="150"
          cy="150"
          r={mode === 'processing' ? 28 : 38}
          fill="url(#coreGrad)"
          opacity={0.7}
        />
        <Circle cx="150" cy="150" r="12" fill="#00d4ff" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
