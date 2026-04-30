import { Route, Routes } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Analyzing } from './pages/Analyzing'
import { Calibration } from './pages/Calibration'
import { ScoreReveal } from './pages/ScoreReveal'
import { DashboardOverview } from './pages/DashboardOverview'
import { DashboardPrompts } from './pages/DashboardPrompts'
import { DashboardCompetitors } from './pages/DashboardCompetitors'
import { DashboardSettings } from './pages/DashboardSettings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/analyzing" element={<Analyzing />} />
      <Route path="/calibration" element={<Calibration />} />
      <Route path="/score-reveal" element={<ScoreReveal />} />
      <Route path="/dashboard" element={<DashboardOverview />} />
      <Route path="/dashboard/prompts" element={<DashboardPrompts />} />
      <Route path="/dashboard/competitors" element={<DashboardCompetitors />} />
      <Route path="/dashboard/settings" element={<DashboardSettings />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}

export default App
