/** Musculation home (Accueil). */
export const MUSCU_PATH = '/muscu'

/** The exercise bank. */
export const EXERCISES_PATH = '/muscu/exercices'

export const NEW_EXERCISE_PATH = '/muscu/exercices/nouveau'

/** Fiche exercice. */
export const exercisePath = (id: string): string => `/muscu/exercices/${id}`

/** Modifier l'exercice. */
export const editExercisePath = (id: string): string => `/muscu/exercices/${id}/modifier`
