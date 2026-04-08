import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'playing' | 'listening';

interface UseVoiceReturn {
  state: RecordingState;
  amplitude: number;         // 0–1, for visualizer
  startRecording: (onSilence?: () => void) => Promise<void>;
  stopRecording: () => Promise<string | null>;  // returns URI
  playAudio: (uri: string, onDone?: () => void) => Promise<void>;
  stopPlayback: () => Promise<void>;
  setState: (state: RecordingState) => void;
}

export function useVoice(): UseVoiceReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const meterInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // VAD (Voice Activity Detection) refs
  const silenceStart = useRef<number | null>(null);
  const SILENCE_THRESHOLD = 0.15; // Amplitude threshold for silence
  const SILENCE_DURATION = 1500;  // 1.5 seconds of silence to trigger auto-stop

  const startRecording = useCallback(async (onSilence?: () => void) => {
    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
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
    silenceStart.current = null;

    // Poll amplitude for visualizer and VAD
    meterInterval.current = setInterval(async () => {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          // metering is in dBFS: -160 (silence) to 0 (max)
          // Map -60dB to 0 and 0dB to 1
          const norm = Math.max(0, (status.metering + 60) / 60);
          const currentAmp = Math.min(1, norm);
          setAmplitude(currentAmp);

          // VAD Logic
          if (onSilence) {
            if (currentAmp < SILENCE_THRESHOLD) {
              if (silenceStart.current === null) {
                silenceStart.current = Date.now();
              } else if (Date.now() - silenceStart.current > SILENCE_DURATION) {
                // Silence detected for long enough
                clearInterval(meterInterval.current!);
                meterInterval.current = null;
                onSilence();
              }
            } else {
              // Voice detected, reset silence timer
              silenceStart.current = null;
            }
          }
        }
      } catch (e) {
        console.error('Metering error:', e);
      }
    }, 100);
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    if (meterInterval.current) {
      clearInterval(meterInterval.current);
      meterInterval.current = null;
    }
    setAmplitude(0);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setState('processing');
      return uri || null;
    } catch (e) {
      console.error('Stop recording error:', e);
      return null;
    }
  }, []);

  const playAudio = useCallback(async (uri: string, onDone?: () => void) => {
    // Stop any existing playback
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    try {
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
    } catch (e) {
      console.error('Playback error:', e);
      setState('idle');
      onDone?.();
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meterInterval.current) clearInterval(meterInterval.current);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  return { state, amplitude, startRecording, stopRecording, playAudio, stopPlayback, setState };
}
