import {
  spinValueForPhase,
  speedForPhase,
  inclineForPhase,
  getSessionSegments,
  loadSessions,
  saveSessions,
  newId,
  deleteSessionById,
  validateFolderName,
  createFolder,
  renameFolder,
  moveSessionToFolder,
  deleteFolder,
  DEFAULT_RUN_SPEEDS,
  DEFAULT_RUN_INCLINES,
  DEFAULT_SPIN_VALUES,
  type Session,
  type SessionsData,
  type Folder,
  type RunSpeeds,
  type SpinValues,
} from '../sessions';
import { SPIN_PRESETS } from '../presets';
import { NativeModules } from 'react-native';

describe('spinValueForPhase', () => {
  const values: SpinValues = {
    warmupResistance: 1, warmupPower: 10,
    workResistance: 2, workPower: 20,
    restResistance: 3, restPower: 30,
    cooldownResistance: 4, cooldownPower: 40,
  };

  it('maps each phase to its resistance/power pair', () => {
    expect(spinValueForPhase('warmup', values)).toEqual({ resistance: 1, power: 10 });
    expect(spinValueForPhase('work', values)).toEqual({ resistance: 2, power: 20 });
    expect(spinValueForPhase('rest', values)).toEqual({ resistance: 3, power: 30 });
    expect(spinValueForPhase('cooldown', values)).toEqual({ resistance: 4, power: 40 });
  });

  it('maps circuitRest and finish to the rest values', () => {
    expect(spinValueForPhase('circuitRest', values)).toEqual({ resistance: 3, power: 30 });
    expect(spinValueForPhase('finish', values)).toEqual({ resistance: 3, power: 30 });
  });
});

describe('speedForPhase', () => {
  const speeds: RunSpeeds = { warmupSpeed: 3, workSpeed: 11, restSpeed: 6, cooldownSpeed: 5 };

  it('maps each phase to its speed', () => {
    expect(speedForPhase('warmup', speeds)).toBe(3);
    expect(speedForPhase('work', speeds)).toBe(11);
    expect(speedForPhase('rest', speeds)).toBe(6);
    expect(speedForPhase('cooldown', speeds)).toBe(5);
    expect(speedForPhase('circuitRest', speeds)).toBe(6);
    expect(speedForPhase('finish', speeds)).toBe(6);
  });
});

describe('inclineForPhase', () => {
  const inclines = { warmupIncline: 1, workIncline: 4, restIncline: 1.5, cooldownIncline: 1 };

  it('maps each phase to its incline', () => {
    expect(inclineForPhase('warmup', inclines)).toBe(1);
    expect(inclineForPhase('work', inclines)).toBe(4);
    expect(inclineForPhase('rest', inclines)).toBe(1.5);
    expect(inclineForPhase('cooldown', inclines)).toBe(1);
    expect(inclineForPhase('circuitRest', inclines)).toBe(1.5);
    expect(inclineForPhase('finish', inclines)).toBe(1.5);
  });
});

describe('getSessionSegments', () => {
  it('expands a circuit session via expandCircuit', () => {
    const session: Session = {
      id: '1', name: 'Circuit', folderId: 'f', mode: 'circuit',
      circuits: 2, warmup: 10, cooldown: 10, circuitRest: 5,
      intervals: [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }],
    };
    const segs = getSessionSegments(session);
    expect(segs.map(s => s.phase)).toEqual([
      'warmup', 'work', 'rest', 'circuitRest', 'work', 'rest', 'cooldown',
    ]);
  });

  it('expands an easy-mode session with no activityType via expandWorkout', () => {
    const session: Session = {
      id: '1', name: 'Plain', folderId: 'f', mode: 'easy',
      config: { warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 15 },
    };
    const segs = getSessionSegments(session);
    expect(segs.every(s => s.speed === undefined)).toBe(true);
    expect(segs.map(s => s.phase)).toEqual(['warmup', 'work', 'rest', 'work', 'rest', 'cooldown']);
  });

  it('expands an advanced-mode session via intervalsToSegments', () => {
    const session: Session = {
      id: '1', name: 'Adv', folderId: 'f', mode: 'advanced',
      intervals: [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }],
    };
    const segs = getSessionSegments(session);
    expect(segs.map(s => s.phase)).toEqual(['work', 'rest']);
  });

  it('applies run speed and incline for a run session', () => {
    const session: Session = {
      id: '1', name: 'Run', folderId: 'f', mode: 'easy', activityType: 'run',
      config: { warmup: 10, high: 20, low: 5, rounds: 1, cooldown: 10 },
      runSpeeds: DEFAULT_RUN_SPEEDS,
      runInclines: DEFAULT_RUN_INCLINES,
    };
    const segs = getSessionSegments(session);
    const work = segs.find(s => s.phase === 'work')!;
    expect(work.speed).toBe(DEFAULT_RUN_SPEEDS.workSpeed);
    expect(work.incline).toBe(DEFAULT_RUN_INCLINES.workIncline);
  });

  it('omits incline for a run session when inclineEnabled is false', () => {
    const session: Session = {
      id: '1', name: 'Run', folderId: 'f', mode: 'easy', activityType: 'run',
      config: { warmup: 10, high: 20, low: 5, rounds: 1, cooldown: 10 },
      runSpeeds: DEFAULT_RUN_SPEEDS,
      inclineEnabled: false,
    };
    const segs = getSessionSegments(session);
    const work = segs.find(s => s.phase === 'work')!;
    expect(work.speed).toBe(DEFAULT_RUN_SPEEDS.workSpeed);
    expect(work.incline).toBeUndefined();
  });

  it('defaults runInclines when inclineEnabled is not false and runInclines is missing', () => {
    const session: Session = {
      id: '1', name: 'Run', folderId: 'f', mode: 'easy', activityType: 'run',
      config: { warmup: 10, high: 20, low: 5, rounds: 1, cooldown: 10 },
      runSpeeds: DEFAULT_RUN_SPEEDS,
    };
    const segs = getSessionSegments(session);
    const work = segs.find(s => s.phase === 'work')!;
    expect(work.incline).toBe(DEFAULT_RUN_INCLINES.workIncline);
  });

  it('lets an advanced-mode interval override the session-level run speed', () => {
    const session: Session = {
      id: '1', name: 'Run', folderId: 'f', mode: 'advanced', activityType: 'run',
      intervals: [{ type: 'work', dur: 20, speed: 99 }],
      runSpeeds: DEFAULT_RUN_SPEEDS,
    };
    const segs = getSessionSegments(session);
    expect(segs[0].speed).toBe(99);
  });

  it('falls back to base segments for a run session missing runSpeeds', () => {
    const session: Session = {
      id: '1', name: 'Run', folderId: 'f', mode: 'easy', activityType: 'run',
      config: { warmup: 10, high: 20, low: 5, rounds: 1, cooldown: 10 },
    };
    const segs = getSessionSegments(session);
    expect(segs.every(s => s.speed === undefined)).toBe(true);
  });

  it('applies spin values using defaults when spinValues is missing', () => {
    const session: Session = {
      id: '1', name: 'Spin', folderId: 'f', mode: 'easy', activityType: 'spinning',
      config: { warmup: 10, high: 20, low: 5, rounds: 1, cooldown: 10 },
    };
    const segs = getSessionSegments(session);
    const work = segs.find(s => s.phase === 'work')!;
    expect(work.resistance).toBe(DEFAULT_SPIN_VALUES.workResistance);
    expect(work.power).toBe(DEFAULT_SPIN_VALUES.workPower);
  });

  it('applies explicit spin values for a spinning session', () => {
    const session: Session = {
      id: '1', name: 'Spin', folderId: 'f', mode: 'easy', activityType: 'spinning',
      config: { warmup: 10, high: 20, low: 5, rounds: 1, cooldown: 10 },
      spinValues: SPIN_PRESETS['5'],
    };
    const segs = getSessionSegments(session);
    const work = segs.find(s => s.phase === 'work')!;
    expect(work.resistance).toBe(SPIN_PRESETS['5'].workResistance);
    expect(work.power).toBe(SPIN_PRESETS['5'].workPower);
  });

  it('lets an advanced-mode interval override spin resistance/power', () => {
    const session: Session = {
      id: '1', name: 'Spin', folderId: 'f', mode: 'advanced', activityType: 'spinning',
      intervals: [{ type: 'work', dur: 20, resistance: 7, power: 200 }],
      spinValues: DEFAULT_SPIN_VALUES,
    };
    const segs = getSessionSegments(session);
    expect(segs[0].resistance).toBe(7);
    expect(segs[0].power).toBe(200);
  });
});

describe('loadSessions / saveSessions', () => {
  beforeEach(() => {
    jest.requireMock('expo-file-system').__files.clear();
  });

  it('returns an empty session list in the default folder when no file exists', async () => {
    const data = await loadSessions();
    expect(data.folders).toEqual([expect.objectContaining({ id: 'default', name: 'My Sessions' })]);
    expect(data.sessions).toEqual([]);
  });

  it('round-trips a SessionsData object through save/load', async () => {
    const data: SessionsData = {
      folders: [{ id: 'f1', name: 'Folder 1', createdAt: 1 }],
      sessions: [{ id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] }],
    };
    await saveSessions(data);
    expect(await loadSessions()).toEqual(data);
  });

  it('mirrors the saved data to the native workout sync bridge', async () => {
    const syncMock = jest.fn();
    NativeModules.WorkoutSync = { syncSessionsData: syncMock };

    const data: SessionsData = {
      folders: [{ id: 'f1', name: 'Folder 1', createdAt: 1 }],
      sessions: [{ id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] }],
    };
    await saveSessions(data);

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(syncMock.mock.calls[0][0])).toEqual(data);
  });

  it('migrates an old-format array of sessions without folderId into a default folder', async () => {
    const oldSessions = [
      { id: 's1', name: 'Old', mode: 'advanced', intervals: [] },
    ];
    jest.requireMock('expo-file-system').__files.set(
      'document/sessions_v2.json',
      JSON.stringify(oldSessions),
    );
    const data = await loadSessions();
    expect(data.folders).toHaveLength(1);
    expect(data.folders[0].id).toBe('default');
    expect(data.sessions[0].folderId).toBe('default');
  });

  it('wraps an old-format array of sessions that already have folderId without re-tagging them', async () => {
    const oldSessions = [
      { id: 's1', name: 'Old', folderId: 'custom', mode: 'advanced', intervals: [] },
    ];
    jest.requireMock('expo-file-system').__files.set(
      'document/sessions_v2.json',
      JSON.stringify(oldSessions),
    );
    const data = await loadSessions();
    expect(data.folders).toHaveLength(1);
    expect(data.folders[0].id).toBe('default');
    expect(data.sessions[0].folderId).toBe('custom');
  });
});

describe('newId', () => {
  it('returns a non-empty string', () => {
    expect(typeof newId()).toBe('string');
    expect(newId().length).toBeGreaterThan(0);
  });

  it('generates unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
  });
});

describe('deleteSessionById', () => {
  beforeEach(() => {
    jest.requireMock('expo-file-system').__files.clear();
  });

  it('removes the session with the given id and persists the change', async () => {
    const data: SessionsData = {
      folders: [{ id: 'f1', name: 'Folder', createdAt: 1 }],
      sessions: [
        { id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] },
        { id: 's2', name: 'S2', folderId: 'f1', mode: 'advanced', intervals: [] },
      ],
    };
    await saveSessions(data);
    const result = await deleteSessionById('s1');
    expect(result.sessions.map(s => s.id)).toEqual(['s2']);
    expect((await loadSessions()).sessions.map(s => s.id)).toEqual(['s2']);
  });

  it('is a no-op when the id does not exist', async () => {
    const data: SessionsData = {
      folders: [{ id: 'f1', name: 'Folder', createdAt: 1 }],
      sessions: [{ id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] }],
    };
    await saveSessions(data);
    const result = await deleteSessionById('does-not-exist');
    expect(result.sessions).toHaveLength(1);
  });
});

describe('validateFolderName', () => {
  const folders: Folder[] = [
    { id: 'f1', name: 'Cardio', createdAt: 1 },
    { id: 'f2', name: 'Strength', createdAt: 2 },
  ];

  it('rejects an empty name', () => {
    expect(validateFolderName('', folders)).toBe(false);
  });

  it('rejects a whitespace-only name', () => {
    expect(validateFolderName('   ', folders)).toBe(false);
  });

  it('rejects a duplicate name case-insensitively', () => {
    expect(validateFolderName('cardio', folders)).toBe(false);
    expect(validateFolderName('CARDIO', folders)).toBe(false);
  });

  it('accepts a new, non-duplicate name', () => {
    expect(validateFolderName('Yoga', folders)).toBe(true);
  });

  it('accepts a name matching a folder when that folder is excluded (renaming itself)', () => {
    expect(validateFolderName('Cardio', folders, 'f1')).toBe(true);
  });

  it('still rejects a name matching a different folder when excluding self', () => {
    expect(validateFolderName('Strength', folders, 'f1')).toBe(false);
  });
});

describe('createFolder', () => {
  it('creates a folder with a trimmed name and default "folder" icon', () => {
    const folder = createFolder('  My Folder  ');
    expect(folder.name).toBe('My Folder');
    expect(folder.icon).toBe('folder');
    expect(typeof folder.id).toBe('string');
    expect(typeof folder.createdAt).toBe('number');
  });

  it('accepts an explicit icon', () => {
    const folder = createFolder('Runs', 'run');
    expect(folder.icon).toBe('run');
  });
});

describe('renameFolder', () => {
  const folders: Folder[] = [
    { id: 'f1', name: 'Cardio', createdAt: 1, icon: 'flame' },
    { id: 'f2', name: 'Strength', createdAt: 2 },
  ];

  it('renames and re-icons the target folder on success', () => {
    const result = renameFolder('f1', 'New Name', 'star', folders);
    expect(result.success).toBe(true);
    expect(result.folders?.find(f => f.id === 'f1')).toEqual({
      id: 'f1', name: 'New Name', createdAt: 1, icon: 'star',
    });
    expect(result.folders?.find(f => f.id === 'f2')).toEqual(folders[1]);
  });

  it('fails with an error when the new name duplicates another folder', () => {
    const result = renameFolder('f1', 'Strength', 'star', folders);
    expect(result).toEqual({ success: false, error: 'Folder name is empty or already exists' });
  });

  it('fails when the new name is empty', () => {
    const result = renameFolder('f1', '   ', 'star', folders);
    expect(result.success).toBe(false);
  });
});

describe('moveSessionToFolder', () => {
  it('moves only the matching session to the target folder', () => {
    const data: SessionsData = {
      folders: [],
      sessions: [
        { id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] },
        { id: 's2', name: 'S2', folderId: 'f1', mode: 'advanced', intervals: [] },
      ],
    };
    const result = moveSessionToFolder('s1', 'f2', data);
    expect(result.sessions[0].folderId).toBe('f2');
    expect(result.sessions[1].folderId).toBe('f1');
  });
});

describe('deleteFolder', () => {
  it('throws when trying to delete the last remaining folder', () => {
    const data: SessionsData = {
      folders: [{ id: 'f1', name: 'Only', createdAt: 1 }],
      sessions: [],
    };
    expect(() => deleteFolder('f1', null, data)).toThrow('Cannot delete the last folder');
  });

  it('deletes the folder and moves its sessions to the target folder when given one', () => {
    const data: SessionsData = {
      folders: [
        { id: 'f1', name: 'A', createdAt: 1 },
        { id: 'f2', name: 'B', createdAt: 2 },
      ],
      sessions: [
        { id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] },
        { id: 's2', name: 'S2', folderId: 'f2', mode: 'advanced', intervals: [] },
      ],
    };
    const result = deleteFolder('f1', 'f2', data);
    expect(result.folders.map(f => f.id)).toEqual(['f2']);
    expect(result.sessions.find(s => s.id === 's1')?.folderId).toBe('f2');
    expect(result.sessions.find(s => s.id === 's2')?.folderId).toBe('f2');
  });

  it('deletes the folder and its sessions when no target folder is given', () => {
    const data: SessionsData = {
      folders: [
        { id: 'f1', name: 'A', createdAt: 1 },
        { id: 'f2', name: 'B', createdAt: 2 },
      ],
      sessions: [
        { id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] },
        { id: 's2', name: 'S2', folderId: 'f2', mode: 'advanced', intervals: [] },
      ],
    };
    const result = deleteFolder('f1', null, data);
    expect(result.folders.map(f => f.id)).toEqual(['f2']);
    expect(result.sessions.map(s => s.id)).toEqual(['s2']);
  });
});
