import type { ImageClassificationPipeline } from '@huggingface/transformers'

const MODEL_ID = 'onnx-community/Deep-Fake-Detector-v2-Model-ONNX'
let classifierPromise: Promise<ImageClassificationPipeline> | null = null
let selectedRuntime = 'browser-wasm-q8'

export interface ModelProgress {
  progress?: number
  file?: string
  status?: string
}

export function warmDeepfakeModel(onProgress?: (progress: ModelProgress) => void) {
  if (!classifierPromise) {
    const hasWebGpu = 'gpu' in navigator
    selectedRuntime = hasWebGpu ? 'webgpu-q4f16' : 'browser-wasm-q8'
    classifierPromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('image-classification', MODEL_ID, {
        device: hasWebGpu ? 'webgpu' : 'wasm',
        dtype: hasWebGpu ? 'q4f16' : 'q8',
        progress_callback: (event) => onProgress?.(event as ModelProgress),
      }),
    )
  }
  return classifierPromise
}

export function modelRuntime(): string {
  return selectedRuntime
}

export async function classifyFaceSamples(
  samples: HTMLCanvasElement[],
  onProgress?: (progress: ModelProgress) => void,
): Promise<number> {
  const classifier = await warmDeepfakeModel(onProgress)
  const scores: number[] = []
  for (const sample of samples) {
    const output = await classifier(sample, { top_k: 2 })
    const fake = output.find((item) => item.label.toLowerCase().includes('deepfake'))
    scores.push(fake?.score ?? 0.5)
  }
  return scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length)
}

export const DEEPFAKE_MODEL_VERSION = 'Deep-Fake-Detector-v2-ONNX-quantized'
