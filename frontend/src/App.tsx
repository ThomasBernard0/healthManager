import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { AccessGate } from './core/access/AccessGate'
import { ModalFrame } from './core/ui/ModalFrame'
import { ToastProvider } from './core/ui/Toast'
import { fr } from './i18n/fr'
import DayPage from './modules/food/pages/DayPage'
import GoalPage from './modules/food/pages/GoalPage'
import MealEditorPage from './modules/food/pages/MealEditorPage'
import MealsPage from './modules/food/pages/MealsPage'
import WeekPage from './modules/food/pages/WeekPage'
import { GOAL_PATH, MEALS_PATH } from './modules/food/routes'

export default function App() {
  const location = useLocation()
  // Opened with state.background: render that page underneath and this route as a dialog.
  const background = (location.state as { background?: Location } | null)?.background

  return (
    <AccessGate>
      <ToastProvider>
        <Routes location={background ?? location}>
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
        {background && (
          <Routes>
            <Route
              path={GOAL_PATH}
              element={
                <ModalFrame label={fr.goal.title}>
                  <GoalPage />
                </ModalFrame>
              }
            />
            <Route
              path={`${MEALS_PATH}/nouveau`}
              element={
                <ModalFrame label={fr.meal.newTitle}>
                  <MealEditorPage />
                </ModalFrame>
              }
            />
            <Route
              path={MEALS_PATH}
              element={
                <ModalFrame label={fr.add.myMeals}>
                  <MealsPage />
                </ModalFrame>
              }
            />
            <Route
              path={`${MEALS_PATH}/:id`}
              element={
                <ModalFrame label={fr.meal.editTitle}>
                  <MealEditorPage />
                </ModalFrame>
              }
            />
            <Route path="*" element={null} />
          </Routes>
        )}
      </ToastProvider>
    </AccessGate>
  )
}
