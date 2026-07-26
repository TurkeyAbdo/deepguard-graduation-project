import type { Decision, ReviewStatus } from '../types'

const labels: Record<Decision | ReviewStatus, string> = {
  genuine: 'Genuine',
  fake: 'High risk',
  review: 'Manual review',
  pending: 'Pending',
  cleared: 'Cleared',
  escalated: 'Escalated',
}

export function StatusBadge({ value }: { value: Decision | ReviewStatus }) {
  return <span className={`status status-${value}`}>{labels[value]}</span>
}
