import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HistoryScreen from '../HistoryScreen';
import { appendEntry, type HistoryEntry } from '../../lib/history';

const entry = (id: string, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, startedAt: Date.now(), sessionId: 's', sessionName: `Run ${id}`, activityType: 'general',
  plannedSecs: 600, activeSecs: 600, rounds: 8, workSecs: 240, completed: true, source: 'phone', ...over,
});

const renderScreen = (onChooseSession = jest.fn()) =>
  render(<HistoryScreen onBack={jest.fn()} onChooseSession={onChooseSession} />);

describe('HistoryScreen', () => {
  beforeEach(() => jest.requireMock('expo-file-system').__files.clear());

  it('shows the empty state and its CTA when there is no history', async () => {
    const onChoose = jest.fn();
    const { findByText } = await renderScreen(onChoose);
    await fireEvent.press(await findByText('CHOOSE A SESSION'));
    expect(onChoose).toHaveBeenCalled();
  });

  it('lists entries newest first, marks abandoned runs, and shows streak', async () => {
    await appendEntry(entry('old', { startedAt: Date.now() - 3 * 86400000 }));
    await appendEntry(entry('new'));
    await appendEntry(entry('stopped', { completed: false, startedAt: Date.now() - 1000 }));
    const { findByText, getAllByText, getByText } = await renderScreen();
    await findByText('Run new');
    expect(getByText('Stopped early', { exact: false })).toBeTruthy();
    expect(getByText('Current streak')).toBeTruthy();
    const names = getAllByText(/^Run /).map(n => n.props.children);
    expect(names).toEqual(['Run new', 'Run stopped', 'Run old']);
  });

  it('switching range updates the totals', async () => {
    await appendEntry(entry('old', { startedAt: Date.now() - 20 * 86400000 }));
    await appendEntry(entry('new'));
    const { findByText, getByText, getAllByText } = await renderScreen();
    await findByText('Run new');
    expect(getAllByText('1').length).toBeGreaterThan(0); // week: 1 workout
    await fireEvent.press(getByText('All time'));
    await waitFor(() => expect(getAllByText('2').length).toBeGreaterThan(0));
  });

  // Seeded history with hand-computed expectations. Days are offsets from now.
  //   today:  completed 600s            yesterday: completed 300s
  //   today:  abandoned 60s             10 days ago: completed 3600s   45 days ago: abandoned 1800s
  const seed = async () => {
    const d = 86400000;
    await appendEntry(entry('a', { activeSecs: 600 }));
    await appendEntry(entry('b', { activeSecs: 300, startedAt: Date.now() - d }));
    await appendEntry(entry('c', { activeSecs: 60, completed: false }));
    await appendEntry(entry('d', { activeSecs: 3600, startedAt: Date.now() - 10 * d }));
    await appendEntry(entry('e', { activeSecs: 1800, completed: false, startedAt: Date.now() - 45 * d }));
  };

  it('week: 2 workouts, 16m active (600+300+60), 67% completed (2 of 3)', async () => {
    await seed();
    const { findByText, getByText } = await renderScreen();
    await findByText('Run a');
    expect(getByText('16m')).toBeTruthy();
    expect(getByText('67%')).toBeTruthy();
  });

  it('month: 3 workouts, 1h 16m active (960+3600s), 75% completed (3 of 4)', async () => {
    await seed();
    const { findByText, getByText } = await renderScreen();
    await fireEvent.press(await findByText('Month'));
    expect(getByText('1h 16m')).toBeTruthy();
    expect(getByText('75%')).toBeTruthy();
  });

  it('all time: 3 workouts, 1h 46m active, 60% completed (3 of 5)', async () => {
    await seed();
    const { findByText, getByText } = await renderScreen();
    await fireEvent.press(await findByText('All time'));
    expect(getByText('1h 46m')).toBeTruthy();
    expect(getByText('60%')).toBeTruthy();
  });

  it('streak chips: current 2 days (today + yesterday), longest 2 days', async () => {
    await seed();
    const { findByText, getAllByText } = await renderScreen();
    await findByText('Run a');
    expect(getAllByText('2').length).toBeGreaterThanOrEqual(3); // current, longest, week workouts
  });

  it('heatmap shows today\'s active minutes and the legend', async () => {
    await appendEntry(entry('a', { activeSecs: 600 }));
    const { findByLabelText, getByText } = await renderScreen();
    expect(await findByLabelText('10 min')).toBeTruthy();
    expect(getByText('11 weeks ago')).toBeTruthy();
    expect(getByText('Mon')).toBeTruthy();
    expect(getByText('Sun')).toBeTruthy();
  });
});
