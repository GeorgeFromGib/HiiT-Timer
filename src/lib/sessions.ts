import { readJsonFile, writeJsonFile } from './jsonFile';
import { syncSessionsData } from './workoutSync';
import type { Interval, Segment, WorkoutConfig, Phase } from './workout';
import { expandWorkout, intervalsToSegments, expandCircuit } from './workout';
import { type Language } from './i18n';
import { SPEED_PRESETS, INCLINE_PRESETS } from './presets';

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

// Treadmill-only incline axis (% grade), kept separate from RunSpeeds.
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

// circuitRest and finish always alias the rest value — encoded once here rather than
// repeated in each of the three phase-map functions below.
function expandPhaseMap<T>(warmup: T, work: T, rest: T, cooldown: T): Record<Phase, T> {
  return { warmup, work, rest, cooldown, circuitRest: rest, finish: rest };
}

export function spinValueForPhase(phase: Phase, values: SpinValues): { resistance: number; power: number } {
  return expandPhaseMap(
    { resistance: values.warmupResistance,   power: values.warmupPower   },
    { resistance: values.workResistance,     power: values.workPower     },
    { resistance: values.restResistance,     power: values.restPower     },
    { resistance: values.cooldownResistance, power: values.cooldownPower },
  )[phase];
}

// `cooldownTaper` (run sessions only): auto-ease speed & incline down through the
// cooldown, relative to the phase before it — replaces the flat cooldown values.
export type Session =
  | { id: string; name: string; folderId: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; runInclines?: RunInclines; inclineEnabled?: boolean; cooldownTaper?: boolean; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; folderId: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; runInclines?: RunInclines; inclineEnabled?: boolean; cooldownTaper?: boolean; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  // `tabata`: session created as the Tabata type — a circuit locked to the canonical
  // 8×(20s/10s) + 5-min warmup/cooldown protocol. Set once at creation, never toggled.
  // Editor/display-only flag — the expanded segments are an ordinary circuit, so
  // Swift/widgets need no change. ponytail: add to SessionDTO only if native ever needs
  // to show a "Tabata" badge.
  | { id: string; name: string; folderId: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number; tabata?: boolean };

export function speedForPhase(phase: Phase, speeds: RunSpeeds): number {
  return expandPhaseMap(speeds.warmupSpeed, speeds.workSpeed, speeds.restSpeed, speeds.cooldownSpeed)[phase];
}

export function inclineForPhase(phase: Phase, inclines: RunInclines): number {
  return expandPhaseMap(inclines.warmupIncline, inclines.workIncline, inclines.restIncline, inclines.cooldownIncline)[phase];
}

// ── Cooldown taper (docs/todo.md item 1) ─────────────────────────────────────
// Treadmill cooldown that continuously eases speed and incline down, relative to
// the phase that ran *immediately before* the cooldown — never the session max.
// Pure + unit-agnostic: speed percentages work identically for km/h or mph.
const COOLDOWN_SPEED_CURVE = [0.65, 0.55, 0.5, 0.45, 0.4]; // at 0 / 25 / 50 / 75 / 100 %
const SPEED_STEP = 0.1;   // km/h display precision (matches the speed picker)
const INCLINE_STEP = 0.5; // % display precision (matches the incline picker)

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const roundTo = (v: number, step: number) => {
  const inv = Math.round(1 / step); // 10 for 0.1, 2 for 0.5 — avoids float dust in v*inv/inv
  return Math.round(v * inv) / inv;
};

function lerpCurve(curve: number[], progress: number): number {
  const p = clamp01(progress);
  const span = 1 / (curve.length - 1);
  const i = Math.min(curve.length - 2, Math.floor(p / span));
  return curve[i] + (curve[i + 1] - curve[i]) * ((p - i * span) / span);
}

/**
 * Speed (km/h) and incline (%) to show at a point through the cooldown.
 * `progress` is 0 at the start of the cooldown and 1 at the end.
 * `baseIncline === undefined` → incline omitted (treadmill incline disabled).
 * Speed is floored at 40% of `baseSpeed` even after rounding; incline never < 0.
 */
export function cooldownTaper(
  baseSpeed: number,
  baseIncline: number | undefined,
  progress: number,
): { speed: number; incline?: number } {
  const floor = Math.ceil(baseSpeed * 0.4 * 10 - 1e-9) / 10; // 40% of base, snapped up to a 0.1 step
  const speed = Math.max(roundTo(lerpCurve(COOLDOWN_SPEED_CURVE, progress) * baseSpeed, SPEED_STEP), floor);
  if (baseIncline === undefined) return { speed };
  return { speed, incline: Math.max(0, roundTo(baseIncline * (1 - clamp01(progress)), INCLINE_STEP)) };
}

/**
 * Reference speed/incline for a cooldown taper: the last segment before
 * `cooldownIndex` that has a usable (non-zero) speed. Returns null when there is
 * none — the caller should then fall back to the flat cooldown value.
 */
export function cooldownBase(
  segments: Segment[],
  cooldownIndex: number,
): { speed: number; incline?: number } | null {
  for (let i = cooldownIndex - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.speed !== undefined && s.speed > 0) return { speed: s.speed, incline: s.incline };
  }
  return null;
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
    // Cooldown taper flag: per-interval in advanced mode, per-session in easy mode.
    const taperFor = (phase: Phase, iv: Interval | undefined) =>
      phase === 'cooldown'
        && (session.mode === 'advanced' ? !!iv?.cooldownTaper : !!session.cooldownTaper)
        ? { cooldownTaper: true } : {};
    if (session.inclineEnabled === false) {
      return withActivityValues(base, overrides, (phase, iv) => ({
        speed: iv?.speed ?? speedForPhase(phase, runSpeeds),
        ...taperFor(phase, iv),
      }));
    }
    const runInclines = session.runInclines ?? DEFAULT_RUN_INCLINES;
    return withActivityValues(base, overrides, (phase, iv) => ({
      speed:   iv?.speed   ?? speedForPhase(phase, runSpeeds),
      incline: iv?.incline ?? inclineForPhase(phase, runInclines),
      ...taperFor(phase, iv),
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
    return { folders: [createDefaultFolder()], sessions: [] };
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
