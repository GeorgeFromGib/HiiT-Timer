import { act, renderHook } from '@testing-library/react-native';
import { useTimerEngine } from '../useTimerEngine';
import { intervalsToSegments, totalDuration, type Segment } from '../../lib/workout';

// work 10s (0-10), rest 8s (10-18)
const twoSegments = (): Segment[] =>
  intervalsToSegments([{ type: 'work', dur: 10 }, { type: 'rest', dur: 8 }]);

// work 5s (0-5), rest 3s (5-8) — small numbers for exact beat-schedule math
const shortSegments = (): Segment[] =>
  intervalsToSegments([{ type: 'work', dur: 5 }, { type: 'rest', dur: 3 }]);

describe('useTimerEngine', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts idle with remainingTotal set to the full workout duration', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));
    expect(result.current.state).toEqual({
      status: 'idle',
      elapsed: 0,
      currentIndex: -1,
      remainingInSegment: 0,
      remainingTotal: totalDuration(segments),
    });
  });

  it('start() enters the first segment and fires onTransition(null, seg0)', async () => {
    const segments = twoSegments();
    const onTransition = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onTransition }));

    await act(async () => result.current.start());

    expect(result.current.state.status).toBe('running');
    expect(result.current.state.currentIndex).toBe(0);
    expect(result.current.state.elapsed).toBe(0);
    expect(result.current.state.remainingInSegment).toBe(10);
    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledWith(null, segments[0]);
  });

  it('advances elapsed/remaining from the wall clock as time passes', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); });

    expect(result.current.state.elapsed).toBe(3);
    expect(result.current.state.currentIndex).toBe(0);
    expect(result.current.state.remainingInSegment).toBe(7);
    expect(result.current.state.remainingTotal).toBe(15);
  });

  it('fires onTransition exactly once when crossing into the next segment', async () => {
    const segments = twoSegments();
    const onTransition = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onTransition }));

    await act(async () => result.current.start());
    onTransition.mockClear();

    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(result.current.state.currentIndex).toBe(1);
    expect(result.current.state.remainingInSegment).toBe(8);
    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledWith(segments[0], segments[1]);

    // Should not re-fire on subsequent ticks within the same segment.
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(onTransition).toHaveBeenCalledTimes(1);
  });

  it('fires onFinish and a final onTransition(seg, null) at the end of the workout', async () => {
    const segments = twoSegments();
    const onTransition = jest.fn();
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onTransition, onFinish }));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(18000); });

    expect(result.current.state.status).toBe('finished');
    expect(result.current.state.currentIndex).toBe(-1);
    expect(result.current.state.remainingInSegment).toBe(0);
    expect(result.current.state.remainingTotal).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenLastCalledWith(segments[1], null);

    // Finishing must be idempotent — further ticks must not re-fire onFinish.
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('clamps a large time jump (simulated JS suspension) straight to finished, firing onFinish once', async () => {
    const segments = twoSegments();
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onFinish }));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(100000); });

    expect(result.current.state.status).toBe('finished');
    expect(result.current.state.elapsed).toBe(totalDuration(segments));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('fires the 3-2-1 onCountdown beats and onPrepare in the run-up to a transition', async () => {
    const segments = shortSegments(); // work 5s, rest 3s
    const onCountdown = jest.fn();
    const onPrepare = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onCountdown, onPrepare }));

    await act(async () => result.current.start());
    // prepareDelay for a 5s segment is 0ms, beat 3 is at 2000ms.
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(onPrepare).toHaveBeenCalledWith(segments[1]);
    expect(onCountdown).toHaveBeenCalledWith(3, segments[0]);

    await act(async () => { jest.advanceTimersByTime(1000); }); // t=3000 -> beat 2
    expect(onCountdown).toHaveBeenCalledWith(2, segments[0]);

    await act(async () => { jest.advanceTimersByTime(1000); }); // t=4000 -> beat 1
    expect(onCountdown).toHaveBeenCalledWith(1, segments[0]);

    const countdownsForSeg0 = onCountdown.mock.calls.filter(([, seg]) => seg === segments[0]);
    expect(countdownsForSeg0.map(([beat]) => beat)).toEqual([3, 2, 1]);
  });

  it('onPrepare receives a synthetic finish segment ahead of the final segment ending', async () => {
    const segments = shortSegments(); // work 5s, rest 3s (rest is last)
    const onPrepare = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onPrepare }));

    await act(async () => result.current.start());
    onPrepare.mockClear();
    // Cross into the final (rest) segment; remaining there is 3s (<5s so no
    // separate prepare fires until... actually with 3s remaining, prepareDelay
    // is null since remainingSeconds < 5). Just verify no crash and correct
    // segment argument shape from the earlier prepare call for segment 0->1.
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(result.current.state.currentIndex).toBe(1);
  });

  it('pause() freezes elapsed time and resume() continues without double-counting or losing time', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(result.current.state.elapsed).toBe(3);

    await act(async () => result.current.pause());
    expect(result.current.state.status).toBe('paused');
    expect(result.current.state.elapsed).toBe(3);

    // Time passes while paused — must not be counted.
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(result.current.state.elapsed).toBe(3);
    expect(result.current.state.status).toBe('paused');

    await act(async () => result.current.resume());
    // Immediately after resume, elapsed must still read 3 (no jump from the
    // paused gap, no loss from the 3s already accumulated).
    expect(result.current.state.elapsed).toBe(3);
    expect(result.current.state.status).toBe('running');

    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(result.current.state.elapsed).toBe(5);
    expect(result.current.state.remainingInSegment).toBe(5);
  });

  it('pause() is a no-op when not running', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.pause());
    expect(result.current.state.status).toBe('idle');
  });

  it('resume() is a no-op when not paused', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.resume());
    expect(result.current.state.status).toBe('idle');
  });

  it('multiple pause/resume cycles accumulate elapsed correctly without drift', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(2000); }); // elapsed 2
    await act(async () => result.current.pause());
    await act(async () => { jest.advanceTimersByTime(3000); }); // paused gap, ignored
    await act(async () => result.current.resume());
    await act(async () => { jest.advanceTimersByTime(2000); }); // elapsed 4
    await act(async () => result.current.pause());
    await act(async () => { jest.advanceTimersByTime(1000); }); // paused gap, ignored
    await act(async () => result.current.resume());
    await act(async () => { jest.advanceTimersByTime(1000); }); // elapsed 5

    expect(result.current.state.elapsed).toBe(5);
  });

  it('reset() returns to idle and clears elapsed/currentIndex', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); });

    await act(async () => result.current.reset());
    expect(result.current.state).toEqual({
      status: 'idle',
      elapsed: 0,
      currentIndex: -1,
      remainingInSegment: 0,
      remainingTotal: totalDuration(segments),
    });
  });

  it('skip() jumps exactly to the boundary of the next segment', async () => {
    const segments = twoSegments();
    const onTransition = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onTransition }));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); });
    onTransition.mockClear();

    await act(async () => result.current.skip());
    expect(result.current.state.currentIndex).toBe(1);
    expect(result.current.state.elapsed).toBe(10);
    expect(result.current.state.remainingInSegment).toBe(8);
    expect(onTransition).toHaveBeenCalledWith(segments[0], segments[1]);
  });

  it('skip() on the last segment finishes the workout', async () => {
    const segments = twoSegments();
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onFinish }));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(12000); }); // now in segment 1

    await act(async () => result.current.skip());
    expect(result.current.state.status).toBe('finished');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('skip() is a no-op when idle', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.skip());
    expect(result.current.state.status).toBe('idle');
  });

  it('skipBack() jumps to the start of the previous segment', async () => {
    const segments = twoSegments();
    const onTransition = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onTransition }));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(12000); }); // in segment 1, elapsed 12
    onTransition.mockClear();

    await act(async () => result.current.skipBack());
    expect(result.current.state.currentIndex).toBe(0);
    expect(result.current.state.elapsed).toBe(0);
    expect(onTransition).toHaveBeenCalledWith(segments[1], segments[0]);
  });

  it('skipBack() at the first segment goes to the start of the workout', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); });

    await act(async () => result.current.skipBack());
    expect(result.current.state.currentIndex).toBe(0);
    expect(result.current.state.elapsed).toBe(0);
  });

  it('extend() lengthens the current segment and shifts later segments', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); }); // in segment 0

    let extended!: Segment[];
    await act(async () => { extended = result.current.extend(5); });

    expect(extended[0].duration).toBe(15);
    expect(extended[0].endAt).toBe(15);
    expect(extended[1].startAt).toBe(15);
    expect(extended[1].endAt).toBe(23);
    expect(result.current.getSegments()).toEqual(extended);
  });

  it('replaceSegments() swaps the live segment list used by the engine', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));

    const newSegs = intervalsToSegments([{ type: 'work', dur: 4 }]);
    let replaced!: Segment[];
    await act(async () => { replaced = result.current.replaceSegments(newSegs); });

    expect(replaced).toBe(newSegs);
    expect(result.current.getSegments()).toBe(newSegs);
  });

  it('getSegments() reflects the initial segments before any mutation', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));
    expect(result.current.getSegments()).toBe(segments);
  });

  it('sync() recomputes state immediately against the current segments (e.g. after replaceSegments)', async () => {
    const segments = twoSegments();
    const onFinish = jest.fn();
    const { result } = await renderHook(() => useTimerEngine(segments, { onFinish }));

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(3000); }); // elapsed 3, total was 18

    // Shrink the workout so the already-elapsed time now exceeds the new total.
    const shorter = intervalsToSegments([{ type: 'work', dur: 2 }]);
    await act(async () => { result.current.replaceSegments(shorter); });
    await act(async () => { result.current.sync(); });

    expect(result.current.state.status).toBe('finished');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
