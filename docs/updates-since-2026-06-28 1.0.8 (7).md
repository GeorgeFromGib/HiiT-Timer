# Updates Since 2026-06-28

## Voice Announcements

- New `voiceCues` setting — toggleable in Settings screen
- `expo-speech` TTS module announces phase transitions aloud ("Work", "Recover", "Get Ready", etc.)
- Rest phase spoken as "Recover" rather than "Rest"
- Speech stops cleanly on session complete to prevent cutoff
- `Speech.stop()` awaited before each new utterance to prevent queuing
- Locale strings added for voice announcement labels (EN/ES/FR)
- Voice announcements wired into the audio hook alongside sound cues

## Activity Type Menu Animation

- Type selection dropdown animates open/close with a smooth height transition
- Locale strings updated for activity type labels

## Session Label Renames

- Default session labels shortened to concise activity names (e.g. labels trimmed of redundant suffixes)

## iOS / Build

- iOS build number bumped to 7
- Native `ios/` directory tracked in git
- Xcode 26 build issues resolved (LocalFrameworks added to `.gitignore`)
