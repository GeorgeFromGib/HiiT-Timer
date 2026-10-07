import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SessionCompleteScreen from '../SessionCompleteScreen';
import { appendEntry, loadHistory, type HistoryEntry } from '../../lib/history';
import * as appAlertModule from '../../lib/appAlert';
import { ZERO_STATS } from '../../lib/sessionStats';
import type { Session } from '../../lib/sessions';

const session = { id: 's1', name: 'Run', folderId: 'f', mode: 'easy' } as Session;
const entry: HistoryEntry = {
  id: 'e1', startedAt: 1, sessionId: 's1', sessionName: 'Run', activityType: 'general',
  plannedSecs: 60, activeSecs: 60, rounds: 1, workSecs: 20, completed: true, source: 'phone',
};

const onDone = jest.fn();
const renderScreen = () => render(
  <SessionCompleteScreen
    session={session}
    segments={[{ phase: 'work', duration: 60, startAt: 0, endAt: 60, index: 0 }]}
    totalDur={60}
    congratsMsg="Nice"
    stats={ZERO_STATS}
    historyEntryId="e1"
    showConfetti={false}
    onDone={onDone}
    onRepeat={jest.fn()}
  />,
);

describe('SessionCompleteScreen feeling prompt', () => {
  beforeEach(async () => {
    onDone.mockClear();
    jest.requireMock('expo-file-system').__files.clear();
    await appendEntry(entry);
  });

  it('tapping a feeling writes it to the history entry and shows the confirmation', async () => {
    const { getByLabelText, queryByLabelText, getByText } = await renderScreen();
    await fireEvent.press(getByLabelText('Session felt too hard'));
    await waitFor(async () => expect((await loadHistory())[0].feeling).toBe('hard'));
    expect(queryByLabelText('Session felt too hard')).toBeNull();
    expect(getByText('Too Hard')).toBeTruthy();
  });

  it('Change reopens the picker', async () => {
    const { getByLabelText } = await renderScreen();
    await fireEvent.press(getByLabelText('Session felt too easy'));
    await fireEvent.press(getByLabelText('Change how the session felt'));
    expect(getByLabelText('Session felt just right')).toBeTruthy();
  });

  it('leaves feeling undefined when nothing is tapped', async () => {
    await renderScreen();
    expect((await loadHistory())[0].feeling).toBeUndefined();
  });

  it('Done without a feeling asks first, and "Done without rating" still finishes', async () => {
    const spy = jest.spyOn(appAlertModule, 'appAlert').mockImplementation(() => {});
    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('DONE'));
    expect(onDone).not.toHaveBeenCalled();
    const buttons = spy.mock.calls[0][3]!;
    buttons.find(b => b.text === 'Done without rating')!.onPress!();
    expect(onDone).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('Done after picking a feeling finishes without asking', async () => {
    const spy = jest.spyOn(appAlertModule, 'appAlert').mockImplementation(() => {});
    const { getByText, getByLabelText } = await renderScreen();
    await fireEvent.press(getByLabelText('Session felt just right'));
    await fireEvent.press(getByText('DONE'));
    expect(spy).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
