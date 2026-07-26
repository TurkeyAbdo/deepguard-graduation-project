import { CheckCircle2, ChevronDown, RefreshCw, ShieldAlert } from 'lucide-react'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { StatusBadge } from '../components/StatusBadge'
import { getMetrics, getSessions, updateReview } from '../lib/api'
import type { Decision, Metrics, VerificationSession } from '../types'

const EMPTY_METRICS: Metrics = {
  total: 0,
  genuine: 0,
  fake: 0,
  review: 0,
  avg_latency_ms: 0,
  avg_liveness: 0,
  daily: [],
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function SessionsView({ refreshToken }: { refreshToken: number }) {
  const [sessions, setSessions] = useState<VerificationSession[]>([])
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)
  const [filter, setFilter] = useState<'all' | Decision>('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSessions, nextMetrics] = await Promise.all([
        getSessions(filter === 'all' ? undefined : filter),
        getMetrics(),
      ])
      setSessions(nextSessions)
      setMetrics({
        ...nextMetrics,
        total: nextMetrics.total ?? 0,
        genuine: nextMetrics.genuine ?? 0,
        fake: nextMetrics.fake ?? 0,
        review: nextMetrics.review ?? 0,
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load, refreshToken])

  const review = async (session: VerificationSession, status: 'cleared' | 'escalated') => {
    const updated = await updateReview(session.id, status)
    setSessions((current) => current.map((item) => item.id === updated.id ? updated : item))
  }

  return (
    <main className="view-shell">
      <header className="view-header">
        <div><p className="eyebrow">Operations</p><h1>Verification sessions</h1></div>
        <button className="icon-button" type="button" title="Refresh sessions" onClick={() => void load()}><RefreshCw size={18} /></button>
      </header>

      <section className="metrics-strip" aria-label="Verification metrics">
        <div><span>Total sessions</span><strong>{metrics.total}</strong></div>
        <div><span>Genuine</span><strong>{metrics.genuine}</strong></div>
        <div><span>Flagged</span><strong>{metrics.fake}</strong></div>
        <div><span>Manual review</span><strong>{metrics.review}</strong></div>
        <div><span>Mean latency</span><strong>{Math.round(metrics.avg_latency_ms)} ms</strong></div>
      </section>

      <section className="chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">Last seven days</p><h2>Verification volume</h2></div></div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.daily} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
              <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} axisLine={false} tickLine={false} fontSize={11} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={11} />
              <Tooltip labelFormatter={(day) => String(day)} />
              <Area type="monotone" dataKey="total" stroke="#15171a" fill="#dfe3e7" strokeWidth={2} />
              <Area type="monotone" dataKey="flagged" stroke="#b42318" fill="#f5d9d6" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="sessions-panel">
        <div className="table-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Session filter">
            {(['all', 'genuine', 'fake', 'review'] as const).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'fake' ? 'Flagged' : value}</button>
            ))}
          </div>
          <span>{sessions.length} records</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead><tr><th>Session</th><th>Time</th><th>Decision</th><th>Fake risk</th><th>Liveness</th><th>Review</th><th aria-label="Details" /></tr></thead>
            <tbody>
              {sessions.map((session) => (
                <Fragment key={session.id}>
                  <tr>
                    <td className="mono-cell">{session.id}</td>
                    <td>{formatDate(session.created_at)}</td>
                    <td><StatusBadge value={session.decision} /></td>
                    <td>{Math.round(session.deepfake_probability * 100)}%</td>
                    <td>{Math.round(session.liveness_score * 100)}%</td>
                    <td><StatusBadge value={session.review_status} /></td>
                    <td><button className="row-toggle" type="button" title="Session details" aria-expanded={expanded === session.id} onClick={() => setExpanded(expanded === session.id ? null : session.id)}><ChevronDown size={17} /></button></td>
                  </tr>
                  {expanded === session.id && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <div className="session-detail">
                          <div><span>Runtime</span><strong>{session.runtime}</strong></div>
                          <div><span>Quality</span><strong>{Math.round(session.quality_score * 100)}%</strong></div>
                          <div><span>Latency</span><strong>{session.latency_ms} ms</strong></div>
                          <div className="review-actions">
                            <button type="button" onClick={() => void review(session, 'cleared')}><CheckCircle2 size={16} /> Clear</button>
                            <button type="button" onClick={() => void review(session, 'escalated')}><ShieldAlert size={16} /> Escalate</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && sessions.length === 0 && <tr><td colSpan={7} className="empty-table">No sessions match this filter.</td></tr>}
              {loading && <tr><td colSpan={7} className="empty-table">Loading sessions...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
