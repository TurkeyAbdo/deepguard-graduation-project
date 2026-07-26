import { describe, expect, it } from 'vitest'
import {
  createHeadMotionTracker,
  createLivenessTracker,
  type HeadMotionTracker,
  updateHeadMotionTracker,
  updateLivenessTracker,
} from './liveness'

const blink = { key: 'blink' as const, threshold: 0.42, neutralThreshold: 0.2 }
const turn = { key: 'turn' as const, threshold: 0.34, neutralThreshold: 0.18 }

function advance(
  challenge: typeof blink | typeof turn,
  values: number[],
  quality = 0.8,
) {
  let tracker = createLivenessTracker()
  let passed = false
  for (const value of values) {
    const update = updateLivenessTracker(challenge, tracker, value, quality)
    tracker = update.tracker
    passed = update.passed
  }
  return { tracker, passed }
}

describe('active liveness tracking', () => {
  it('requires open eyes, a blink, and reopened eyes', () => {
    expect(advance(blink, [0.05, 0.04, 0.06, 0.8, 0.08, 0.05]).passed).toBe(true)
  })

  it('does not accept a face that starts with closed eyes', () => {
    const result = advance(blink, [0.8, 0.82, 0.79, 0.1])
    expect(result.passed).toBe(false)
    expect(result.tracker.stage).toBe('neutral')
  })

  it('recognizes a neutral-to-turned head movement', () => {
    expect(advance(turn, [0.06, 0.08, 0.09, 0.5, 0.56]).passed).toBe(true)
  })

  it('rejects threshold crossings when face quality is poor', () => {
    expect(advance(turn, [0.06, 0.08, 0.09, 0.5, 0.56], 0.3).passed).toBe(false)
  })

  it('restarts the neutral check when tracking quality is interrupted', () => {
    let tracker = createLivenessTracker()
    for (const value of [0.06, 0.08, 0.09]) {
      tracker = updateLivenessTracker(turn, tracker, value, 0.8).tracker
    }
    expect(tracker.stage).toBe('action')

    tracker = updateLivenessTracker(turn, tracker, 0, 0.2).tracker
    const afterInterruption = updateLivenessTracker(turn, tracker, 0.6, 0.8)
    expect(afterInterruption.passed).toBe(false)
    expect(afterInterruption.tracker.stage).toBe('neutral')
  })
})

describe('compound head motion tracking', () => {
  it('requires center, right, left, recenter, and depth change in order', () => {
    let tracker = createHeadMotionTracker()
    let passed = false
    const sequence = [
      ...Array(4).fill({ yaw: 0, scale: 0.5 }),
      ...Array(2).fill({ yaw: 0.5, scale: 0.5 }),
      ...Array(2).fill({ yaw: -0.5, scale: 0.5 }),
      ...Array(3).fill({ yaw: 0, scale: 0.5 }),
      ...Array(3).fill({ yaw: 0, scale: 0.57 }),
    ]

    for (const sample of sequence) {
      const update = updateHeadMotionTracker(tracker, sample.yaw, sample.scale, 0.8)
      tracker = update.tracker
      passed = update.passed
    }

    expect(passed).toBe(true)
  })

  it('does not accept the left turn before the right turn', () => {
    let tracker = createHeadMotionTracker()
    for (const yaw of [0, 0, 0, 0, -0.6, -0.6]) {
      tracker = updateHeadMotionTracker(tracker, yaw, 0.5, 0.8).tracker
    }
    expect(tracker.stage).toBe('right')
  })

  it('requires a meaningful closer-or-farther movement', () => {
    let tracker: HeadMotionTracker = { ...createHeadMotionTracker(), stage: 'depth', baselineFaceScale: 0.5 }
    for (const scale of [0.52, 0.53, 0.54, 0.54]) {
      const update = updateHeadMotionTracker(tracker, 0, scale, 0.8)
      tracker = update.tracker
      expect(update.passed).toBe(false)
    }
  })
})
