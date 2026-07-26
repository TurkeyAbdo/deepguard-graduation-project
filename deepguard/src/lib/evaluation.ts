import type { Decision } from '../types'

export type GroundTruth = 'genuine' | 'fake'

export interface EvaluationCase {
  id: string
  groundTruth: GroundTruth
  decision: Decision
  scenario: 'physical-camera' | 'virtual-camera'
  deepfakeRisk: number
  liveness: number
  quality: number
  latencyMs: number
}

export interface EvaluationMetrics {
  total: number
  autoDecisions: number
  reviewed: number
  truePositive: number
  trueNegative: number
  falsePositive: number
  falseNegative: number
  coverage: number
  accuracy: number
  overallCorrectRate: number
  precision: number
  recall: number
  specificity: number
  f1: number
  meanLatencyMs: number
  medianLatencyMs: number
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

export function calculateEvaluationMetrics(cases: EvaluationCase[]): EvaluationMetrics {
  let truePositive = 0
  let trueNegative = 0
  let falsePositive = 0
  let falseNegative = 0
  let reviewed = 0

  for (const item of cases) {
    if (item.decision === 'review') {
      reviewed += 1
    } else if (item.groundTruth === 'fake' && item.decision === 'fake') {
      truePositive += 1
    } else if (item.groundTruth === 'genuine' && item.decision === 'genuine') {
      trueNegative += 1
    } else if (item.groundTruth === 'genuine' && item.decision === 'fake') {
      falsePositive += 1
    } else if (item.groundTruth === 'fake' && item.decision === 'genuine') {
      falseNegative += 1
    }
  }

  const autoDecisions = cases.length - reviewed
  const precision = ratio(truePositive, truePositive + falsePositive)
  const recall = ratio(truePositive, truePositive + falseNegative)
  const sortedLatencies = cases.map((item) => item.latencyMs).sort((a, b) => a - b)
  const middle = Math.floor(sortedLatencies.length / 2)
  const medianLatencyMs = sortedLatencies.length === 0
    ? 0
    : sortedLatencies.length % 2 === 0
      ? (sortedLatencies[middle - 1] + sortedLatencies[middle]) / 2
      : sortedLatencies[middle]

  return {
    total: cases.length,
    autoDecisions,
    reviewed,
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    coverage: ratio(autoDecisions, cases.length),
    accuracy: ratio(truePositive + trueNegative, autoDecisions),
    overallCorrectRate: ratio(truePositive + trueNegative, cases.length),
    precision,
    recall,
    specificity: ratio(trueNegative, trueNegative + falsePositive),
    f1: ratio(2 * precision * recall, precision + recall),
    meanLatencyMs: ratio(cases.reduce((sum, item) => sum + item.latencyMs, 0), cases.length),
    medianLatencyMs,
  }
}
