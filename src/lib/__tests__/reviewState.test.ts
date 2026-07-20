import { requestReview } from 'expo-store-review';
import { checkAndRequestReview, setForceNextReview } from '../reviewState';

const FILE_KEY = 'document/review_state_v1.json';

function seedState(state: { promptsShown: number; totalWorkouts: number; workoutsAtLastPrompt: number }) {
  jest.requireMock('expo-file-system').__files.set(FILE_KEY, JSON.stringify(state));
}

function readSavedState() {
  const raw = jest.requireMock('expo-file-system').__files.get(FILE_KEY);
  return raw ? JSON.parse(raw) : undefined;
}

describe('checkAndRequestReview', () => {
  beforeEach(() => {
    jest.requireMock('expo-file-system').__files.clear();
    (requestReview as jest.Mock).mockClear();
    setForceNextReview(false);
  });

  it('increments totalWorkouts from a missing file without requesting a review', async () => {
    await checkAndRequestReview();
    expect(requestReview).not.toHaveBeenCalled();
    expect(readSavedState()).toEqual({ promptsShown: 0, totalWorkouts: 1, workoutsAtLastPrompt: 0 });
  });

  it('recovers to defaults from a corrupt file without throwing', async () => {
    jest.requireMock('expo-file-system').__files.set(FILE_KEY, '{not valid json');
    await expect(checkAndRequestReview()).resolves.toBeUndefined();
    expect(readSavedState().totalWorkouts).toBe(1);
  });

  it('does not request a review while the gap is below the first threshold (5)', async () => {
    seedState({ promptsShown: 0, totalWorkouts: 3, workoutsAtLastPrompt: 0 });
    await checkAndRequestReview();
    expect(requestReview).not.toHaveBeenCalled();
    expect(readSavedState()).toEqual({ promptsShown: 0, totalWorkouts: 4, workoutsAtLastPrompt: 0 });
  });

  it('requests a review once the gap reaches the first threshold (5) and records the prompt', async () => {
    seedState({ promptsShown: 0, totalWorkouts: 4, workoutsAtLastPrompt: 0 });
    await checkAndRequestReview();
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(readSavedState()).toEqual({ promptsShown: 1, totalWorkouts: 5, workoutsAtLastPrompt: 5 });
  });

  it('requests a review once the gap reaches the second threshold (12)', async () => {
    seedState({ promptsShown: 1, totalWorkouts: 16, workoutsAtLastPrompt: 5 });
    await checkAndRequestReview();
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(readSavedState()).toEqual({ promptsShown: 2, totalWorkouts: 17, workoutsAtLastPrompt: 17 });
  });

  it('requests a review once the gap reaches the third threshold (29)', async () => {
    seedState({ promptsShown: 2, totalWorkouts: 45, workoutsAtLastPrompt: 17 });
    await checkAndRequestReview();
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(readSavedState()).toEqual({ promptsShown: 3, totalWorkouts: 46, workoutsAtLastPrompt: 46 });
  });

  it('never prompts again once promptsShown reaches 3, no matter the gap', async () => {
    seedState({ promptsShown: 3, totalWorkouts: 1000, workoutsAtLastPrompt: 0 });
    await checkAndRequestReview();
    expect(requestReview).not.toHaveBeenCalled();
    expect(readSavedState()).toEqual({ promptsShown: 3, totalWorkouts: 1001, workoutsAtLastPrompt: 0 });
  });

  it('setForceNextReview(true) forces a request even below threshold and past the 3-prompt cap', async () => {
    seedState({ promptsShown: 3, totalWorkouts: 1000, workoutsAtLastPrompt: 0 });
    setForceNextReview(true);
    await checkAndRequestReview();
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(readSavedState()).toEqual({ promptsShown: 4, totalWorkouts: 1001, workoutsAtLastPrompt: 1001 });
  });

  it('resets the force flag after use, so the next call goes through normal gating', async () => {
    seedState({ promptsShown: 3, totalWorkouts: 1000, workoutsAtLastPrompt: 0 });
    setForceNextReview(true);
    await checkAndRequestReview();
    (requestReview as jest.Mock).mockClear();

    await checkAndRequestReview();
    expect(requestReview).not.toHaveBeenCalled();
  });
});
