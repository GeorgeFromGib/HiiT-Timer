import { readJsonFile, writeJsonFile } from './jsonFile';
import { syncSessionsData } from './workoutSync';
import type { Interval, Segment, WorkoutConfig, Phase } from './workout';
import { expandWorkout, intervalsToSegments, expandCircuit } from './workout';
import { i18n, type Language } from './i18n';
import { SPEED_PRESETS, SPIN_PRESETS, INCLINE_PRESETS } from './presets';
import { INTENSITY_PRESETS } from './intensityPresets';

export type FolderIconName =
  | 'sun' | 'flame' | 'bolt' | 'pauseIcon' | 'snow'
  | 'standard' | 'run' | 'walk' | 'circuit' | 'spinning'
  | 'user' | 'users'
  | 'folder' | 'folderOpen' | 'star' | 'heart' | 'tag' | 'bookmark' | 'flag'
  | 'target' | 'calendar' | 'pin' | 'archive' | 'grid' | 'list' | 'bell' | 'lock' | 'share' | 'home';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  icon?: FolderIconName;
}

export interface SessionsData {
  folders: Folder[];
  sessions: Session[];
}

export interface RunSpeeds {
  warmupSpeed: number;
  workSpeed: number;
  restSpeed: number;
  cooldownSpeed: number;
}

export const DEFAULT_RUN_SPEEDS: RunSpeeds = SPEED_PRESETS['3'];

// Treadmill-only incline axis (% grade), kept separate from RunSpeeds since RunSpeeds is
// shared with Outdoor Walk, which has no incline control.
export interface RunInclines {
  warmupIncline:   number;
  workIncline:     number;
  restIncline:     number;
  cooldownIncline: number;
}

export const DEFAULT_RUN_INCLINES: RunInclines = INCLINE_PRESETS['3'];

export interface SpinValues {
  warmupResistance:   number;
  warmupPower:        number;
  workResistance:     number;
  workPower:          number;
  restResistance:     number;
  restPower:          number;
  cooldownResistance: number;
  cooldownPower:      number;
}

export const DEFAULT_SPIN_VALUES: SpinValues = {
  warmupResistance:   3,  warmupPower:   85,
  workResistance:     5,  workPower:     120,
  restResistance:     2,  restPower:     60,
  cooldownResistance: 3,  cooldownPower: 85,
};

export function spinValueForPhase(phase: Phase, values: SpinValues): { resistance: number; power: number } {
  const map: Record<Phase, { resistance: number; power: number }> = {
    warmup:      { resistance: values.warmupResistance,   power: values.warmupPower   },
    work:        { resistance: values.workResistance,     power: values.workPower     },
    rest:        { resistance: values.restResistance,     power: values.restPower     },
    cooldown:    { resistance: values.cooldownResistance, power: values.cooldownPower },
    circuitRest: { resistance: values.restResistance,     power: values.restPower     },
    finish:      { resistance: values.restResistance,     power: values.restPower     },
  };
  return map[phase];
}

export type Session =
  | { id: string; name: string; folderId: string; activityType?: 'run' | 'walk' | 'spinning'; runSpeeds?: RunSpeeds; runInclines?: RunInclines; inclineEnabled?: boolean; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; folderId: string; activityType?: 'run' | 'walk' | 'spinning'; runSpeeds?: RunSpeeds; runInclines?: RunInclines; inclineEnabled?: boolean; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; folderId: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number };

export function speedForPhase(phase: Phase, speeds: RunSpeeds): number {
  const map: Record<Phase, number> = {
    warmup:      speeds.warmupSpeed,
    work:        speeds.workSpeed,
    rest:        speeds.restSpeed,
    cooldown:    speeds.cooldownSpeed,
    circuitRest: speeds.restSpeed,
    finish:      speeds.restSpeed,
  };
  return map[phase];
}

export function inclineForPhase(phase: Phase, inclines: RunInclines): number {
  const map: Record<Phase, number> = {
    warmup:      inclines.warmupIncline,
    work:        inclines.workIncline,
    rest:        inclines.restIncline,
    cooldown:    inclines.cooldownIncline,
    circuitRest: inclines.restIncline,
    finish:      inclines.restIncline,
  };
  return map[phase];
}

// Merges per-activity-type values onto each segment. `intervals` supplies per-interval
// overrides in advanced mode (undefined in easy mode, where there's nothing to override).
function withActivityValues<T extends object>(
  base: Segment[],
  intervals: Interval[] | undefined,
  valueForPhase: (phase: Phase, override: Interval | undefined) => T,
): (Segment & T)[] {
  return base.map((seg, i) => ({ ...seg, ...valueForPhase(seg.phase, intervals?.[i]) }));
}

export function getSessionSegments(session: Session): Segment[] {
  if (session.mode === 'circuit') {
    return expandCircuit(session.intervals, session.circuits, session.warmup, session.cooldown, session.circuitRest);
  }
  const base = session.mode === 'advanced'
    ? intervalsToSegments(session.intervals)
    : expandWorkout(session.config);
  const overrides = session.mode === 'advanced' ? session.intervals : undefined;

  if (session.activityType === 'run' && session.runSpeeds) {
    const runSpeeds = session.runSpeeds;
    if (session.inclineEnabled === false) {
      return withActivityValues(base, overrides, (phase, iv) => ({
        speed: iv?.speed ?? speedForPhase(phase, runSpeeds),
      }));
    }
    const runInclines = session.runInclines ?? DEFAULT_RUN_INCLINES;
    return withActivityValues(base, overrides, (phase, iv) => ({
      speed:   iv?.speed   ?? speedForPhase(phase, runSpeeds),
      incline: iv?.incline ?? inclineForPhase(phase, runInclines),
    }));
  }
  if (session.activityType === 'walk' && session.runSpeeds) {
    const runSpeeds = session.runSpeeds;
    return withActivityValues(base, overrides, (phase, iv) => ({
      speed: iv?.speed ?? speedForPhase(phase, runSpeeds),
    }));
  }
  if (session.activityType === 'spinning') {
    const sv = session.spinValues ?? DEFAULT_SPIN_VALUES;
    return withActivityValues(base, overrides, (phase, iv) => {
      const defaults = spinValueForPhase(phase, sv);
      return {
        resistance: iv?.resistance ?? defaults.resistance,
        power:      iv?.power      ?? defaults.power,
      };
    });
  }
  return base;
}

const SESSIONS_FILE = 'sessions_v2.json';

export function getDefaultSessions(language: Language = 'en'): Session[] {
  return [
    {
      id: 'default-1',
      name: i18n.t('defaultSessions.example1', { locale: language }),
      folderId: 'default',
      mode: 'easy',
      config: { warmup: 45, high: 45, low: 15, rounds: 13, cooldown: 60 },
    },
    {
      id: 'default-2',
      name: i18n.t('defaultSessions.example2', { locale: language }),
      folderId: 'default',
      mode: 'advanced',
      intervals: [
        { type: 'warmup',   dur: 20 },
        { type: 'work',     dur: 20 },
        { type: 'rest',     dur: 10 },
        { type: 'work',     dur: 30 },
        { type: 'rest',     dur: 15 },
        { type: 'work',     dur: 20 },
        { type: 'rest',     dur: 10 },
        { type: 'cooldown', dur: 30 },
      ],
    },
    {
      id: 'default-run-2',
      name: i18n.t('defaultSessions.example3', { locale: language }),
      folderId: 'default',
      mode: 'easy',
      activityType: 'run',
      config: { warmup: 300, high: 45, low: 15, rounds: 5, cooldown: 300 },
      runSpeeds: SPEED_PRESETS['3'],
      runInclines: INCLINE_PRESETS['3'],
    },
    {
      id: 'default-circuit-1',
      name: i18n.t('defaultSessions.circuit1', { locale: language }),
      folderId: 'default',
      mode: 'circuit',
      circuits: 3,
      warmup: 60,
      cooldown: 60,
      circuitRest: 30,
      intervals: [
        { type: 'work', dur: 40, activityLabel: 'Push-ups' },
        { type: 'rest', dur: 20 },
        { type: 'work', dur: 40, activityLabel: 'Squats' },
        { type: 'rest', dur: 20 },
        { type: 'work', dur: 40, activityLabel: 'Plank' },
        { type: 'rest', dur: 20 },
      ],
    },
    {
      id: 'default-spinning-1',
      name: i18n.t('defaultSessions.spinning1', { locale: language }),
      folderId: 'default',
      mode: 'easy',
      activityType: 'spinning',
      config: { warmup: 300, high: INTENSITY_PRESETS['3'].work, low: INTENSITY_PRESETS['3'].rest, rounds: 5, cooldown: 300 },
      spinValues: SPIN_PRESETS['3'],
    },
  ];
}

function createDefaultFolder(): Folder {
  return {
    id: 'default',
    name: 'My Sessions',
    createdAt: Date.now(),
    icon: 'home',
  };
}

function migrateSessionsToFolders(oldSessions: Session[]): SessionsData {
  // If sessions don't have folderId, they're from old format
  const needsMigration = oldSessions.some(s => !('folderId' in s));

  if (!needsMigration) {
    // Already migrated or new install
    return {
      folders: [createDefaultFolder()],
      sessions: oldSessions,
    };
  }

  // Old format: migrate to new
  const defaultFolder = createDefaultFolder();
  const migratedSessions = oldSessions.map(s => ({
    ...s,
    folderId: 'default',
  })) as Session[];

  return {
    folders: [defaultFolder],
    sessions: migratedSessions,
  };
}

export async function loadSessions(language: Language = 'en'): Promise<SessionsData> {
  const parsed = await readJsonFile<Session[] | SessionsData>(SESSIONS_FILE);
  if (!parsed) {
    return { folders: [createDefaultFolder()], sessions: getDefaultSessions(language) };
  }
  if (Array.isArray(parsed)) {
    return migrateSessionsToFolders(parsed);
  }
  return parsed;
}

export async function saveSessions(data: SessionsData): Promise<void> {
  writeJsonFile(SESSIONS_FILE, data);
  syncSessionsData(data);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function deleteSessionById(id: string): Promise<SessionsData> {
  const data = await loadSessions();
  const next: SessionsData = { ...data, sessions: data.sessions.filter(s => s.id !== id) };
  await saveSessions(next);
  return next;
}

export function validateFolderName(
  name: string,
  allFolders: Folder[],
  excludeFolderId?: string
): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;

  const isDuplicate = allFolders.some(
    f => f.name.toLowerCase() === trimmed.toLowerCase() &&
         (!excludeFolderId || f.id !== excludeFolderId)
  );

  return !isDuplicate;
}

export function createFolder(name: string, icon: FolderIconName = 'folder'): Folder {
  return {
    id: newId(),
    name: name.trim(),
    createdAt: Date.now(),
    icon,
  };
}

export function renameFolder(
  folderId: string,
  newName: string,
  icon: FolderIconName,
  currentFolders: Folder[]
): { success: boolean; error?: string; folders?: Folder[] } {
  if (!validateFolderName(newName, currentFolders, folderId)) {
    return {
      success: false,
      error: 'Folder name is empty or already exists',
    };
  }

  const updated = currentFolders.map(f =>
    f.id === folderId ? { ...f, name: newName.trim(), icon } : f
  );

  return { success: true, folders: updated };
}

export function moveSessionToFolder(
  sessionId: string,
  folderId: string,
  data: SessionsData
): SessionsData {
  return {
    ...data,
    sessions: data.sessions.map(s =>
      s.id === sessionId ? { ...s, folderId } : s
    ),
  };
}

export function deleteFolder(
  folderId: string,
  moveSessionsToFolderId: string | null,
  data: SessionsData
): SessionsData {
  // Prevent deleting the last folder
  if (data.folders.length === 1) {
    throw new Error('Cannot delete the last folder');
  }

  const updatedFolders = data.folders.filter(f => f.id !== folderId);

  let updatedSessions = data.sessions;
  if (moveSessionsToFolderId) {
    // Move sessions to another folder
    updatedSessions = data.sessions.map(s =>
      s.folderId === folderId ? { ...s, folderId: moveSessionsToFolderId } : s
    );
  } else {
    // Delete sessions in this folder
    updatedSessions = data.sessions.filter(s => s.folderId !== folderId);
  }

  return {
    folders: updatedFolders,
    sessions: updatedSessions,
  };
}
