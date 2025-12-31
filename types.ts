export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label?: string;
  confidence?: number;
}

export interface DetectionResult {
  detections: BoundingBox[];
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
  detectionsCount: number;
}