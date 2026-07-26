import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Focus,
  Eye,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  SmilePlus,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import { createSession } from '../lib/api'
import { DEEPFAKE_MODEL_VERSION, classifyFaceSamples, modelRuntime, warmDeepfakeModel } from '../lib/deepfake'
import { decideVerification } from '../lib/decision'
import { captureVideoFrame, loadFaceLandmarker, readFaceSignals } from '../lib/face'
import {
  createHeadMotionTracker,
  createLivenessTracker,
  headMotionPrompt,
  updateHeadMotionTracker,
  updateLivenessTracker,
  type HeadMotionStage,
} from '../lib/liveness'
import type {
  ChallengeKey,
  ChallengeResult,
  FaceSignals,
  VerificationResult,
  VerificationSession,
} from '../types'

interface ChallengeDefinition {
  key: ChallengeKey
  label: string
  threshold: number
  neutralThreshold: number
}

const CHALLENGES: ChallengeDefinition[] = [
  { key: 'blink', label: 'Blink once', threshold: 0.42, neutralThreshold: 0.2 },
  { key: 'turn', label: 'Head motion sequence', threshold: 0.34, neutralThreshold: 0.18 },
  { key: 'smile', label: 'Smile', threshold: 0.42, neutralThreshold: 0.2 },
]

const EMPTY_SIGNALS: FaceSignals = {
  hasFace: false,
  blink: 0,
  smile: 0,
  turn: 0,
  yaw: 0,
  faceScale: 0,
  quality: 0,
  bbox: null,
}

type Phase = 'idle' | 'preparing' | 'challenge' | 'analyzing' | 'complete' | 'error'
type DisplayResult = VerificationSession | (VerificationResult & { id: string })
type SourceIntegrity = 'physical' | 'virtual' | 'unknown' | 'demo'

const challengeIcons: Record<ChallengeKey, typeof Eye> = {
  blink: Eye,
  turn: ScanFace,
  smile: SmilePlus,
}

const MOTION_STEPS: Array<{ key: HeadMotionStage; label: string; icon: typeof Eye }> = [
  { key: 'center', label: 'Center', icon: Focus },
  { key: 'right', label: 'Right', icon: ArrowRight },
  { key: 'left', label: 'Left', icon: ArrowLeft },
  { key: 'recenter', label: 'Recenter', icon: Focus },
  { key: 'depth', label: 'Near / far', icon: Maximize2 },
]

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function identifySource(label: string): SourceIntegrity {
  if (!label) return 'unknown'
  return /obs|virtual|manycam|snap camera|ndi|droidcam/i.test(label) ? 'virtual' : 'physical'
}

function challengeResults(definitions: ChallengeDefinition[] = CHALLENGES): ChallengeResult[] {
  return definitions.map(({ key, label }) => ({ key, label, passed: false, peak: 0 }))
}

export function VerificationView({ onSaved }: { onSaved: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [signals, setSignals] = useState<FaceSignals>(EMPTY_SIGNALS)
  const [challenges, setChallenges] = useState<ChallengeResult[]>(challengeResults())
  const [activeChallenge, setActiveChallenge] = useState(0)
  const [challengePrompt, setChallengePrompt] = useState('Look straight with a neutral expression')
  const [motionStage, setMotionStage] = useState<HeadMotionStage>('center')
  const [modelProgress, setModelProgress] = useState(0)
  const [message, setMessage] = useState('Camera and AI models are processed on this device.')
  const [result, setResult] = useState<DisplayResult | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [sourceIntegrity, setSourceIntegrity] = useState<SourceIntegrity>('unknown')

  const stopCamera = () => {
    runningRef.current = false
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => stopCamera, [])

  const reset = () => {
    stopCamera()
    setPhase('idle')
    setSignals(EMPTY_SIGNALS)
    setChallenges(challengeResults())
    setActiveChallenge(0)
    setChallengePrompt('Look straight with a neutral expression')
    setMotionStage('center')
    setModelProgress(0)
    setResult(null)
    setIsDemo(false)
    setSourceIntegrity('unknown')
    setMessage('Camera and AI models are processed on this device.')
  }

  const runAttackDemo = async () => {
    reset()
    setIsDemo(true)
    setSourceIntegrity('demo')
    setPhase('preparing')
    setMessage('Running a labelled attack simulation. No camera frames are used.')
    setSignals({ ...EMPTY_SIGNALS, hasFace: true, quality: 0.88 })
    const working = challengeResults()
    const peaks = [0.91, 0.78, 0.89]

    await wait(450)
    setPhase('challenge')
    for (let index = 0; index < working.length; index += 1) {
      setActiveChallenge(index)
      setChallengePrompt(working[index].label)
      setMessage(`Simulating challenge ${index + 1} of ${working.length}...`)
      await wait(480)
      working[index] = { ...working[index], passed: true, peak: peaks[index] }
      setChallenges(working.map((item) => ({ ...item })))
    }

    setActiveChallenge(working.length)
    setPhase('analyzing')
    setModelProgress(100)
    setMessage('Applying the high-risk attack test profile...')
    await wait(650)

    const verification: VerificationResult = {
      source: 'camera',
      decision: 'fake',
      deepfake_probability: 0.94,
      liveness_score: 1,
      quality_score: 0.88,
      latency_ms: 2530,
      runtime: 'attack-simulation',
      model_version: 'demo-attack-profile-v1',
      challenges: working,
      notes: 'Clearly labelled simulated attack for demonstration only; no camera frames were analyzed.',
    }

    try {
      const saved = await createSession(verification)
      setResult(saved)
      onSaved()
    } catch {
      setResult({ ...verification, id: 'DEMO-UNSAVED' })
    }
    setMessage('Simulated deepfake attack detected. Demonstration only.')
    setPhase('complete')
  }

  const completeVerification = async (
    samples: HTMLCanvasElement[],
    completedChallenges: ChallengeResult[],
    qualityValues: number[],
    startedAt: number,
    detectedSource: SourceIntegrity,
    deviceLabel: string,
  ) => {
    setPhase('analyzing')
    setMessage('Comparing facial texture across captured frames...')
    let fakeProbability = 0.5
    let modelAvailable = true
    let notes = `Three active liveness challenges completed. Source integrity: ${detectedSource}; device: ${deviceLabel || 'unavailable'}.`

    try {
      fakeProbability = await classifyFaceSamples(samples, (event) => {
        if (typeof event.progress === 'number') setModelProgress(Math.min(100, event.progress))
      })
    } catch (error) {
      modelAvailable = false
      notes = `Classifier unavailable; routed to manual review. ${error instanceof Error ? error.message : ''}`.trim()
    }

    const livenessScore = completedChallenges.filter((item) => item.passed).length / completedChallenges.length
    const qualityScore = qualityValues.reduce((sum, item) => sum + item, 0) / Math.max(1, qualityValues.length)
    const verification: VerificationResult = {
      source: 'camera',
      decision: decideVerification({
        deepfakeProbability: fakeProbability,
        livenessScore,
        qualityScore,
        modelAvailable,
        sourceIntegrity: detectedSource === 'demo' ? 'unknown' : detectedSource,
      }),
      deepfake_probability: fakeProbability,
      liveness_score: livenessScore,
      quality_score: qualityScore,
      latency_ms: Math.round(performance.now() - startedAt),
      runtime: modelRuntime(),
      model_version: DEEPFAKE_MODEL_VERSION,
      challenges: completedChallenges,
      notes,
    }

    try {
      const saved = await createSession(verification)
      setResult(saved)
      onSaved()
    } catch {
      setResult({ ...verification, id: 'LOCAL-UNSAVED' })
    }
    setPhase('complete')
    setMessage(
      detectedSource === 'virtual'
        ? 'Virtual camera input detected and flagged as a source-integrity risk.'
        : 'Verification complete.',
    )
  }

  const start = async () => {
    reset()
    setPhase('preparing')
    setMessage('Preparing camera and local inference engines...')
    const startedAt = performance.now()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const deviceLabel = stream.getVideoTracks()[0]?.label ?? ''
      const detectedSource = identifySource(deviceLabel)
      setSourceIntegrity(detectedSource)
      const video = videoRef.current
      if (!video) throw new Error('Camera surface is unavailable.')
      video.srcObject = stream
      await video.play()

      const modelPromise = warmDeepfakeModel((event) => {
        if (typeof event.progress === 'number') setModelProgress(Math.min(100, event.progress))
      })
      void modelPromise.catch(() => undefined)
      const landmarker = await loadFaceLandmarker()
      const sequence = CHALLENGES
      const working = challengeResults(sequence)
      setChallenges(working.map((item) => ({ ...item })))
      const samples: HTMLCanvasElement[] = []
      const qualityValues: number[] = []
      let challengeIndex = 0
      let tracker = createLivenessTracker()
      let headMotionTracker = createHeadMotionTracker()
      let lastInference = 0
      runningRef.current = true
      setPhase('challenge')
      setChallengePrompt('Look straight with a neutral expression')
      setMessage('Respond to each prompt after the neutral-face check.')

      const loop = () => {
        if (!runningRef.current) return
        const now = performance.now()
        if (video.readyState >= 2 && now - lastInference >= 75) {
          lastInference = now
          const faceResult = landmarker.detectForVideo(video, now)
          const nextSignals = readFaceSignals(faceResult)
          setSignals(nextSignals)

          if (nextSignals.hasFace) {
            qualityValues.push(nextSignals.quality)
            const challenge = sequence[challengeIndex]
            let challengePassed = false

            if (challenge.key === 'turn') {
              const previousStage = headMotionTracker.stage
              const update = updateHeadMotionTracker(
                headMotionTracker,
                nextSignals.yaw,
                nextSignals.faceScale,
                nextSignals.quality,
              )
              headMotionTracker = update.tracker
              setMotionStage(headMotionTracker.stage)
              working[challengeIndex].peak = Math.max(working[challengeIndex].peak, update.progress)
              challengePassed = update.passed
              if (headMotionTracker.stage !== previousStage) {
                setChallengePrompt(headMotionPrompt(headMotionTracker.stage))
              }
            } else {
              const value = nextSignals[challenge.key]
              working[challengeIndex].peak = Math.max(working[challengeIndex].peak, value)
              const previousStage = tracker.stage
              const update = updateLivenessTracker(challenge, tracker, value, nextSignals.quality)
              tracker = update.tracker
              challengePassed = update.passed
              if (tracker.stage !== previousStage) {
                setChallengePrompt(tracker.stage === 'release' ? 'Open your eyes' : challenge.label)
              }
            }
            setChallenges(working.map((item) => ({ ...item })))

            if (challengePassed) {
              working[challengeIndex].passed = true
              samples.push(captureVideoFrame(video))
              setChallenges(working.map((item) => ({ ...item })))
              challengeIndex += 1
              tracker = createLivenessTracker()
              headMotionTracker = createHeadMotionTracker()
              setMotionStage('center')
              setActiveChallenge(challengeIndex)
              if (challengeIndex >= CHALLENGES.length) {
                runningRef.current = false
                void completeVerification(samples, working, qualityValues, startedAt, detectedSource, deviceLabel)
                return
              }
              setChallengePrompt(
                sequence[challengeIndex].key === 'turn'
                  ? headMotionPrompt('center')
                  : 'Look straight with a neutral expression',
              )
            }
          } else {
            tracker = createLivenessTracker()
            headMotionTracker = createHeadMotionTracker()
            setMotionStage('center')
            setChallengePrompt('Center your face and hold still')
          }
        }
        animationRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (error) {
      stopCamera()
      setPhase('error')
      setMessage(error instanceof Error ? error.message : 'Camera initialization failed.')
    }
  }

  const resultHeadline = !result
    ? ''
    : isDemo
      ? `${percent(result.deepfake_probability)} confidence`
      : sourceIntegrity === 'virtual'
        ? 'Virtual camera detected'
        : result.decision === 'review'
          ? 'Borderline texture score'
          : result.decision === 'genuine'
            ? 'Live physical-camera response'
            : `${percent(result.deepfake_probability)} texture risk`
  const activeChallengeKey = challenges[Math.min(activeChallenge, challenges.length - 1)]?.key
  const motionStageIndex = MOTION_STEPS.findIndex((step) => step.key === motionStage)

  return (
    <main className="view-shell">
      <header className="view-header">
        <div><p className="eyebrow">Live verification</p><h1>Identity integrity check</h1></div>
        <span className="local-chip"><ShieldCheck size={15} /> Local processing</span>
      </header>

      <div className="verification-grid">
        <section className="camera-panel" aria-label="Camera verification">
          <video ref={videoRef} muted playsInline className="camera-video" />
          <div className={`face-guide ${signals.hasFace ? 'face-guide-detected' : ''}`} aria-hidden="true">
            <span className="corner corner-tl" /><span className="corner corner-tr" />
            <span className="corner corner-bl" /><span className="corner corner-br" />
          </div>
          {phase === 'idle' && (
            <div className="camera-empty"><Camera size={36} strokeWidth={1.5} /><strong>Camera ready</strong><span>No frames leave this browser.</span></div>
          )}
          {(phase === 'preparing' || phase === 'analyzing') && (
            <div className="camera-state"><LoaderCircle className="spin" size={28} /><strong>{isDemo ? 'Attack simulation' : phase === 'preparing' ? 'Loading local models' : 'Analyzing captured frames'}</strong><span>{modelProgress ? `${Math.round(modelProgress)}%` : 'Initializing'}</span></div>
          )}
          {phase === 'challenge' && (
            <div className="camera-instruction">
              <span>Verification step {Math.min(activeChallenge + 1, CHALLENGES.length)} of {CHALLENGES.length}</span>
              <strong>{signals.hasFace ? challengePrompt : 'Center your face and hold still'}</strong>
              {activeChallengeKey === 'turn' && (
                <div className="motion-guide" aria-label="Head motion instructions">
                  {MOTION_STEPS.map((step, index) => {
                    const Icon = step.icon
                    const state = index < motionStageIndex ? 'complete' : index === motionStageIndex ? 'active' : 'pending'
                    return (
                      <div className={`motion-guide-step ${state}`} key={step.key}>
                        <Icon size={18} aria-hidden="true" />
                        <span>{step.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {phase === 'complete' && result && (
            <div className="result-overlay">{isDemo && <span className="demo-label">Simulation only</span>}<StatusBadge value={result.decision} /><strong>{resultHeadline}</strong><span>{result.id}</span></div>
          )}
        </section>

        <aside className="signal-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Signal monitor</p><h2>Liveness sequence</h2></div>
            <span className={`face-state ${signals.hasFace ? 'online' : ''}`}>{isDemo ? 'Demo signal' : signals.hasFace ? 'Face found' : 'Waiting'}</span>
          </div>

          <div className="challenge-list">
            {challenges.map((challenge, index) => {
              const Icon = challengeIcons[challenge.key]
              const isActive = phase === 'challenge' && index === activeChallenge
              return (
                <div className={`challenge-row ${isActive ? 'active' : ''}`} key={challenge.key}>
                  <span className="challenge-icon">{challenge.passed ? <Check size={18} /> : <Icon size={18} />}</span>
                  <div><strong>{challenge.label}</strong><span>{challenge.passed ? 'Passed' : isActive ? 'In progress' : 'Pending'}</span></div>
                  <span className="challenge-peak">{percent(challenge.peak)}</span>
                </div>
              )
            })}
          </div>

          <div className="meter-group"><div className="meter-label"><span>Face quality</span><strong>{percent(signals.quality)}</strong></div><div className="meter"><span style={{ width: percent(signals.quality) }} /></div></div>

          {result && (
            <div className="score-summary">
              <div><span>Deepfake risk</span><strong>{percent(result.deepfake_probability)}</strong></div>
              <div><span>Liveness</span><strong>{percent(result.liveness_score)}</strong></div>
              <div><span>Source integrity</span><strong>{sourceIntegrity === 'virtual' ? 'Virtual camera' : sourceIntegrity === 'physical' ? 'Physical camera' : sourceIntegrity === 'demo' ? 'Simulation' : 'Unknown'}</strong></div>
              <div><span>Runtime</span><strong>{result.runtime}</strong></div>
            </div>
          )}

          <div className={`process-note ${phase === 'error' ? 'error' : ''}`}>
            {phase === 'error' ? <AlertTriangle size={16} /> : <span className="pulse-dot" />}
            <span>{message}</span>
          </div>

          {phase === 'idle' || phase === 'error' ? (
            <div className="button-stack">
              <button className="primary-button" type="button" onClick={() => void start()}><Camera size={18} /> Start verification</button>
              {phase === 'idle' && <button className="secondary-button" type="button" onClick={() => void runAttackDemo()}><ShieldAlert size={17} /> Simulate attack</button>}
            </div>
          ) : phase === 'complete' ? (
            <button className="secondary-button" type="button" onClick={reset}><RefreshCw size={17} /> New verification</button>
          ) : (
            <button className="secondary-button" type="button" onClick={reset}>Cancel</button>
          )}
        </aside>
      </div>

      <p className="research-note">Research prototype. Borderline or low-quality results are routed to human review and must not be used as the sole basis for an identity decision.</p>
    </main>
  )
}
