/** Musculation home (Accueil). */
export const MUSCU_PATH = '/muscu'

/** Mes exercices. */
export const EXERCISES_PATH = '/muscu/exercices'

export const NEW_EXERCISE_PATH = '/muscu/exercices/nouveau'

/** Fiche exercice. */
export const exercisePath = (id: string): string => `/muscu/exercices/${id}`

/** Modifier l'exercice. */
export const editExercisePath = (id: string): string => `/muscu/exercices/${id}/modifier`

/** Nouvelle séance (in the active program). */
export const NEW_WORKOUT_PATH = '/muscu/seances/nouvelle'

/** Nouvelle séance in this program. */
export const newWorkoutPath = (programId: string): string => `${NEW_WORKOUT_PATH}?programme=${programId}`

/** Programme: its séances and exercises. */
export const programPath = (id: string): string => `/muscu/programmes/${id}`

/** Modifier la séance. */
export const workoutPath = (id: string): string => `/muscu/seances/${id}`

/** Séance — liste (the session in progress). */
export const sessionPath = (sessionId: string): string => `/muscu/seance/${sessionId}`

/** Exercice en cours. */
export const sessionExercisePath = (sessionId: string, entryId: string): string =>
  `/muscu/seance/${sessionId}/${entryId}`

/** Superset en cours, by its first exercise (A). */
export const sessionSupersetPath = (sessionId: string, entryId: string): string =>
  `/muscu/seance/${sessionId}/superset/${entryId}`
