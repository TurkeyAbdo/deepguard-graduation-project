import { describe, expect, it } from 'vitest'
import { calculateEvaluationMetrics, type EvaluationCase } from './evaluation'

const sample: EvaluationCase[] = [
  { id: '1', groundTruth: 'fake', decision: 'fake', scenario: 'virtual-camera', deepfakeRisk: 0.5, liveness: 1, quality: 0.8, latencyMs: 100 },
  { id: '2', groundTruth: 'genuine', decision: 'genuine', scenario: 'physical-camera', deepfakeRisk: 0.5, liveness: 1, quality: 0.8, latencyMs: 200 },
  { id: '3', groundTruth: 'genuine', decision: 'review', scenario: 'physical-camera', deepfakeRisk: 0.5, liveness: 1, quality: 0.5, latencyMs: 300 },
]

describe('evaluation metrics', () => {
  it('separates automatic accuracy from review coverage', () => {
    const metrics = calculateEvaluationMetrics(sample)
    expect(metrics.total).toBe(3)
    expect(metrics.autoDecisions).toBe(2)
    expect(metrics.reviewed).toBe(1)
    expect(metrics.coverage).toBeCloseTo(2 / 3)
    expect(metrics.accuracy).toBe(1)
    expect(metrics.overallCorrectRate).toBeCloseTo(2 / 3)
  })

  it('calculates confusion-matrix metrics and latency', () => {
    const metrics = calculateEvaluationMetrics(sample)
    expect(metrics.truePositive).toBe(1)
    expect(metrics.trueNegative).toBe(1)
    expect(metrics.falsePositive).toBe(0)
    expect(metrics.falseNegative).toBe(0)
    expect(metrics.precision).toBe(1)
    expect(metrics.recall).toBe(1)
    expect(metrics.specificity).toBe(1)
    expect(metrics.f1).toBe(1)
    expect(metrics.meanLatencyMs).toBe(200)
    expect(metrics.medianLatencyMs).toBe(200)
  })
})
