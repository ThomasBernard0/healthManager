import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessGate } from './core/access/AccessGate'
import { ToastProvider } from './core/ui/Toast'
import DayPage from './modules/food/pages/DayPage'
import GoalPage from './modules/food/pages/GoalPage'
import MealEditorPage from './modules/food/pages/MealEditorPage'
import MealsPage from './modules/food/pages/MealsPage'
import WeekPage from './modules/food/pages/WeekPage'
import { GOAL_PATH, MEALS_PATH } from './modules/food/routes'

export default function App() {
  return (
    <AccessGate>
      <ToastProvider>
        <Routes>
          <Route path="/jour" element={<DayPage />} />
          <Route path="/jour/:date" element={<DayPage />} />
          <Route path="/semaine" element={<WeekPage />} />
          <Route path="/semaine/:monday" element={<WeekPage />} />
          <Route path={GOAL_PATH} element={<GoalPage />} />
          <Route path={MEALS_PATH} element={<MealsPage />} />
          <Route path={`${MEALS_PATH}/nouveau`} element={<MealEditorPage />} />
          <Route path={`${MEALS_PATH}/:id`} element={<MealEditorPage />} />
          <Route path="*" element={<Navigate to="/jour" replace />} />
        </Routes>
      </ToastProvider>
    </AccessGate>
  )
}
