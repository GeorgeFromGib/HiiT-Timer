jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  class File {
    path: string;
    constructor(...parts: string[]) {
      this.path = parts.join('/');
    }
    get exists() {
      return files.has(this.path);
    }
    async text() {
      return files.get(this.path) ?? '';
    }
    write(data: string) {
      files.set(this.path, data);
    }
  }
  return {
    File,
    Paths: { document: 'document' },
    __files: files,
  };
});

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => {}),
    volume: 1,
    loop: false,
    playing: false,
  })),
  setAudioModeAsync: jest.fn(async () => {}),
}));

jest.mock('expo-speech', () => ({
  stop: jest.fn(async () => {}),
  speak: jest.fn(),
  isSpeakingAsync: jest.fn(async () => false),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-store-review', () => ({
  requestReview: jest.fn(async () => {}),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', measurementSystem: 'metric' }]),
}));

jest.mock('expo-iap', () => ({
  initConnection: jest.fn(async () => {}),
  requestPurchase: jest.fn(async () => {}),
  getAvailablePurchases: jest.fn(async () => []),
  restorePurchases: jest.fn(async () => {}),
  finishTransaction: jest.fn(async () => {}),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
}));
