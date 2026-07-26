import { describe, expect, it } from 'vitest'
import { decideVerification } from './decision'

describe('decideVerification', () => {
  it('accepts a high-quality live sample with low fake probability', () => {
    expect(
      decideVerification({ deepfakeProbability: 0.16, livenessScore: 0.92, qualityScore: 0.84 }),
    ).toBe('genuine')
  })

  it('flags high model risk, failed liveness, or a virtual camera', () => {
    expect(
      decideVerification({ deepfakeProbability: 0.84, livenessScore: 0.9, qualityScore: 0.8 }),
    ).toBe('fake')
    expect(
      decideVerification({ deepfakeProbability: 0.2, livenessScore: 0.3, qualityScore: 0.8 }),
    ).toBe('fake')
    expect(decideVerification({
      deepfakeProbability: 0.51,
      livenessScore: 1,
      qualityScore: 0.83,
      sourceIntegrity: 'virtual',
    })).toBe('fake')
  })

  it('accepts a strong live response from a physical camera when texture risk is below 60%', () => {
    expect(decideVerification({
      deepfakeProbability: 0.51,
      livenessScore: 1,
      qualityScore: 0.83,
      sourceIntegrity: 'physical',
    })).toBe('genuine')
  })

  it('routes uncertain, poor-quality, and unavailable-model samples to review', () => {
    expect(
      decideVerification({ deepfakeProbability: 0.51, livenessScore: 1, qualityScore: 0.83 }),
    ).toBe('review')
    expect(
      decideVerification({ deepfakeProbability: 0.1, livenessScore: 0.9, qualityScore: 0.3 }),
    ).toBe('review')
    expect(
      decideVerification({
        deepfakeProbability: 0.1,
        livenessScore: 0.9,
        qualityScore: 0.8,
        modelAvailable: false,
      }),
    ).toBe('review')
  })
})
