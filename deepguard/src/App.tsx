import { ChartNoAxesCombined, Cpu, ListChecks, ScanFace, ShieldCheck } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'

const VerificationView = lazy(() => import('./views/VerificationView').then((module) => ({ default: module.VerificationView })))
const SessionsView = lazy(() => import('./views/SessionsView').then((module) => ({ default: module.SessionsView })))
const SystemView = lazy(() => import('./views/SystemView').then((module) => ({ default: module.SystemView })))
const EvaluationView = lazy(() => import('./views/EvaluationView').then((module) => ({ default: module.EvaluationView })))

type View = 'verify' | 'sessions' | 'evaluation' | 'system'

const navigation = [
  { id: 'verify' as const, label: 'Verify', icon: ScanFace },
  { id: 'sessions' as const, label: 'Sessions', icon: ListChecks },
  { id: 'evaluation' as const, label: 'Evaluation', icon: ChartNoAxesCombined },
  { id: 'system' as const, label: 'System', icon: Cpu },
]

function App() {
  const [view, setView] = useState<View>('verify')
  const [refreshToken, setRefreshToken] = useState(0)

  const content = view === 'verify'
    ? <VerificationView onSaved={() => setRefreshToken((value) => value + 1)} />
    : view === 'sessions'
      ? <SessionsView refreshToken={refreshToken} />
      : view === 'evaluation'
        ? <EvaluationView />
        : <SystemView />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={23} /></span><div><strong>DEEPGUARD</strong><span>Identity integrity</span></div></div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={view === id ? 'active' : ''} key={id} type="button" onClick={() => setView(id)}><Icon size={19} /><span>{label}</span></button>
          ))}
        </nav>
        <div className="sidebar-status"><span className="status-light" /><div><strong>Local service</strong><span>Operational</span></div></div>
      </aside>

      <div className="main-column">
        <div className="mobile-topbar"><div className="brand"><span className="brand-mark"><ShieldCheck size={20} /></span><strong>DEEPGUARD</strong></div><span className="status-light" /></div>
        <Suspense fallback={<div className="view-loading">Loading workspace...</div>}>{content}</Suspense>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button className={view === id ? 'active' : ''} key={id} type="button" onClick={() => setView(id)}><Icon size={20} /><span>{label}</span></button>
        ))}
      </nav>
    </div>
  )
}

export default App
