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
  interpolate,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

const N = 40; // Number of main particles
const MAX_DISTANCE = 45; // Max distance for connection lines

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
        duration: 5000 / data.speed,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    let r = 70 + Math.sin(phase.value) * 10;
    
    if (mode === 'recording') {
      r += amplitude.value * 50 * Math.sin(phase.value * 2 + data.id);
    } else if (mode === 'playing') {
      r += Math.sin(phase.value * 4) * 15;
    } else if (mode === 'processing') {
      r = 40 + Math.sin(phase.value * 8) * 5;
    }

    const x = 150 + r * Math.cos(data.angle + rotation.value * data.speed * 0.01) * Math.sin(data.phi);
    const y = 150 + r * Math.sin(data.angle + rotation.value * data.speed * 0.01) * Math.sin(data.phi);

    return {
      cx: x,
      cy: y,
      r: data.size * (mode === 'recording' ? 1 + amplitude.value : 1),
      opacity: mode === 'processing' ? 0.3 : 0.6 + Math.sin(phase.value) * 0.2,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill="#00d4ff" />;
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
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const particles = useMemo(() => {
    return Array.from({ length: N }).map((_, i) => ({
      id: i,
      angle: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      speed: 0.5 + Math.random() * 1.5,
      size: 1 + Math.random() * 2,
    }));
  }, []);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg viewBox="0 0 300 300" width={size} height={size}>
        <Defs>
          <RadialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00d4ff" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Background Glow */}
        <Circle cx="150" cy="150" r="100" fill="url(#coreGrad)" opacity="0.1" />

        {/* Rotating Outer Rings */}
        <AnimatedG style={{ transform: [{ rotate: rotation.value + 'deg' }] }} origin="150, 150">
          <Circle cx="150" cy="150" r="140" stroke="#00d4ff" strokeWidth="0.2" strokeDasharray="5 15" opacity="0.2" />
          <Circle cx="150" cy="150" r="120" stroke="#00d4ff" strokeWidth="0.1" opacity="0.1" />
        </AnimatedG>

        {/* Particles */}
        {particles.map(p => (
          <Particle key={p.id} data={p} amplitude={ampShared} mode={mode} rotation={rotation} />
        ))}

        {/* Core */}
        <AnimatedCircle
          cx="150"
          cy="150"
          r={mode === 'processing' ? 25 : 35}
          fill="url(#coreGrad)"
          opacity={0.6}
        />
        <Circle cx="150" cy="150" r="10" fill="#00d4ff" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
