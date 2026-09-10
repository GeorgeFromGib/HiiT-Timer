import { buildSessionFromDraft, validateDraft } from '../sessionDraft';
import type { RunSpeeds, RunInclines, SpinValues } from '../sessions';
import type { Interval } from '../workout';

const easyConfig = { warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 15 };
const runSpeeds: RunSpeeds = { warmupSpeed: 3, workSpeed: 5, restSpeed: 3, cooldownSpeed: 2.5 };
const runInclines: RunInclines = { warmupIncline: 1, workIncline: 2, restIncline: 1, cooldownIncline: 0.5 };
const spinValues: SpinValues = {
  warmupResistance: 2, warmupPower: 50,
  workResistance: 3, workPower: 90,
  restResistance: 2, restPower: 50,
  cooldownResistance: 2, cooldownPower: 60,
};
const intervals: Interval[] = [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }];

const baseInput = {
  mode: 'easy' as const,
  name: 'Basic HIIT',
  existingId: undefined,
  folderId: 'folder1',
  intervals,
  easyConfig,
  activityType: undefined,
  runSpeeds,
  runInclines,
  inclineEnabled: false,
  cooldownTaper: false,
  spinValues: undefined,
  circuitData: undefined,
};

describe('buildSessionFromDraft', () => {
  it('builds a circuit session, ignoring easy/activity fields', () => {
    const circuitData = { warmup: 30, cooldown: 30, circuits: 3, circuitRest: 20 };
    const session = buildSessionFromDraft({
      ...baseInput, mode: 'circuit', name: 'My Circuit', circuitData,
    });
    expect(session).toEqual({
      id: expect.any(String),
      name: 'My Circuit',
      folderId: 'folder1',
      mode: 'circuit',
      intervals,
      circuits: 3,
      warmup: 30,
      cooldown: 30,
      circuitRest: 20,
    });
  });

  it('builds an easy-mode session with no activityType', () => {
    const session = buildSessionFromDraft(baseInput);
    expect(session).toEqual({
      id: expect.any(String),
      name: 'Basic HIIT',
      folderId: 'folder1',
      mode: 'easy',
      config: easyConfig,
    });
  });

  it('builds an advanced-mode session with a run activityType', () => {
    const session = buildSessionFromDraft({
      ...baseInput, mode: 'advanced', name: 'Treadmill Run', activityType: 'run', inclineEnabled: true,
    });
    expect(session).toEqual({
      id: expect.any(String),
      name: 'Treadmill Run',
      folderId: 'folder1',
      activityType: 'run',
      runSpeeds,
      runInclines,
      inclineEnabled: true,
      mode: 'advanced',
      intervals,
    });
  });

  it('sets cooldownTaper on a run session only when the flag is on', () => {
    const on = buildSessionFromDraft({
      ...baseInput, mode: 'easy', name: 'Taper Run', activityType: 'run', cooldownTaper: true,
    });
    expect(on).toMatchObject({ activityType: 'run', cooldownTaper: true });

    const off = buildSessionFromDraft({
      ...baseInput, mode: 'easy', name: 'Plain Run', activityType: 'run', cooldownTaper: false,
    });
    expect(off).not.toHaveProperty('cooldownTaper');
  });

  it('sets cooldownTaper on a spinning session only when the flag is on', () => {
    const on = buildSessionFromDraft({
      ...baseInput, mode: 'easy', name: 'Taper Spin', activityType: 'spinning', spinValues, cooldownTaper: true,
    });
    expect(on).toMatchObject({ activityType: 'spinning', cooldownTaper: true });

    const off = buildSessionFromDraft({
      ...baseInput, mode: 'easy', name: 'Plain Spin', activityType: 'spinning', spinValues, cooldownTaper: false,
    });
    expect(off).not.toHaveProperty('cooldownTaper');
  });

  it('never sets cooldownTaper on a session that is neither run nor spinning', () => {
    const session = buildSessionFromDraft({ ...baseInput, cooldownTaper: true });
    expect(session).not.toHaveProperty('cooldownTaper');
  });

  it('builds a spinning session when spinValues is provided', () => {
    const session = buildSessionFromDraft({
      ...baseInput, mode: 'advanced', name: 'Spin Class', activityType: 'spinning', spinValues,
    });
    expect(session).toMatchObject({ activityType: 'spinning', spinValues });
  });

  it('throws when activityType is spinning but spinValues is undefined', () => {
    expect(() =>
      buildSessionFromDraft({ ...baseInput, mode: 'advanced', name: 'Spin Class', activityType: 'spinning' }),
    ).toThrow('spinValues must be provided for spinning sessions');
  });

  it('reuses an existing id when provided instead of generating a new one', () => {
    const session = buildSessionFromDraft({ ...baseInput, existingId: 'existing-id-123' });
    expect(session.id).toBe('existing-id-123');
  });

  it('builds an advanced session with undefined activityType (standard)', () => {
    const session = buildSessionFromDraft({ ...baseInput, mode: 'advanced', name: 'Standard' });
    expect(session).toEqual({
      id: expect.any(String),
      name: 'Standard',
      folderId: 'folder1',
      mode: 'advanced',
      intervals,
    });
  });

  it('is unaffected by the order in which input fields are specified', () => {
    // Regression guard for the old positional-argument signature, where two same-typed
    // adjacent params (e.g. runSpeeds/spinValues) could be silently transposed.
    const reordered = {
      folderId: 'folder1',
      spinValues: undefined,
      inclineEnabled: true,
      runInclines,
      existingId: 'fixed-id',
      runSpeeds,
      activityType: 'run' as const,
      intervals,
      easyConfig,
      name: 'Treadmill Run',
      mode: 'advanced' as const,
      circuitData: undefined,
    };
    expect(buildSessionFromDraft(reordered)).toEqual(buildSessionFromDraft({
      ...baseInput, mode: 'advanced', name: 'Treadmill Run', activityType: 'run', inclineEnabled: true, existingId: 'fixed-id',
    }));
  });
});

describe('validateDraft', () => {
  it('rejects a blank name', () => {
    expect(validateDraft('', 'easy', { length: 0 })).toEqual({
      ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage',
    });
  });

  it('rejects a whitespace-only name', () => {
    const result = validateDraft('   ', 'easy', { length: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects advanced mode with no intervals', () => {
    expect(validateDraft('My Session', 'advanced', { length: 0 })).toEqual({
      ok: false, titleKey: 'alerts.noIntervalsTitle', messageKey: 'alerts.noIntervalsMessage',
    });
  });

  it('accepts advanced mode with at least one interval', () => {
    expect(validateDraft('My Session', 'advanced', { length: 1 })).toEqual({ ok: true });
  });

  it('rejects circuit mode with no work interval', () => {
    expect(validateDraft('My Circuit', 'circuit', { length: 1 }, false)).toEqual({
      ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage',
    });
  });

  it('accepts circuit mode when hasWorkInterval is true (default)', () => {
    expect(validateDraft('My Circuit', 'circuit', { length: 1 })).toEqual({ ok: true });
  });

  it('accepts easy mode regardless of interval length', () => {
    expect(validateDraft('My Session', 'easy', { length: 0 })).toEqual({ ok: true });
  });

  it('checks name before mode-specific validation', () => {
    const result = validateDraft('', 'advanced', { length: 0 });
    expect(result).toEqual({ ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' });
  });
});
