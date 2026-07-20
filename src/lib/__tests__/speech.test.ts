import * as Speech from 'expo-speech';
import { speakPhase, speakPrepare, speakComplete, speakMidpoint, isSpeaking } from '../speech';
import { i18n } from '../i18n';
import en from '../../locales/en';
import es from '../../locales/es';

const mockedSpeech = jest.mocked(Speech);

// speakPhase/speakPrepare/speakComplete kick off a fire-and-forget async chain
// (await Speech.stop() then Speech.speak()). Flush microtasks so assertions
// run after that chain settles.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('speech', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('speakPhase', () => {
    it('stops any in-flight speech, then speaks the phase name in the given language', async () => {
      speakPhase('work', 'en');
      await flush();
      expect(mockedSpeech.stop).toHaveBeenCalledTimes(1);
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        i18n.t('speech.phases.work', { locale: 'en' }),
        expect.objectContaining({ language: 'en-US' }),
      );
      expect(mockedSpeech.speak).toHaveBeenCalledWith(en.speech.phases.work, expect.anything());
    });

    it('uses the correct BCP-47 language code and translated text for Spanish', async () => {
      speakPhase('rest', 'es');
      await flush();
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        es.speech.phases.rest,
        expect.objectContaining({ language: 'es-ES' }),
      );
    });

    it('swallows errors from Speech.stop() instead of throwing', async () => {
      mockedSpeech.stop.mockRejectedValueOnce(new Error('boom'));
      expect(() => speakPhase('work', 'en')).not.toThrow();
      await flush();
    });
  });

  describe('speakPrepare', () => {
    it('speaks the "prepare for <phase>" cue', async () => {
      speakPrepare('cooldown', 'en');
      await flush();
      expect(mockedSpeech.stop).toHaveBeenCalledTimes(1);
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        en.speech.prepare.cooldown,
        expect.objectContaining({ language: 'en-US' }),
      );
    });

    it('translates into French', async () => {
      speakPrepare('finish', 'fr');
      await flush();
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        i18n.t('speech.prepare.finish', { locale: 'fr' }),
        expect.objectContaining({ language: 'fr-FR' }),
      );
    });
  });

  describe('speakComplete', () => {
    it('speaks the completion message and forwards onDone', async () => {
      const onDone = jest.fn();
      speakComplete('en', onDone);
      await flush();
      expect(mockedSpeech.stop).toHaveBeenCalledTimes(1);
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        en.speech.complete,
        expect.objectContaining({ language: 'en-US', onDone }),
      );
    });

    it('works without an onDone callback', async () => {
      speakComplete('en');
      await flush();
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        en.speech.complete,
        expect.objectContaining({ language: 'en-US', onDone: undefined }),
      );
    });
  });

  describe('speakMidpoint', () => {
    it('speaks the midpoint message without calling Speech.stop() first', () => {
      speakMidpoint('en');
      expect(mockedSpeech.stop).not.toHaveBeenCalled();
      expect(mockedSpeech.speak).toHaveBeenCalledWith(
        en.speech.midpoint,
        { language: 'en-US' },
      );
    });

    it('translates the midpoint message per language', () => {
      speakMidpoint('es');
      expect(mockedSpeech.speak).toHaveBeenCalledWith(es.speech.midpoint, { language: 'es-ES' });
    });
  });

  describe('isSpeaking', () => {
    it('delegates to Speech.isSpeakingAsync()', async () => {
      mockedSpeech.isSpeakingAsync.mockResolvedValueOnce(true);
      await expect(isSpeaking()).resolves.toBe(true);
      expect(mockedSpeech.isSpeakingAsync).toHaveBeenCalledTimes(1);
    });

    it('returns false when nothing is speaking', async () => {
      mockedSpeech.isSpeakingAsync.mockResolvedValueOnce(false);
      await expect(isSpeaking()).resolves.toBe(false);
    });
  });
});
