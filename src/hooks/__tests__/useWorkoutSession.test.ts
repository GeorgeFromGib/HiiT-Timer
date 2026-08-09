import { act, renderHook } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { useWorkoutSession } from '../useWorkoutSession';
import { intervalsToSegments, totalDuration, type Segment } from '../../lib/workout';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import { getCongratsMessages } from '../../lib/i18n';

// work 10s (0-10), rest 8s (10-18)
const twoSegments = (): Segment[] =>
  intervalsToSegments([{ type: 'work', dur: 10 }, { type: 'rest', dur: 8 }]);

// work 5s (0-5), rest 3s (5-8) — small numbers for exact beat-schedule math
const shortSegments = (): Segment[] =>
  intervalsToSegments([{ type: 'work', dur: 5 }, { type: 'rest', dur: 3 }]);

const withCooldown = (): Segment[] =>
  intervalsToSegments([{ type: 'work', dur: 10 }, { type: 'rest', dur: 8 }, { type: 'cooldown', dur: 5 }]);

/** Runs the 3-2-1 pre-start countdown to completion so the engine is 'running'. */
async function startWorkout(result: { current: ReturnType<typeof useWorkoutSession> }) {
  await act(async () => result.current.handlePlayPause());
  await act(async () => { jest.advanceTimersByTime(3000); });
}

describe('useWorkoutSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts idle with zeroed stats and a remainingTotal equal to the full workout', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    expect(result.current.status).toBe('idle');
    expect(result.current.preStartCount).toBeNull();
    expect(result.current.elapsed).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.remainingTotal).toBe(totalDuration(segments));
    expect(result.current.stats).toEqual({
      skippedCount: 0, skippedSecs: 0, skippedWorkSecs: 0,
      extendedSecs: 0, addedRoundSecs: 0,
      skipBackSecs: 0, skipBackWorkSecs: 0, skipBackWorkCount: 0,
    });
  });

  it('congratsMsg is one of the known congrats messages and stays stable across renders', async () => {
    const segments = twoSegments();
    const { result, rerender } = await renderHook(() => useWorkoutSession(segments));
    const msg = result.current.congratsMsg;
    expect(getCongratsMessages()).toContain(msg);

    await act(async () => { rerender(); });
    expect(result.current.congratsMsg).toBe(msg);
  });

  it('handlePlayPause from idle begins a 3-2-1 pre-start countdown, then starts the engine', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await act(async () => result.current.handlePlayPause());
    expect(result.current.status).toBe('preStart');
    expect(result.current.preStartCount).toBe(3);

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.preStartCount).toBe(2);

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.preStartCount).toBe(1);

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.preStartCount).toBeNull();
    expect(result.current.status).toBe('running');
    expect(result.current.currentIndex).toBe(0);
  });

  it('handlePlayPause during the pre-start countdown cancels it and returns to idle', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await act(async () => result.current.handlePlayPause());
    expect(result.current.status).toBe('preStart');

    await act(async () => result.current.handlePlayPause());
    expect(result.current.status).toBe('idle');
    expect(result.current.preStartCount).toBeNull();

    // The countdown must not silently complete later and auto-start the engine.
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(result.current.status).toBe('idle');
  });

  it('handlePlayPause pauses while running and resumes while paused', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await startWorkout(result);
    expect(result.current.status).toBe('running');

    await act(async () => result.current.handlePlayPause());
    expect(result.current.status).toBe('paused');

    await act(async () => result.current.handlePlayPause());
    expect(result.current.status).toBe('running');
  });

  it('reset() cancels any in-flight countdown/haptics and zeroes stats and engine state', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(3000); }); // elapsed 3
    await act(async () => result.current.skip()); // dirty the stats

    await act(async () => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.elapsed).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.stats.skippedCount).toBe(0);
  });

  it('skip() records stats (skippedCount, skippedSecs, skippedWorkSecs) and advances the engine', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(3000); }); // still in seg0 (work), remainingInSegment 7

    await act(async () => result.current.skip());

    expect(result.current.currentIndex).toBe(1); // advanced into rest
    expect(result.current.stats.skippedCount).toBe(1);
    expect(result.current.stats.skippedSecs).toBe(7);
    expect(result.current.stats.skippedWorkSecs).toBe(7); // seg0 was 'work'
  });

  it('skip() while idle is a no-op: engine does not move and stats are not recorded', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    expect(result.current.currentIndex).toBe(-1);
    await act(async () => result.current.skip());

    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.stats.skippedCount).toBe(0);
    expect(result.current.stats.skippedSecs).toBe(0);
  });

  it('skip() after finish is a no-op: stats are not recorded again', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(totalDuration(segments) * 1000); });
    expect(result.current.status).toBe('finished');

    const statsAtFinish = result.current.stats;
    await act(async () => result.current.skip());

    expect(result.current.stats).toEqual(statsAtFinish);
  });

  it('skipBack() records stats (skipBackSecs, skipBackWorkSecs, skipBackWorkCount)', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(12000); }); // now in seg1 (rest), elapsed 12

    await act(async () => result.current.skipBack());

    expect(result.current.currentIndex).toBe(0); // back to seg0 (work)
    // backSecs = ceil(elapsed(12) - prevSeg.startAt(0)) = 12; current seg (rest)
    // was not 'work', so the work-specific counters stay at 0.
    expect(result.current.stats.skipBackSecs).toBe(12);
    expect(result.current.stats.skipBackWorkSecs).toBe(0);
    expect(result.current.stats.skipBackWorkCount).toBe(0);
  });

  it('extend() records extendedSecs in stats and lengthens the current segment', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useWorkoutSession(segments));

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(3000); });

    let extended!: Segment[];
    await act(async () => { extended = result.current.extend(5); });

    expect(result.current.stats.extendedSecs).toBe(5);
    expect(extended[0].duration).toBe(15);
    expect(extended[0].endAt).toBe(15);
  });

  it('addRound() inserts segments before the trailing cooldown and records addedRoundSecs', async () => {
    const segments = withCooldown(); // work(0-10), rest(10-18), cooldown(18-23)
    const { result } = await renderHook(() => useWorkoutSession(segments));

    const toInsert = intervalsToSegments([{ type: 'work', dur: 5 }]);
    let newSegs!: Segment[];
    await act(async () => { newSegs = result.current.addRound(toInsert); });

    expect(newSegs.map(s => s.phase)).toEqual(['work', 'rest', 'work', 'cooldown']);
    expect(newSegs[2]).toMatchObject({ startAt: 18, endAt: 23, index: 2 });
    expect(newSegs[3]).toMatchObject({ startAt: 23, endAt: 28, index: 3 });
    expect(result.current.stats.addedRoundSecs).toBe(5);
  });

  it('addRound() appends at the end when there is no cooldown segment', async () => {
    const segments = twoSegments(); // work(0-10), rest(10-18), no cooldown
    const { result } = await renderHook(() => useWorkoutSession(segments));

    const toInsert = intervalsToSegments([{ type: 'work', dur: 5 }]);
    let newSegs!: Segment[];
    await act(async () => { newSegs = result.current.addRound(toInsert); });

    expect(newSegs.map(s => s.phase)).toEqual(['work', 'rest', 'work']);
    expect(newSegs[2]).toMatchObject({ startAt: 18, endAt: 23, index: 2 });
  });

  it('invokes onCountdownBeat exactly on the 3-2-1 beats fired by the engine', async () => {
    const segments = shortSegments(); // work 5s, rest 3s
    const onCountdownBeat = jest.fn();
    const { result } = await renderHook(() =>
      useWorkoutSession(segments, DEFAULT_SETTINGS, onCountdownBeat),
    );

    await startWorkout(result);
    // prepareDelay for a 5s segment is 0ms, beat3 at 2000ms, beat2 3000ms, beat1 4000ms.
    await act(async () => { jest.advanceTimersByTime(4000); });

    expect(onCountdownBeat).toHaveBeenCalledTimes(3);
  });

  it('fires the voice midpoint cue once elapsed passes the halfway point when enableMidpointCue is true', async () => {
    const segments = twoSegments(); // total 18s
    const settings = { ...DEFAULT_SETTINGS, voiceCues: true, soundOff: false };
    const { result } = await renderHook(() =>
      useWorkoutSession(segments, settings, undefined, true),
    );
    (Speech.speak as jest.Mock).mockClear();

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(9000); }); // exactly half of 18s
    // Flush the waitForCuesToClear() microtask chain inside onMidpoint.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const midpointCalls = (Speech.speak as jest.Mock).mock.calls.filter(([text]) => text === 'Midpoint reached');
    expect(midpointCalls).toHaveLength(1);

    // Must not fire a second time even as more time passes.
    await act(async () => { jest.advanceTimersByTime(5000); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const midpointCallsAfter = (Speech.speak as jest.Mock).mock.calls.filter(([text]) => text === 'Midpoint reached');
    expect(midpointCallsAfter).toHaveLength(1);
  });

  it('does not fire the midpoint cue when enableMidpointCue is false (default)', async () => {
    const segments = twoSegments();
    const settings = { ...DEFAULT_SETTINGS, voiceCues: true };
    const { result } = await renderHook(() => useWorkoutSession(segments, settings));
    (Speech.speak as jest.Mock).mockClear();

    await startWorkout(result);
    await act(async () => { jest.advanceTimersByTime(9000); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const midpointCalls = (Speech.speak as jest.Mock).mock.calls.filter(([text]) => text === 'Midpoint reached');
    expect(midpointCalls).toHaveLength(0);
  });

  it('accepts an initialResume and starts already running at that elapsed, skipping the pre-start countdown', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() =>
      useWorkoutSession(segments, DEFAULT_SETTINGS, undefined, false, { elapsed: 12, status: 'running' }));
    expect(result.current.status).toBe('running');
    expect(result.current.elapsed).toBe(12);
    expect(result.current.currentIndex).toBe(1);
  });

  it('accepts an initialResume with status paused and starts paused at that elapsed', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() =>
      useWorkoutSession(segments, DEFAULT_SETTINGS, undefined, false, { elapsed: 4, status: 'paused' }));
    expect(result.current.status).toBe('paused');
    expect(result.current.elapsed).toBe(4);
  });

  describe('applyIncomingLiveState', () => {
    it('pauses locally when told the remote is now paused', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);

      await act(async () => result.current.applyIncomingLiveState('paused', result.current.elapsed));
      expect(result.current.status).toBe('paused');
    });

    it('resumes locally when told the remote is now running', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);
      await act(async () => result.current.handlePlayPause()); // pause
      expect(result.current.status).toBe('paused');

      await act(async () => result.current.applyIncomingLiveState('running', result.current.elapsed));
      expect(result.current.status).toBe('running');
    });

    it('jumps elapsed to match a remote skip while running', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);

      await act(async () => result.current.applyIncomingLiveState('running', 15));
      expect(result.current.status).toBe('running');
      expect(result.current.elapsed).toBe(15);
      expect(result.current.currentIndex).toBe(1);
    });

    it('finishes locally when told the remote session finished, regardless of the reported elapsed', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);

      await act(async () => result.current.applyIncomingLiveState('finished', 5));
      expect(result.current.status).toBe('finished');
    });

    it('finishing from a remote update while paused is also a no-op the second time (idempotent)', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);
      await act(async () => result.current.handlePlayPause()); // pause

      await act(async () => result.current.applyIncomingLiveState('finished', 999));
      expect(result.current.status).toBe('finished');

      // Already finished — a bounced/duplicate 'finished' update must not throw or re-fire.
      await act(async () => result.current.applyIncomingLiveState('finished', 999));
      expect(result.current.status).toBe('finished');
    });
  });
});
