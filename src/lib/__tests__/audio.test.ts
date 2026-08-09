import { act, renderHook } from '@testing-library/react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { configureAudioSession, useWorkoutAudio, type AudioSettings } from '../audio';
import { speakPhase, speakPrepare, speakComplete, speakMidpoint, isSpeaking } from '../speech';

jest.mock('../speech', () => ({
  speakPhase: jest.fn(),
  speakPrepare: jest.fn(),
  speakComplete: jest.fn(),
  speakMidpoint: jest.fn(),
  isSpeaking: jest.fn(async () => false),
}));

const mockedCreateAudioPlayer = jest.mocked(createAudioPlayer);
const mockedSetAudioModeAsync = jest.mocked(setAudioModeAsync);
const mockedSpeakPhase = jest.mocked(speakPhase);
const mockedSpeakPrepare = jest.mocked(speakPrepare);
const mockedSpeakComplete = jest.mocked(speakComplete);
const mockedSpeakMidpoint = jest.mocked(speakMidpoint);
const mockedIsSpeaking = jest.mocked(isSpeaking);

// Flush the microtask queue so fire-and-forget async chains (playCue, onFinish's
// speakComplete branch, etc.) settle before assertions run.
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const base: AudioSettings = {
  soundOff: false,
  soundCues: true,
  finalCountdownBeep: true,
  soundVolume: 100,
  voiceCues: false,
  minimalVoicePrompts: false,
  language: 'en',
};

// Mount-time effect creates players for chime, tick, finish, in that order.
function lastCreatedPlayer() {
  const results = mockedCreateAudioPlayer.mock.results;
  return results[results.length - 1].value;
}
function playerAt(index: number) {
  return mockedCreateAudioPlayer.mock.results[index].value;
}

describe('configureAudioSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('configures the audio session for background silent-mode playback', async () => {
    await configureAudioSession();
    expect(mockedSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
  });
});

describe('useWorkoutAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsSpeaking.mockResolvedValue(false);
  });

  it('eagerly creates chime, tick, and finish players on mount', async () => {
    await renderHook(() => useWorkoutAudio(base));
    expect(mockedCreateAudioPlayer).toHaveBeenCalledTimes(3);
  });

  describe('onTransition', () => {
    it('does nothing when transitioning to null (workout not yet started)', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      result.current.onTransition(null);
      await flush();
      expect(playerAt(0).play).not.toHaveBeenCalled(); // chime
      expect(mockedSpeakPhase).not.toHaveBeenCalled();
    });

    it('does nothing when soundOff is true, even if soundCues is true', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundOff: true }));
      result.current.onTransition('work');
      await flush();
      expect(playerAt(0).play).not.toHaveBeenCalled();
      expect(mockedSpeakPhase).not.toHaveBeenCalled();
    });

    it('does nothing when soundCues is false', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundCues: false }));
      result.current.onTransition('work');
      await flush();
      expect(playerAt(0).play).not.toHaveBeenCalled();
      expect(mockedSpeakPhase).not.toHaveBeenCalled();
    });

    it('plays the chime cue at the configured volume when voiceCues is off', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundVolume: 50 }));
      result.current.onTransition('work');
      await flush();
      const chime = playerAt(0);
      expect(chime.seekTo).toHaveBeenCalledWith(0);
      expect(chime.play).toHaveBeenCalledTimes(1);
      expect(chime.volume).toBe(0.5);
      expect(mockedSpeakPhase).not.toHaveBeenCalled();
    });

    it('speaks the phase name instead of playing a chime when voiceCues is on', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, voiceCues: true }));
      result.current.onTransition('rest');
      await flush();
      expect(mockedSpeakPhase).toHaveBeenCalledWith('rest', 'en');
      expect(playerAt(0).play).not.toHaveBeenCalled();
    });
  });

  describe('onCountdown', () => {
    it('plays the tick cue when finalCountdownBeep is enabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      result.current.onCountdown();
      await flush();
      expect(playerAt(1).play).toHaveBeenCalledTimes(1); // tick
    });

    it('is not gated by soundCues (still beeps when soundCues is off)', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundCues: false }));
      result.current.onCountdown();
      await flush();
      expect(playerAt(1).play).toHaveBeenCalledTimes(1);
    });

    it('does nothing when finalCountdownBeep is disabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, finalCountdownBeep: false }));
      result.current.onCountdown();
      await flush();
      expect(playerAt(1).play).not.toHaveBeenCalled();
    });

    it('does nothing when soundOff is true', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundOff: true }));
      result.current.onCountdown();
      await flush();
      expect(playerAt(1).play).not.toHaveBeenCalled();
    });
  });

  describe('onPrepare', () => {
    it('speaks the "prepare" cue when voiceCues is enabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, voiceCues: true }));
      result.current.onPrepare('cooldown');
      expect(mockedSpeakPrepare).toHaveBeenCalledWith('cooldown', 'en');
    });

    it('is not gated by soundCues (still speaks when soundCues is off)', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundCues: false, voiceCues: true }));
      result.current.onPrepare('work');
      expect(mockedSpeakPrepare).toHaveBeenCalledWith('work', 'en');
    });

    it('does nothing when voiceCues is disabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      result.current.onPrepare('work');
      expect(mockedSpeakPrepare).not.toHaveBeenCalled();
    });

    it('does nothing when soundOff is true, even if voiceCues is enabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundOff: true, voiceCues: true }));
      result.current.onPrepare('work');
      expect(mockedSpeakPrepare).not.toHaveBeenCalled();
    });
  });

  describe('onPreStartTick', () => {
    it('plays the tick cue when soundCues is enabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      result.current.onPreStartTick();
      await flush();
      expect(playerAt(1).play).toHaveBeenCalledTimes(1);
    });

    it('does nothing when soundCues is disabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundCues: false }));
      result.current.onPreStartTick();
      await flush();
      expect(playerAt(1).play).not.toHaveBeenCalled();
    });

    it('does nothing when soundOff is true', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundOff: true }));
      result.current.onPreStartTick();
      await flush();
      expect(playerAt(1).play).not.toHaveBeenCalled();
    });
  });

  describe('onFinish', () => {
    it('plays the finish cue and stops the keep-alive immediately when voiceCues is off', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      await act(async () => { await result.current.startKeepAlive(); });
      const keepAlivePlayer = lastCreatedPlayer();

      result.current.onFinish();
      await flush();

      expect(playerAt(2).play).toHaveBeenCalledTimes(1); // finish cue
      expect(keepAlivePlayer.pause).toHaveBeenCalledTimes(1);
      expect(keepAlivePlayer.remove).toHaveBeenCalledTimes(1);
    });

    it('defers stopping the keep-alive to the speech onDone callback when voiceCues is on', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, voiceCues: true }));
      await act(async () => { await result.current.startKeepAlive(); });
      const keepAlivePlayer = lastCreatedPlayer();

      result.current.onFinish();
      await flush();

      expect(mockedSpeakComplete).toHaveBeenCalledWith('en', expect.any(Function));
      expect(keepAlivePlayer.pause).not.toHaveBeenCalled();
      expect(playerAt(2).play).not.toHaveBeenCalled(); // no finish chime in voice mode

      const onDone = mockedSpeakComplete.mock.calls[0][1] as () => void;
      onDone();
      expect(keepAlivePlayer.pause).toHaveBeenCalledTimes(1);
      expect(keepAlivePlayer.remove).toHaveBeenCalledTimes(1);
    });

    it('still stops the keep-alive when sound is off entirely', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundOff: true }));
      await act(async () => { await result.current.startKeepAlive(); });
      const keepAlivePlayer = lastCreatedPlayer();

      result.current.onFinish();
      await flush();

      expect(mockedSpeakComplete).not.toHaveBeenCalled();
      expect(keepAlivePlayer.pause).toHaveBeenCalledTimes(1);
      expect(keepAlivePlayer.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('onMidpoint', () => {
    it('does nothing when voiceCues is disabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      result.current.onMidpoint();
      await flush();
      expect(mockedSpeakMidpoint).not.toHaveBeenCalled();
    });

    it('does nothing when soundOff is true, even if voiceCues is enabled', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, soundOff: true, voiceCues: true }));
      result.current.onMidpoint();
      await flush();
      expect(mockedSpeakMidpoint).not.toHaveBeenCalled();
    });

    it('speaks immediately when no cue is playing and speech is idle', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, voiceCues: true }));
      result.current.onMidpoint();
      await flush();
      expect(mockedSpeakMidpoint).toHaveBeenCalledWith('en');
    });

  });

  describe('onMidpoint polling (fake timers)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('polls until an in-progress beep clears before speaking', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, voiceCues: true }));
      const chime = playerAt(0);
      chime.playing = true; // simulate a beep still in progress

      await act(async () => { result.current.onMidpoint(); });
      expect(mockedSpeakMidpoint).not.toHaveBeenCalled();

      await act(async () => { jest.advanceTimersByTime(200); });
      expect(mockedSpeakMidpoint).not.toHaveBeenCalled(); // still "playing"

      chime.playing = false; // cue clears
      await act(async () => { jest.advanceTimersByTime(200); });
      expect(mockedSpeakMidpoint).toHaveBeenCalledWith('en');
    });

    it('gives up waiting once the max-wait deadline passes, even if still busy', async () => {
      const { result } = await renderHook(() => useWorkoutAudio({ ...base, voiceCues: true }));
      const chime = playerAt(0);
      chime.playing = true; // never clears

      await act(async () => { result.current.onMidpoint(); });
      await act(async () => { jest.advanceTimersByTime(4000); });
      expect(mockedSpeakMidpoint).toHaveBeenCalledWith('en');
    });
  });

  describe('startKeepAlive / stopKeepAlive', () => {
    it('configures the audio session and plays a silent looping keep-alive track', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      await act(async () => { await result.current.startKeepAlive(); });

      expect(mockedSetAudioModeAsync).toHaveBeenCalledTimes(1);
      const keepAlive = lastCreatedPlayer();
      expect(keepAlive.loop).toBe(true);
      expect(keepAlive.volume).toBe(0);
      expect(keepAlive.play).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: calling it twice does not create a second keep-alive player', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      await act(async () => { await result.current.startKeepAlive(); });
      const callsAfterFirst = mockedCreateAudioPlayer.mock.calls.length;
      await act(async () => { await result.current.startKeepAlive(); });
      expect(mockedCreateAudioPlayer.mock.calls.length).toBe(callsAfterFirst);
    });

    it('stopKeepAlive pauses and removes the player, and is a no-op if never started', async () => {
      const { result } = await renderHook(() => useWorkoutAudio(base));
      expect(() => result.current.stopKeepAlive()).not.toThrow();

      await act(async () => { await result.current.startKeepAlive(); });
      const keepAlive = lastCreatedPlayer();
      await act(async () => { result.current.stopKeepAlive(); });
      expect(keepAlive.pause).toHaveBeenCalledTimes(1);
      expect(keepAlive.remove).toHaveBeenCalledTimes(1);
    });

    it('logs a warning and leaves keep-alive unstarted if configureAudioSession fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockedSetAudioModeAsync.mockRejectedValueOnce(new Error('session error'));
      const { result } = await renderHook(() => useWorkoutAudio(base));

      await act(async () => { await result.current.startKeepAlive(); });
      expect(warnSpy).toHaveBeenCalledWith('[Audio] startKeepAlive failed:', expect.any(Error));

      // Ref was never set, so a subsequent call retries configureAudioSession again.
      await act(async () => { await result.current.startKeepAlive(); });
      expect(mockedSetAudioModeAsync).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
    });
  });

  describe('playCue error recovery (exercised via onTransition)', () => {
    it('recreates and retries the player once if the first play attempt fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = await renderHook(() => useWorkoutAudio(base));
      const chime = playerAt(0);
      chime.seekTo.mockRejectedValueOnce(new Error('seek failed'));

      result.current.onTransition('work');
      await flush();

      expect(chime.remove).toHaveBeenCalledTimes(1);
      const newChime = lastCreatedPlayer();
      expect(newChime).not.toBe(chime);
      expect(newChime.play).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('cue failed', 'chime', expect.any(Error));

      warnSpy.mockRestore();
    });

    it('warns without throwing if both the initial attempt and the retry fail', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = await renderHook(() => useWorkoutAudio(base));
      const chime = playerAt(0);
      chime.seekTo.mockRejectedValue(new Error('always fails'));

      // The retry path calls createAudioPlayer() again for a fresh instance;
      // make that instance fail too so both attempts are actually exercised.
      mockedCreateAudioPlayer.mockImplementationOnce(() => ({
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        seekTo: jest.fn(async () => { throw new Error('retry also fails'); }),
        volume: 1,
        loop: false,
        playing: false,
      }));

      expect(() => result.current.onTransition('work')).not.toThrow();
      await flush();

      expect(warnSpy).toHaveBeenCalledWith('cue failed', 'chime', expect.any(Error));
      expect(warnSpy).toHaveBeenCalledWith('cue retry failed', 'chime', expect.any(Error));

      warnSpy.mockRestore();
    });
  });

  describe('settings responsiveness', () => {
    it('picks up updated settings on rerender without changing the returned cue functions identity', async () => {
      const { result, rerender } = await renderHook(
        (props: AudioSettings) => useWorkoutAudio(props),
        { initialProps: base },
      );
      const firstOnTransition = result.current.onTransition;

      await act(async () => { rerender({ ...base, voiceCues: true }); });
      expect(result.current.onTransition).toBe(firstOnTransition);

      result.current.onTransition('work');
      await flush();
      expect(mockedSpeakPhase).toHaveBeenCalledWith('work', 'en');
    });
  });

  describe('unmount cleanup', () => {
    it('stops the keep-alive and removes all created players on unmount', async () => {
      const { result, unmount } = await renderHook(() => useWorkoutAudio(base));
      await act(async () => { await result.current.startKeepAlive(); });
      const keepAlive = lastCreatedPlayer();
      const chime = playerAt(0);
      const tick = playerAt(1);
      const finish = playerAt(2);

      await unmount();

      expect(keepAlive.pause).toHaveBeenCalledTimes(1);
      expect(keepAlive.remove).toHaveBeenCalledTimes(1);
      expect(chime.remove).toHaveBeenCalledTimes(1);
      expect(tick.remove).toHaveBeenCalledTimes(1);
      expect(finish.remove).toHaveBeenCalledTimes(1);
    });
  });
});
