import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Defs, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface ParticleProps {
  index: number;
  total: number;
  amplitude: Animated.SharedValue<number>;
  mode: 'idle' | 'recording' | 'processing' | 'playing';
}

const Particle = ({ index, total, amplitude, mode }: ParticleProps) => {
  const angle = (index / total) * Math.PI * 2;
  const baseRadius = useSharedValue(70 + Math.random() * 60);
  const speed = useMemo(() => 0.5 + Math.random() * 1.5, []);
  const phase = useSharedValue(Math.random() * Math.PI * 2);
  const size = useMemo(() => 0.5 + Math.random() * 1.5, []);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(phase.value + Math.PI * 2, {
        duration: (4000 / speed),
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    let currentRadius = baseRadius.value;
    let opacity = 0.3 + Math.random() * 0.5;
    let scale = 1;

    // Constant "living" noise
    currentRadius += Math.sin(phase.value * 2 + index) * 5;

    if (mode === 'recording') {
      currentRadius += amplitude.value * 80 * Math.sin(phase.value * 3 + index);
      scale = 1 + amplitude.value * 0.8;
      opacity = 0.5 + amplitude.value * 0.5;
    } else if (mode === 'playing') {
      currentRadius += Math.sin(phase.value * 4) * 15;
      scale = 1.3;
      opacity = 0.7;
    } else if (mode === 'processing') {
      currentRadius = 50 + Math.sin(phase.value * 6) * 12;
      opacity = 0.4;
    }

    const x = 150 + Math.cos(angle + phase.value * 0.2) * currentRadius;
    const y = 150 + Math.sin(angle + phase.value * 0.2) * currentRadius;

    return {
      cx: x,
      cy: y,
      r: size * scale,
      opacity: opacity,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill="#00d4ff" />;
};

interface JarvisAnimationProps {
  mode: 'idle' | 'recording' | 'processing' | 'playing';
  amplitude: number;
  size?: number;
}

export default function JarvisAnimation({ mode, amplitude, size = 300 }: JarvisAnimationProps) {
  const ampShared = useSharedValue(0);
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    ampShared.value = withSpring(amplitude, { damping: 12, stiffness: 120 });
  }, [amplitude]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const particles = useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => (
      <Particle key={i} index={i} total={120} amplitude={ampShared} mode={mode} />
    ));
  }, [mode]);

  const coreAnimatedProps = useAnimatedProps(() => {
    const scale = mode === 'recording' ? 1 + ampShared.value * 0.5 : pulse.value;
    const opacity = mode === 'processing' ? 0.3 : 0.8;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const ringAnimatedProps = useAnimatedProps(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg viewBox="0 0 300 300" width={size} height={size}>
        <Defs>
          <RadialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00d4ff" stopOpacity="0.9" />
            <Stop offset="60%" stopColor="#00d4ff" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Outer rotating rings */}
        <AnimatedG style={ringAnimatedProps} origin="150, 150">
           <Circle cx="150" cy="150" r="145" stroke="#00d4ff" strokeWidth="0.3" strokeDasharray="5 15" opacity="0.15" />
           <Circle cx="150" cy="150" r="135" stroke="#00d4ff" strokeWidth="0.2" opacity="0.1" />
        </AnimatedG>

        {/* Electron Cloud */}
        {particles}

        {/* Core Orb */}
        <AnimatedCircle
          cx="150"
          cy="150"
          r="55"
          fill="url(#coreGrad)"
          animatedProps={coreAnimatedProps}
        />
        
        {/* Inner Core */}
        <Circle
          cx="150"
          cy="150"
          r="18"
          fill="#00d4ff"
          opacity={mode === 'processing' ? 0.4 : 0.9}
        />

        {/* Center text */}
        <SvgText x="150" y="146" textAnchor="middle" fill="#000814"
          fontSize={9} letterSpacing={2} fontFamily="monospace" fontWeight="bold">
          JARVIS
        </SvgText>
        <SvgText x="150" y="158" textAnchor="middle" fill="#000814"
          fontSize={5} letterSpacing={1} fillOpacity={0.7} fontFamily="monospace">
          {mode.toUpperCase()}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
