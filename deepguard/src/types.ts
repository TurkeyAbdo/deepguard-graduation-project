export type Decision = 'genuine' | 'fake' | 'review'
export type ReviewStatus = 'pending' | 'cleared' | 'escalated'
export type ChallengeKey = 'blink' | 'turn' | 'smile'

export interface ChallengeResult {
  key: ChallengeKey
  label: string
  passed: boolean
  peak: number
}

export interface VerificationResult {
  source: 'camera' | 'upload'
  decision: Decision
  deepfake_probability: number
  liveness_score: number
  quality_score: number
  latency_ms: number
  runtime: string
  model_version: string
  challenges: ChallengeResult[]
  notes?: string
}

export interface VerificationSession extends VerificationResult {
  id: string
  created_at: string
  review_status: ReviewStatus
  notes: string
}

export interface DailyMetric {
  day: string
  total: number
  flagged: number
}

export interface Metrics {
  total: number
  genuine: number
  fake: number
  review: number
  avg_latency_ms: number
  avg_liveness: number
  daily: DailyMetric[]
}

export interface FaceSignals {
  hasFace: boolean
  blink: number
  smile: number
  turn: number
  yaw: number
  faceScale: number
  quality: number
  bbox: { x: number; y: number; width: number; height: number } | null
}
