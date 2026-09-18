// ios/ClearHiiTWatch Watch App/WatchStrings.swift
import Foundation

/// General watch UI chrome (buttons, dialogs, empty states) that isn't part
/// of phaseWordsByLanguage (WorkoutModels.swift) or congratsMessagesByLanguage
/// (SessionRunView.swift) — same "small per-language dict, keyed by
/// Settings.language" pattern as those, mirroring the phone's equivalent
/// src/locales/*.ts strings where a matching one already exists there.
private let watchStringsByLanguage: [String: [String: String]] = [
  "en": [
    "start": "Start",
    "done": "Done",
    "circuit": "Circuit",
    "next": "Nxt",
    "incline": "inc",
    "endWorkoutTitle": "End Workout?",
    "endWorkout": "End Workout",
    "continue": "Continue",
    "sessions": "Sessions",
    "noSessionsSynced": "No sessions synced yet",
    "noSessionsInFolder": "No sessions in this folder",
  ],
  "es": [
    "start": "Empezar",
    "done": "Listo",
    "circuit": "Circuito",
    "next": "Sig",
    "incline": "incl",
    "endWorkoutTitle": "¿Terminar entrenamiento?",
    "endWorkout": "Terminar",
    "continue": "Continuar",
    "sessions": "Sesiones",
    "noSessionsSynced": "Aún no hay sesiones sincronizadas",
    "noSessionsInFolder": "No hay sesiones en esta carpeta",
  ],
  "fr": [
    "start": "Démarrer",
    "done": "Terminé",
    "circuit": "Circuit",
    "next": "Suiv",
    "incline": "incl",
    "endWorkoutTitle": "Terminer l'entraînement ?",
    "endWorkout": "Terminer",
    "continue": "Continuer",
    "sessions": "Séances",
    "noSessionsSynced": "Aucune séance synchronisée pour l'instant",
    "noSessionsInFolder": "Aucune séance dans ce dossier",
  ],
  "de": [
    "start": "Starten",
    "done": "Fertig",
    "circuit": "Zirkel",
    "next": "Weiter",
    "incline": "Stg",
    "endWorkoutTitle": "Workout beenden?",
    "endWorkout": "Beenden",
    "continue": "Fortsetzen",
    "sessions": "Einheiten",
    "noSessionsSynced": "Noch keine Einheiten synchronisiert",
    "noSessionsInFolder": "Keine Einheiten in diesem Ordner",
  ],
]

func watchString(_ key: String, forLanguage language: String) -> String {
  watchStringsByLanguage[language]?[key] ?? watchStringsByLanguage["en"]![key]!
}
