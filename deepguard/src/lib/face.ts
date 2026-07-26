import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import type { FaceSignals } from '../types'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks('/wasm').then((vision) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
      }).catch(() =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
        }),
      ),
    )
  }
  return landmarkerPromise
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function categoryScore(result: FaceLandmarkerResult, name: string): number {
  const categories = result.faceBlendshapes[0]?.categories ?? []
  return categories.find((category) => category.categoryName === name)?.score ?? 0
}

function boundingBox(landmarks: NormalizedLandmark[]) {
  const xs = landmarks.map((point) => point.x)
  const ys = landmarks.map((point) => point.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function readFaceSignals(result: FaceLandmarkerResult): FaceSignals {
  const landmarks = result.faceLandmarks[0]
  if (!landmarks) {
    return { hasFace: false, blink: 0, smile: 0, turn: 0, yaw: 0, faceScale: 0, quality: 0, bbox: null }
  }

  const bbox = boundingBox(landmarks)
  const centerX = bbox.x + bbox.width / 2
  const centerY = bbox.y + bbox.height / 2
  const centering = clamp(1 - Math.hypot(centerX - 0.5, centerY - 0.48) / 0.45)
  const size = clamp(1 - Math.abs(bbox.height - 0.56) / 0.46)
  const quality = clamp(centering * 0.45 + size * 0.55)

  const nose = landmarks[1]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  const leftDistance = Math.abs(nose.x - leftCheek.x)
  const rightDistance = Math.abs(rightCheek.x - nose.x)
  const yaw = Math.max(
    -1,
    Math.min(1, (rightDistance - leftDistance) / Math.max(0.001, leftDistance + rightDistance) * 2.2),
  )

  return {
    hasFace: true,
    blink: Math.max(categoryScore(result, 'eyeBlinkLeft'), categoryScore(result, 'eyeBlinkRight')),
    smile: (categoryScore(result, 'mouthSmileLeft') + categoryScore(result, 'mouthSmileRight')) / 2,
    turn: Math.abs(yaw),
    yaw,
    faceScale: bbox.height,
    quality,
    bbox,
  }
}

export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const size = Math.max(1, Math.min(video.videoWidth, video.videoHeight))
  canvas.width = 384
  canvas.height = 384
  const x = Math.max(0, (video.videoWidth - size) / 2)
  const y = Math.max(0, (video.videoHeight - size) / 2)
  canvas.getContext('2d')?.drawImage(video, x, y, size, size, 0, 0, 384, 384)
  return canvas
}
