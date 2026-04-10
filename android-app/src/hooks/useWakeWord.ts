import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

export function useWakeWord(onWake: () => void) {
  const [isListening, setIsListening] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const WAKE_THRESHOLD = 0.30; // Increased sensitivity

  const startListening = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setIsListening(true);

      intervalRef.current = setInterval(async () => {
        try {
          const status = await recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            const norm = Math.max(0, (status.metering + 60) / 60);
            if (norm > WAKE_THRESHOLD) {
              await stopListening();
              onWake();
            }
          }
        } catch (e) {
          console.error('Wake word polling error:', e);
        }
      }, 100);
    } catch (e) {
      console.error('Wake word listener error:', e);
    }
  }, [onWake]);

  const stopListening = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { isListening, startListening, stopListening };
}
