import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'playing' | 'listening';

interface UseVoiceReturn {
  state: RecordingState;
  amplitude: number;
  startRecording: (onSilence?: () => void) => Promise<void>;
  stopRecording: () => Promise<string | null>;
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
  
  const silenceStart = useRef<number | null>(null);
  const hasSpoken = useRef<boolean>(false);
  const SILENCE_THRESHOLD = 0.15; 
  const VOICE_THRESHOLD = 0.25;   
  const SILENCE_DURATION = 1800;  

  const startRecording = useCallback(async (onSilence?: () => void) => {
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
    hasSpoken.current = false;

    meterInterval.current = setInterval(async () => {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          const norm = Math.max(0, (status.metering + 60) / 60);
          const currentAmp = Math.min(1, norm);
          setAmplitude(currentAmp);

          if (currentAmp > VOICE_THRESHOLD) {
            hasSpoken.current = true;
            silenceStart.current = null;
          }

          if (onSilence && hasSpoken.current) {
            if (currentAmp < SILENCE_THRESHOLD) {
              if (silenceStart.current === null) {
                silenceStart.current = Date.now();
              } else if (Date.now() - silenceStart.current > SILENCE_DURATION) {
                clearInterval(meterInterval.current!);
                meterInterval.current = null;
                onSilence();
              }
            } else {
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
      
      if (!hasSpoken.current) {
        setState('idle');
        return null;
      }

      setState('processing');
      return uri || null;
    } catch (e) {
      console.error('Stop recording error:', e);
      setState('idle');
      return null;
    }
  }, []);

  const playAudio = useCallback(async (uri: string, onDone?: () => void) => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
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

  useEffect(() => {
    return () => {
      if (meterInterval.current) clearInterval(meterInterval.current);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  return { state, amplitude, startRecording, stopRecording, playAudio, stopPlayback, setState };
}
