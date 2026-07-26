import type { Decision } from '../types'

export interface DecisionInputs {
  deepfakeProbability: number
  livenessScore: number
  qualityScore: number
  modelAvailable?: boolean
  sourceIntegrity?: 'physical' | 'virtual' | 'unknown'
}

export const HIGH_RISK_THRESHOLD = 0.72
export const PHYSICAL_CAMERA_ACCEPT_THRESHOLD = 0.6
export const GENUINE_MAX_THRESHOLD = 0.4

export function decideVerification({
  deepfakeProbability,
  livenessScore,
  qualityScore,
  modelAvailable = true,
  sourceIntegrity = 'unknown',
}: DecisionInputs): Decision {
  if (sourceIntegrity === 'virtual') return 'fake'
  if (!modelAvailable || qualityScore < 0.45) return 'review'
  if (deepfakeProbability >= HIGH_RISK_THRESHOLD || livenessScore < 0.45) return 'fake'
  if (
    sourceIntegrity === 'physical' &&
    deepfakeProbability < PHYSICAL_CAMERA_ACCEPT_THRESHOLD &&
    livenessScore >= 0.8 &&
    qualityScore >= 0.55
  ) {
    return 'genuine'
  }
  if (deepfakeProbability < GENUINE_MAX_THRESHOLD && livenessScore >= 0.8 && qualityScore >= 0.55) {
    return 'genuine'
  }
  return 'review'
}

export function confidenceForDecision(decision: Decision, fakeProbability: number, liveness: number): number {
  if (decision === 'genuine') return Math.min(1 - fakeProbability, liveness)
  if (decision === 'fake') return Math.max(fakeProbability, 1 - liveness)
  return Math.max(fakeProbability, 1 - fakeProbability)
}
