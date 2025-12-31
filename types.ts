export interface Prediction {
  className: 'Neutral' | 'Drawing' | 'Hentai' | 'Porn' | 'Sexy';
  probability: number;
}

export interface DetectionResult {
  isSafe: boolean;
  predictions: Prediction[];
  primaryCategory: string;
}

export enum CallStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ENDED = 'ENDED'
}

export interface ProcessingStats {
  fps: number;
  latencyMs: number;
  detectionsCount: number; // Used to indicate severity/probability % in UI
}