import { AlertTriangle, CheckCircle2, Database, Gauge, HardDrive, Server } from 'lucide-react'
import { CONTROLLED_EVALUATION_CASES } from '../data/evaluationCases'
import { calculateEvaluationMetrics } from '../lib/evaluation'

const metrics = calculateEvaluationMetrics(CONTROLLED_EVALUATION_CASES)

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function seconds(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(1)} s`
}

export function EvaluationView() {
  const genuine = CONTROLLED_EVALUATION_CASES.filter((item) => item.groundTruth === 'genuine')
  const fake = CONTROLLED_EVALUATION_CASES.filter((item) => item.groundTruth === 'fake')
  const genuineAccepted = genuine.filter((item) => item.decision === 'genuine').length
  const genuineFlagged = genuine.filter((item) => item.decision === 'fake').length
  const genuineReviewed = genuine.filter((item) => item.decision === 'review').length
  const fakeAccepted = fake.filter((item) => item.decision === 'genuine').length
  const fakeFlagged = fake.filter((item) => item.decision === 'fake').length
  const fakeReviewed = fake.filter((item) => item.decision === 'review').length

  return (
    <main className="view-shell">
      <header className="view-header">
        <div><p className="eyebrow">Research evidence</p><h1>Controlled evaluation</h1></div>
        <span className="local-chip"><CheckCircle2 size={15} /> Reproducible metrics</span>
      </header>

      <section className="evaluation-scope">
        <AlertTriangle size={19} />
        <div><strong>Prototype validation set</strong><span>Eight known-genuine physical-camera trials and three known-attack OBS replay trials. Unlabelled sessions and hardcoded attack simulations are excluded. These results validate the workflow, not generalization to unseen datasets.</span></div>
      </section>

      <section className="metrics-strip evaluation-metrics" aria-label="Controlled evaluation metrics">
        <div><span>Labelled trials</span><strong>{metrics.total}</strong></div>
        <div><span>Auto-decision coverage</span><strong>{percent(metrics.coverage)}</strong></div>
        <div><span>Covered-case accuracy</span><strong>{percent(metrics.accuracy)}</strong></div>
        <div><span>Attack recall</span><strong>{percent(metrics.recall)}</strong></div>
        <div><span>Median end-to-end</span><strong>{seconds(metrics.medianLatencyMs)}</strong></div>
      </section>

      <div className="evaluation-grid">
        <section className="confusion-panel">
          <div className="panel-heading"><div><p className="eyebrow">Decision outcomes</p><h2>Confusion matrix with review</h2></div></div>
          <div className="confusion-matrix" aria-label="Confusion matrix">
            <span className="matrix-axis">Predicted</span><strong>Genuine</strong><strong>High risk</strong><strong>Review</strong>
            <strong>Actual genuine</strong><span className="correct">{genuineAccepted}</span><span>{genuineFlagged}</span><span className="review-cell">{genuineReviewed}</span>
            <strong>Actual attack</strong><span>{fakeAccepted}</span><span className="correct">{fakeFlagged}</span><span className="review-cell">{fakeReviewed}</span>
          </div>
          <div className="metric-definitions">
            <div><span>Precision</span><strong>{percent(metrics.precision)}</strong></div>
            <div><span>Specificity</span><strong>{percent(metrics.specificity)}</strong></div>
            <div><span>F1-score</span><strong>{percent(metrics.f1)}</strong></div>
            <div><span>Correct including review</span><strong>{percent(metrics.overallCorrectRate)}</strong></div>
          </div>
        </section>

        <section className="resource-evidence">
          <div className="panel-heading"><div><p className="eyebrow">Measured locally</p><h2>Resource evidence</h2></div></div>
          <div className="resource-evidence-list">
            <div><Server size={18} /><span>FastAPI idle memory</span><strong>25.7 MiB</strong></div>
            <div><Gauge size={18} /><span>Mean metadata API response</span><strong>11.0 ms</strong></div>
            <div><Database size={18} /><span>SQLite file, 27 sessions</span><strong>32 KiB</strong></div>
            <div><HardDrive size={18} /><span>Static browser package</span><strong>59.5 MiB</strong></div>
          </div>
          <p className="resource-footnote">AI inference runs on the client through WebGPU or WASM. The server stores compact numeric records and does not receive camera frames. The first browser run downloads model assets; later runs use browser caching.</p>
        </section>
      </div>

      <section className="evaluation-table-panel">
        <div className="panel-heading"><div><p className="eyebrow">Trial inventory</p><h2>Controlled cases</h2></div><span>{metrics.reviewed} routed to review</span></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Case</th><th>Ground truth</th><th>Source</th><th>Decision</th><th>Texture risk</th><th>Quality</th><th>Latency</th></tr></thead>
            <tbody>
              {CONTROLLED_EVALUATION_CASES.map((item) => (
                <tr key={item.id}>
                  <td className="mono-cell">{item.id}</td><td>{item.groundTruth}</td><td>{item.scenario === 'physical-camera' ? 'Physical camera' : 'OBS replay'}</td><td>{item.decision === 'fake' ? 'High risk' : item.decision}</td><td>{percent(item.deepfakeRisk)}</td><td>{percent(item.quality)}</td><td>{seconds(item.latencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
