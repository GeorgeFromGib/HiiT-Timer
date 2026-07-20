import { act, renderHook } from '@testing-library/react-native';
import { usePreStartCountdown } from '../usePreStartCountdown';

describe('usePreStartCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at null count until begin() is called', async () => {
    const { result } = await renderHook(() => usePreStartCountdown({ onComplete: jest.fn() }));
    expect(result.current.count).toBeNull();
    expect(result.current.isRunning()).toBe(false);
  });

  it('counts down 3, 2, 1 then completes', async () => {
    const onComplete = jest.fn();
    const onTick = jest.fn();
    const { result } = await renderHook(() => usePreStartCountdown({ onTick, onComplete }));

    await act(async () => result.current.begin());
    expect(result.current.count).toBe(3);
    expect(result.current.isRunning()).toBe(true);

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.count).toBe(2);

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.count).toBe(1);

    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.count).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning()).toBe(false);
  });

  it('calls onTick exactly once per beat, not once per 100ms tick', async () => {
    const onTick = jest.fn();
    const { result } = await renderHook(() => usePreStartCountdown({ onTick, onComplete: jest.fn() }));

    await act(async () => result.current.begin());
    await act(async () => { jest.advanceTimersByTime(900); }); // still beat 3, several 100ms ticks
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('cancel() stops the countdown and resets count to null', async () => {
    const onComplete = jest.fn();
    const { result } = await renderHook(() => usePreStartCountdown({ onComplete }));

    await act(async () => result.current.begin());
    expect(result.current.count).toBe(3);

    await act(async () => result.current.cancel());
    expect(result.current.count).toBeNull();
    expect(result.current.isRunning()).toBe(false);

    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('begin() restarts cleanly if called again mid-countdown', async () => {
    const { result } = await renderHook(() => usePreStartCountdown({ onComplete: jest.fn() }));

    await act(async () => result.current.begin());
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.count).toBe(2);

    await act(async () => result.current.begin());
    expect(result.current.count).toBe(3);
  });
});
