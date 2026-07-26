import type { ChallengeKey } from '../types'

export type LivenessStage = 'neutral' | 'action' | 'release'
export type HeadMotionStage = 'center' | 'right' | 'left' | 'recenter' | 'depth'

export interface LivenessTracker {
  stage: LivenessStage
  neutralFrames: number
  actionFrames: number
  releaseFrames: number
}

export interface HeadMotionTracker {
  stage: HeadMotionStage
  holdFrames: number
  baselineFaceScale: number
  scaleTotal: number
  scaleFrames: number
}

interface LivenessChallenge {
  key: ChallengeKey
  threshold: number
  neutralThreshold: number
}

export function createLivenessTracker(): LivenessTracker {
  return { stage: 'neutral', neutralFrames: 0, actionFrames: 0, releaseFrames: 0 }
}

export function createHeadMotionTracker(): HeadMotionTracker {
  return {
    stage: 'center',
    holdFrames: 0,
    baselineFaceScale: 0,
    scaleTotal: 0,
    scaleFrames: 0,
  }
}

export function headMotionPrompt(stage: HeadMotionStage): string {
  if (stage === 'right') return 'Turn your head to the right'
  if (stage === 'left') return 'Now turn your head to the left'
  if (stage === 'recenter') return 'Face forward again'
  if (stage === 'depth') return 'Move closer or farther from the camera'
  return 'Face forward and hold still'
}

function headMotionProgress(stage: HeadMotionStage, passed: boolean): number {
  if (passed) return 1
  if (stage === 'right') return 0.2
  if (stage === 'left') return 0.4
  if (stage === 'recenter') return 0.6
  if (stage === 'depth') return 0.8
  return 0
}

export function updateHeadMotionTracker(
  tracker: HeadMotionTracker,
  yaw: number,
  faceScale: number,
  quality: number,
): { tracker: HeadMotionTracker; passed: boolean; progress: number } {
  if (quality < 0.42 || faceScale <= 0) {
    const reset = createHeadMotionTracker()
    return { tracker: reset, passed: false, progress: 0 }
  }

  let next = tracker
  let passed = false

  if (tracker.stage === 'center') {
    const centered = Math.abs(yaw) <= 0.18
    const holdFrames = centered ? tracker.holdFrames + 1 : 0
    const scaleTotal = centered ? tracker.scaleTotal + faceScale : 0
    const scaleFrames = centered ? tracker.scaleFrames + 1 : 0
    next = { ...tracker, holdFrames, scaleTotal, scaleFrames }
    if (holdFrames >= 4) {
      next = {
        ...next,
        stage: 'right',
        holdFrames: 0,
        baselineFaceScale: scaleTotal / Math.max(1, scaleFrames),
      }
    }
  } else if (tracker.stage === 'right') {
    const holdFrames = yaw >= 0.3 ? tracker.holdFrames + 1 : 0
    next = { ...tracker, holdFrames }
    if (holdFrames >= 2) next = { ...next, stage: 'left', holdFrames: 0 }
  } else if (tracker.stage === 'left') {
    const holdFrames = yaw <= -0.3 ? tracker.holdFrames + 1 : 0
    next = { ...tracker, holdFrames }
    if (holdFrames >= 2) next = { ...next, stage: 'recenter', holdFrames: 0 }
  } else if (tracker.stage === 'recenter') {
    const holdFrames = Math.abs(yaw) <= 0.18 ? tracker.holdFrames + 1 : 0
    next = { ...tracker, holdFrames }
    if (holdFrames >= 3) next = { ...next, stage: 'depth', holdFrames: 0 }
  } else {
    const scaleChange = Math.abs(faceScale - tracker.baselineFaceScale) / Math.max(0.001, tracker.baselineFaceScale)
    const holdFrames = Math.abs(yaw) <= 0.24 && scaleChange >= 0.1 ? tracker.holdFrames + 1 : 0
    next = { ...tracker, holdFrames }
    passed = holdFrames >= 3
  }

  return { tracker: next, passed, progress: headMotionProgress(next.stage, passed) }
}

export function updateLivenessTracker(
  challenge: LivenessChallenge,
  tracker: LivenessTracker,
  value: number,
  quality: number,
): { tracker: LivenessTracker; passed: boolean } {
  if (quality < 0.42) {
    return { tracker: createLivenessTracker(), passed: false }
  }

  if (tracker.stage === 'neutral') {
    const neutralFrames = value <= challenge.neutralThreshold ? tracker.neutralFrames + 1 : 0
    if (neutralFrames >= 3) {
      return {
        tracker: { stage: 'action', neutralFrames, actionFrames: 0, releaseFrames: 0 },
        passed: false,
      }
    }
    return { tracker: { ...tracker, neutralFrames }, passed: false }
  }

  if (tracker.stage === 'action') {
    const actionFrames = value >= challenge.threshold ? tracker.actionFrames + 1 : 0
    const requiredFrames = challenge.key === 'blink' ? 1 : 2
    if (actionFrames >= requiredFrames) {
      if (challenge.key === 'blink') {
        return {
          tracker: { ...tracker, stage: 'release', actionFrames, releaseFrames: 0 },
          passed: false,
        }
      }
      return { tracker: { ...tracker, actionFrames }, passed: true }
    }
    return { tracker: { ...tracker, actionFrames }, passed: false }
  }

  const releaseFrames = value <= challenge.neutralThreshold ? tracker.releaseFrames + 1 : 0
  return {
    tracker: { ...tracker, releaseFrames },
    passed: releaseFrames >= 2,
  }
}
