import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'playing';

interface UseVoiceReturn {
  state: RecordingState;
  amplitude: number;         // 0–1, for visualizer
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;  // returns URI
  playAudio: (uri: string, onDone?: () => void) => Promise<void>;
  stopPlayback: () => Promise<void>;
}

export function useVoice(): UseVoiceReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const meterInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
      },
      isMeteringEnabled: true,
    });

    await recording.startAsync();
    recordingRef.current = recording;
    setState('recording');

    // Poll amplitude for visualizer
    meterInterval.current = setInterval(async () => {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          // metering is in dBFS: -160 (silence) to 0 (max)
          const norm = Math.max(0, (status.metering + 60) / 60);
          setAmplitude(Math.min(1, norm));
        }
      } catch {}
    }, 80);
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    if (meterInterval.current) {
      clearInterval(meterInterval.current);
      meterInterval.current = null;
    }
    setAmplitude(0);

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    setState('processing');
    return uri || null;
  }, []);

  const playAudio = useCallback(async (uri: string, onDone?: () => void) => {
    // Stop any existing playback
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1.0 }
    );
    soundRef.current = sound;
    setState('playing');

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setState('idle');
        onDone?.();
      }
    });
  }, []);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setState('idle');
  }, []);

  return { state, amplitude, startRecording, stopRecording, playAudio, stopPlayback };
}
