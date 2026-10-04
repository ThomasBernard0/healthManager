import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessGate } from './core/access/AccessGate'
import { ToastProvider } from './core/ui/Toast'
import DayPage from './modules/food/pages/DayPage'
import GoalPage from './modules/food/pages/GoalPage'
import { GOAL_PATH } from './modules/food/routes'

export default function App() {
  return (
    <AccessGate>
      <ToastProvider>
        <Routes>
          <Route path="/jour" element={<DayPage />} />
          <Route path="/jour/:date" element={<DayPage />} />
          <Route path={GOAL_PATH} element={<GoalPage />} />
          <Route path="*" element={<Navigate to="/jour" replace />} />
        </Routes>
      </ToastProvider>
    </AccessGate>
  )
}
