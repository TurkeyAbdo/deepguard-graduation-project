import type { EvaluationCase } from '../lib/evaluation'

export const CONTROLLED_EVALUATION_CASES: EvaluationCase[] = [
  { id: 'PC-01', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8469, latencyMs: 9131 },
  { id: 'PC-02', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.7873, latencyMs: 8529 },
  { id: 'PC-03', groundTruth: 'genuine', decision: 'review', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.5487, latencyMs: 18236 },
  { id: 'PC-04', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.7060, latencyMs: 22665 },
  { id: 'PC-05', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.7173, latencyMs: 10727 },
  { id: 'PC-06', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8051, latencyMs: 18350 },
  { id: 'PC-07', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8868, latencyMs: 12371 },
  { id: 'PC-08', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8012, latencyMs: 14731 },
  { id: 'VC-01', groundTruth: 'fake', decision: 'fake', scenario: 'virtual-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8136, latencyMs: 14615 },
  { id: 'VC-02', groundTruth: 'fake', decision: 'fake', scenario: 'virtual-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8233, latencyMs: 16975 },
  { id: 'VC-03', groundTruth: 'fake', decision: 'fake', scenario: 'virtual-camera', deepfakeRisk: 0.5078, liveness: 1, quality: 0.8197, latencyMs: 14788 },
]
