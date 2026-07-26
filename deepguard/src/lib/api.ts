import type { Decision, Metrics, ReviewStatus, VerificationResult, VerificationSession } from '../types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function createSession(result: VerificationResult): Promise<VerificationSession> {
  return request('/api/sessions', { method: 'POST', body: JSON.stringify(result) })
}

export function getSessions(decision?: Decision): Promise<VerificationSession[]> {
  const query = decision ? `?decision=${decision}` : ''
  return request(`/api/sessions${query}`)
}

export function getMetrics(): Promise<Metrics> {
  return request('/api/metrics')
}

export function updateReview(id: string, reviewStatus: ReviewStatus): Promise<VerificationSession> {
  return request(`/api/sessions/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ review_status: reviewStatus }),
  })
}
