import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = '@jarvis_debug_logs';
const MAX_LOGS = 100;

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  constructor() {
    this.loadLogs();
  }

  private async loadLogs() {
    try {
      const stored = await AsyncStorage.getItem(LOG_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
        this.notify();
      }
    } catch (e) {
      console.error('Failed to load logs', e);
    }
  }

  private async saveLogs() {
    try {
      await AsyncStorage.setItem(LOG_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save logs', e);
    }
  }

  private notify() {
    this.listeners.forEach(l => l([...this.logs]));
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener([...this.logs]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    this.logs = [entry, ...this.logs].slice(0, MAX_LOGS);
    this.notify();
    this.saveLogs();
    
    if (level === 'error') console.error(message);
    else console.log(message);
  }

  async clear() {
    this.logs = [];
    this.notify();
    await AsyncStorage.removeItem(LOG_KEY);
  }

  getLogs() {
    return this.logs;
  }
}

export const logger = new Logger();
