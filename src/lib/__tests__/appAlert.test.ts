import { renderHook, act } from '@testing-library/react-native';
import { appAlert, dismissAppAlert, useAppAlert, confirmIfDirty } from '../appAlert';

describe('appAlert / dismissAppAlert / useAppAlert', () => {
  afterEach(async () => {
    await act(async () => {
      dismissAppAlert();
    });
  });

  it('starts with no current alert', async () => {
    const { result } = await renderHook(() => useAppAlert());
    expect(result.current).toBeNull();
  });

  it('publishes the alert request to subscribers', async () => {
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      appAlert('error', 'Oops', 'Something broke', [{ text: 'Retry' }]);
    });
    expect(result.current).toEqual({
      kind: 'error',
      title: 'Oops',
      message: 'Something broke',
      buttons: [{ text: 'Retry' }],
    });
  });

  it('defaults to a single OK button when buttons is omitted', async () => {
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      appAlert('info', 'Heads up');
    });
    expect(result.current?.buttons).toEqual([{ text: 'OK' }]);
  });

  it('defaults to a single OK button when buttons is an empty array', async () => {
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      appAlert('info', 'Heads up', undefined, []);
    });
    expect(result.current?.buttons).toEqual([{ text: 'OK' }]);
  });

  it('supports an alert with no message', async () => {
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      appAlert('warning', 'Careful');
    });
    expect(result.current?.message).toBeUndefined();
  });

  it('dismissAppAlert clears the current alert', async () => {
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      appAlert('info', 'Heads up');
    });
    expect(result.current).not.toBeNull();

    await act(async () => {
      dismissAppAlert();
    });
    expect(result.current).toBeNull();
  });

  it('notifies multiple subscribers of the same state', async () => {
    const { result: r1 } = await renderHook(() => useAppAlert());
    const { result: r2 } = await renderHook(() => useAppAlert());
    await act(async () => {
      appAlert('info', 'Broadcast');
    });
    expect(r1.current?.title).toBe('Broadcast');
    expect(r2.current?.title).toBe('Broadcast');
  });
});

describe('confirmIfDirty', () => {
  afterEach(async () => {
    await act(async () => {
      dismissAppAlert();
    });
  });

  it('applies immediately, with no prompt, when not dirty', () => {
    const apply = jest.fn();
    confirmIfDirty(false, 'alerts.overwriteSpeedMessage', apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('prompts for confirmation when dirty, without applying yet', async () => {
    const { result } = await renderHook(() => useAppAlert());
    const apply = jest.fn();
    await act(async () => {
      confirmIfDirty(true, 'alerts.overwriteSpeedMessage', apply);
    });
    expect(apply).not.toHaveBeenCalled();
    expect(result.current?.title).toBe('Overwrite settings?');
    expect(result.current?.message).toBe('Applying this preset will replace your current speed settings.');
    expect(result.current?.buttons).toHaveLength(2);
  });

  it('applies when the confirm button is pressed', async () => {
    const { result } = await renderHook(() => useAppAlert());
    const apply = jest.fn();
    await act(async () => {
      confirmIfDirty(true, 'alerts.overwriteSpeedMessage', apply);
    });
    await act(async () => {
      result.current?.buttons[1].onPress?.();
    });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('does not apply when the cancel button is pressed', async () => {
    const { result } = await renderHook(() => useAppAlert());
    const apply = jest.fn();
    await act(async () => {
      confirmIfDirty(true, 'alerts.overwriteSpeedMessage', apply);
    });
    expect(result.current?.buttons[0].style).toBe('cancel');
    expect(apply).not.toHaveBeenCalled();
  });
});
