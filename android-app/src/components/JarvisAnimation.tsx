import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Text as SvgText,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

type Mode = 'idle' | 'recording' | 'processing' | 'playing';

interface Props {
  mode: Mode;
  amplitude?: number;  // 0–1 for recording pulse
  size?: number;
}

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;

// Animated wrappers
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function JarvisAnimation({ mode, amplitude = 0, size = SIZE }: Props) {
  const scale = size / SIZE;

  // Continuous rotation
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // Pulse for speaking/recording
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  // Core ring breathing
  const coreScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Outer ring — slow clockwise
    Animated.loop(
      Animated.timing(rot1, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Mid ring — counter-clockwise, medium
    Animated.loop(
      Animated.timing(rot2, { toValue: -1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Inner ring — fast clockwise
    Animated.loop(
      Animated.timing(rot3, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  useEffect(() => {
    if (mode === 'playing') {
      // Speak: continuous pulsing
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.95, duration: 400, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.5, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else if (mode === 'recording') {
      // Mic active: amplitude-driven (indirect via useEffect amplitude)
      pulse.stopAnimation();
      glow.stopAnimation();
    } else if (mode === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.98, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      // Idle: soft breathing
      pulse.stopAnimation();
      glow.stopAnimation();
      Animated.loop(
        Animated.sequence([
          Animated.timing(coreScale, { toValue: 1.03, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(coreScale, { toValue: 0.97, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [mode]);

  // Map amplitude to real-time scale when recording
  useEffect(() => {
    if (mode === 'recording') {
      const target = 1 + amplitude * 0.18;
      Animated.spring(pulse, { toValue: target, speed: 40, bounciness: 2, useNativeDriver: true }).start();
    }
  }, [amplitude, mode]);

  const r1 = rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const r2 = rot2.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });
  const r3 = rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const color = mode === 'recording' ? '#ff4444' : mode === 'processing' ? '#44aaff' : '#00d4ff';
  const dimColor = mode === 'recording' ? '#661111' : '#004466';

  // Tick marks for outer ring
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const r = 148;
    const len = i % 6 === 0 ? 10 : i % 2 === 0 ? 6 : 3;
    return {
      x1: CX + Math.cos(angle) * r,
      y1: CY + Math.sin(angle) * r,
      x2: CX + Math.cos(angle) * (r + len),
      y2: CY + Math.sin(angle) * (r + len),
    };
  });

  // Dashed arcs (mid ring decoration)
  const arcSegments = 12;
  const arcGap = 0.15;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.15" />
            <Stop offset="1" stopColor="#000033" stopOpacity="0.9" />
          </LinearGradient>
        </Defs>

        {/* Outer ring with ticks */}
        <AnimatedG style={{ transform: [{ rotate: r1 }], transformOrigin: `${CX} ${CY}` }}>
          <Circle cx={CX} cy={CY} r={148} stroke={color} strokeWidth={1} strokeOpacity={0.3} fill="none" />
          <Circle cx={CX} cy={CY} r={152} stroke={color} strokeWidth={0.5} strokeOpacity={0.15} fill="none" />
          {ticks.map((t, i) => (
            <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={color} strokeWidth={i % 6 === 0 ? 1.5 : 0.7} strokeOpacity={i % 6 === 0 ? 0.8 : 0.4} />
          ))}
          {/* Corner accent blocks */}
          {[0, 90, 180, 270].map((deg) => {
            const a = (deg * Math.PI) / 180;
            return (
              <G key={deg} transform={`rotate(${deg} ${CX} ${CY})`}>
                <Line x1={CX + 140} y1={CY - 1} x2={CX + 158} y2={CY - 1}
                  stroke={color} strokeWidth={4} strokeLinecap="round" />
              </G>
            );
          })}
        </AnimatedG>

        {/* Mid dashed segmented ring */}
        <AnimatedG style={{ transform: [{ rotate: r2 }], transformOrigin: `${CX} ${CY}` }}>
          <Circle cx={CX} cy={CY} r={118} stroke={color} strokeWidth={1.5}
            strokeOpacity={0.5} fill="none"
            strokeDasharray={`${Math.PI * 2 * 118 / arcSegments * (1 - arcGap)} ${Math.PI * 2 * 118 / arcSegments * arcGap}`} />
          {/* Binary-like decorations */}
          {Array.from({ length: 20 }, (_, i) => {
            const a = (i / 20) * Math.PI * 2;
            const r = 110;
            return (
              <SvgText key={i}
                x={CX + Math.cos(a) * r - 4}
                y={CY + Math.sin(a) * r + 4}
                fill={color} fillOpacity={0.5} fontSize={7} fontFamily="monospace">
                {i % 3 === 0 ? '0' : '1'}
              </SvgText>
            );
          })}
        </AnimatedG>

        {/* Inner spinning ring */}
        <AnimatedG style={{ transform: [{ rotate: r3 }], transformOrigin: `${CX} ${CY}` }}>
          <Circle cx={CX} cy={CY} r={85} stroke={color} strokeWidth={2}
            strokeOpacity={0.7} fill="none"
            strokeDasharray={`${Math.PI * 2 * 85 * 0.75} ${Math.PI * 2 * 85 * 0.25}`} />
          {/* Accent notch */}
          <Circle cx={CX + 85} cy={CY} r={4} fill={color} fillOpacity={0.9} />
        </AnimatedG>

        {/* Core pulsing circle */}
        <AnimatedCircle
          cx={CX} cy={CY} r={65}
          stroke={color} strokeWidth={2.5} strokeOpacity={0.9}
          fill="url(#coreGrad)"
          style={{ transform: [{ scale: mode === 'idle' ? coreScale : pulse }, { translateX: 0 }, { translateY: 0 }] }}
        />

        {/* Center text */}
        <SvgText x={CX} y={CY - 6} textAnchor="middle" fill={color}
          fontSize={11} letterSpacing={3} fontFamily="monospace" fontWeight="500">
          J.A.R.V.I.S
        </SvgText>
        <SvgText x={CX} y={CY + 10} textAnchor="middle" fill={color}
          fontSize={7} letterSpacing={2} fillOpacity={0.6} fontFamily="monospace">
          {mode === 'idle' ? 'STANDBY' :
           mode === 'recording' ? 'LISTENING' :
           mode === 'processing' ? 'PROCESSING' : 'SPEAKING'}
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
