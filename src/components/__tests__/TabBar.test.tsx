import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TabBar from '../TabBar';
import { tabForRoute, routeForTab } from '../../navigation';

describe('tab routing', () => {
  it('maps root routes to tabs and hides on detail routes', () => {
    expect(tabForRoute({ name: 'Folders' })).toBe('home');
    expect(tabForRoute({ name: 'Sessions', folderId: 'f' })).toBe('home');
    expect(tabForRoute({ name: 'History' })).toBe('history');
    expect(tabForRoute({ name: 'Settings' })).toBe('settings');
    expect(tabForRoute({ name: 'PrivacyPolicy' })).toBeNull();
    expect(tabForRoute({ name: 'EditSession' })).toBeNull();
  });

  it('home tab respects hideFolders', () => {
    expect(routeForTab('home', true)).toEqual({ name: 'Sessions' });
    expect(routeForTab('home', false)).toEqual({ name: 'Folders' });
    expect(routeForTab('history', false)).toEqual({ name: 'History' });
  });
});

describe('TabBar', () => {
  it('marks the active tab and reports selection', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await render(<TabBar active="history" onSelect={onSelect} />);
    expect(getByLabelText('History').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(getByLabelText('Settings'));
    expect(onSelect).toHaveBeenCalledWith('settings');
  });
});
