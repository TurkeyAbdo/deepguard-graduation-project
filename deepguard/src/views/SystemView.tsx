import { ArrowRight, Cpu, Database, Gauge, HardDrive, LockKeyhole, Monitor, Server } from 'lucide-react'

type NavigatorWithMemory = Navigator & { deviceMemory?: number }

export function SystemView() {
  const hasWebGpu = 'gpu' in navigator
  const memory = (navigator as NavigatorWithMemory).deviceMemory
  const cores = navigator.hardwareConcurrency || 1

  return (
    <main className="view-shell">
      <header className="view-header"><div><p className="eyebrow">Deployment</p><h1>System profile</h1></div><span className="local-chip"><LockKeyhole size={15} /> Privacy first</span></header>

      <section className="system-summary">
        <div className="system-lead">
          <p className="eyebrow">Current device</p>
          <h2>{hasWebGpu ? 'WebGPU acceleration available' : 'WASM compatibility mode'}</h2>
          <p>Inference runs in the browser. The local API stores only numeric results and review status in SQLite.</p>
        </div>
        <div className="resource-grid">
          <div><Cpu size={18} /><span>Logical cores</span><strong>{cores}</strong></div>
          <div><Gauge size={18} /><span>AI runtime</span><strong>{hasWebGpu ? 'WebGPU' : 'WASM'}</strong></div>
          <div><HardDrive size={18} /><span>Device memory</span><strong>{memory ? `${memory} GB+` : 'Browser managed'}</strong></div>
          <div><Database size={18} /><span>Server storage</span><strong>SQLite</strong></div>
        </div>
      </section>

      <section className="architecture-panel">
        <div className="panel-heading"><div><p className="eyebrow">Request path</p><h2>Lightweight architecture</h2></div><span className="architecture-label">No GPU server required</span></div>
        <div className="architecture-flow">
          <div className="architecture-node"><Monitor size={23} /><strong>Browser camera</strong><span>Frames remain local</span></div>
          <ArrowRight className="flow-arrow" size={20} />
          <div className="architecture-node"><Cpu size={23} /><strong>On-device AI</strong><span>MediaPipe + ONNX</span></div>
          <ArrowRight className="flow-arrow" size={20} />
          <div className="architecture-node"><Server size={23} /><strong>FastAPI service</strong><span>Small JSON records</span></div>
          <ArrowRight className="flow-arrow" size={20} />
          <div className="architecture-node"><Database size={23} /><strong>SQLite audit</strong><span>Sessions and reviews</span></div>
        </div>
      </section>

      <section className="model-table-panel">
        <div className="panel-heading"><div><p className="eyebrow">Inference inventory</p><h2>Models and resource strategy</h2></div></div>
        <div className="table-scroll">
          <table className="model-table">
            <thead><tr><th>Component</th><th>Runtime</th><th>Optimization</th><th>Server load</th></tr></thead>
            <tbody>
              <tr><td>Face landmarks</td><td>MediaPipe WASM</td><td>Float16 task model</td><td>None</td></tr>
              <tr><td>Liveness signals</td><td>Browser</td><td>Blink, expression, bidirectional head and depth motion</td><td>None</td></tr>
              <tr><td>Source integrity</td><td>Browser</td><td>Virtual-camera screening</td><td>None</td></tr>
              <tr><td>Deepfake classifier</td><td>{hasWebGpu ? 'WebGPU' : 'WASM'}</td><td>{hasWebGpu ? '4-bit weights; 72% high risk' : '8-bit weights; 72% high risk'}</td><td>None</td></tr>
              <tr><td>Session records</td><td>FastAPI</td><td>Numeric JSON only</td><td>Low</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="capacity-note"><strong>Scale strategy</strong><span>Static frontend files can be cached at the edge; inference capacity grows with client devices, while the server handles only compact metadata requests.</span></section>
    </main>
  )
}
