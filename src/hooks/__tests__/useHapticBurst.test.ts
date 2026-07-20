import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useHapticBurst } from '../useHapticBurst';

describe('useHapticBurst', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not fire any haptics until start() is called', async () => {
    await renderHook(() => useHapticBurst());
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('start() fires a medium impact haptic every 150ms', async () => {
    const { result } = await renderHook(() => useHapticBurst());

    await act(async () => result.current.start());
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(150); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Medium);

    await act(async () => { jest.advanceTimersByTime(150); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it('stops automatically after BURST_COUNT (14) impacts', async () => {
    const { result } = await renderHook(() => useHapticBurst());

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(150 * 20); });

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(14);
  });

  it('cancel() stops the burst early', async () => {
    const { result } = await renderHook(() => useHapticBurst());

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(150 * 3); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);

    await act(async () => result.current.cancel());
    await act(async () => { jest.advanceTimersByTime(150 * 20); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
  });

  it('calling start() again mid-burst restarts the interval from zero', async () => {
    const { result } = await renderHook(() => useHapticBurst());

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(150 * 5); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(5);

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(150 * 14); });
    // 5 (first burst, before restart) + 14 (full second burst)
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(5 + 14);
  });

  it('cancel() is a no-op when called before start()', async () => {
    const { result } = await renderHook(() => useHapticBurst());
    await act(async () => result.current.cancel());
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('clears the interval on unmount so no further haptics fire', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { result, unmount } = await renderHook(() => useHapticBurst());

    await act(async () => result.current.start());
    await act(async () => { jest.advanceTimersByTime(150 * 2); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);

    await act(async () => { unmount(); });
    expect(clearIntervalSpy).toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(150 * 20); });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);

    clearIntervalSpy.mockRestore();
  });
});
