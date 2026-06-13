import { File, Paths } from 'expo-file-system';
import * as StoreReview from 'expo-store-review';

interface ReviewState {
  promptsShown: number;
  totalWorkouts: number;
  workoutsAtLastPrompt: number;
}

const DEFAULT: ReviewState = {
  promptsShown: 0,
  totalWorkouts: 0,
  workoutsAtLastPrompt: 0,
};

// Workouts required since last prompt before the next ask: 5 → 12 → 29
const THRESHOLDS = [5, 12, 29] as const;

const reviewFile = () => new File(Paths.document, 'review_state_v1.json');

async function loadReviewState(): Promise<ReviewState> {
  try {
    const f = reviewFile();
    if (!f.exists) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(await f.text()) };
  } catch {
    return DEFAULT;
  }
}

async function saveReviewState(state: ReviewState): Promise<void> {
  try {
    reviewFile().write(JSON.stringify(state));
  } catch {}
}

export async function checkAndRequestReview(): Promise<void> {
  const state = await loadReviewState();

  const updated = { ...state, totalWorkouts: state.totalWorkouts + 1 };
  await saveReviewState(updated);

  if (updated.promptsShown >= 3) return;

  const gap = updated.totalWorkouts - updated.workoutsAtLastPrompt;
  if (gap < THRESHOLDS[updated.promptsShown]) return;

  await StoreReview.requestReview();

  await saveReviewState({
    ...updated,
    promptsShown: updated.promptsShown + 1,
    workoutsAtLastPrompt: updated.totalWorkouts,
  });
}