import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, G, Defs, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  interpolate,
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
  const radius = useSharedValue(80 + Math.random() * 40);
  const phase = useSharedValue(Math.random() * Math.PI * 2);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(phase.value + Math.PI * 2, {
        duration: 3000 + Math.random() * 2000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    let currentRadius = radius.value;
    let opacity = 0.4 + Math.random() * 0.4;
    let scale = 1;

    if (mode === 'recording') {
      currentRadius += amplitude.value * 60 * Math.sin(phase.value + index);
      scale = 1 + amplitude.value * 0.5;
      opacity = 0.6 + amplitude.value * 0.4;
    } else if (mode === 'playing') {
      currentRadius += Math.sin(phase.value * 2) * 20;
      scale = 1.2;
    } else if (mode === 'processing') {
      currentRadius = 60 + Math.sin(phase.value * 4) * 10;
      opacity = 0.3;
    }

    const x = 150 + Math.cos(angle) * currentRadius;
    const y = 150 + Math.sin(angle) * currentRadius;

    return {
      cx: x,
      cy: y,
      r: (1.5 + Math.random() * 2) * scale,
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

  useEffect(() => {
    ampShared.value = withSpring(amplitude, { damping: 10, stiffness: 100 });
  }, [amplitude]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 15000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const particles = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => (
      <Particle key={i} index={i} total={50} amplitude={ampShared} mode={mode} />
    ));
  }, [mode]);

  const coreAnimatedProps = useAnimatedProps(() => {
    const scale = mode === 'recording' ? 1 + ampShared.value * 0.4 : 1;
    const opacity = mode === 'processing' ? 0.4 : 0.8;
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
            <Stop offset="0%" stopColor="#00d4ff" stopOpacity="0.8" />
            <Stop offset="70%" stopColor="#00d4ff" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Outer rotating rings */}
        <AnimatedG style={ringAnimatedProps} origin="150, 150">
           <Circle cx="150" cy="150" r="140" stroke="#00d4ff" strokeWidth="0.5" strokeDasharray="10 20" opacity="0.2" />
           <Circle cx="150" cy="150" r="130" stroke="#00d4ff" strokeWidth="0.2" opacity="0.1" />
        </AnimatedG>

        {/* Particle Cloud */}
        {particles}

        {/* Core Orb */}
        <AnimatedCircle
          cx="150"
          cy="150"
          r="60"
          fill="url(#coreGrad)"
          animatedProps={coreAnimatedProps}
        />
        
        {/* Inner Core */}
        <Circle
          cx="150"
          cy="150"
          r="20"
          fill="#00d4ff"
          opacity={mode === 'processing' ? 0.5 : 0.9}
        />

        {/* Center text */}
        <SvgText x="150" y="145" textAnchor="middle" fill="#000814"
          fontSize={10} letterSpacing={3} fontFamily="monospace" fontWeight="bold">
          J.A.R.V.I.S
        </SvgText>
        <SvgText x="150" y="160" textAnchor="middle" fill="#000814"
          fontSize={6} letterSpacing={2} fillOpacity={0.8} fontFamily="monospace">
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
