import { act, renderHook } from '@testing-library/react-native';
import { confirmDeleteSession } from '../alerts';
import { useAppAlert } from '../appAlert';

describe('confirmDeleteSession', () => {
  it('raises an app alert with the session name in the message', async () => {
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      confirmDeleteSession('Leg Day', jest.fn(), jest.fn());
    });
    expect(result.current?.kind).toBe('warning');
    expect(result.current?.title).toBe('Delete Session');
    expect(result.current?.message).toBe('Remove "Leg Day"?');
  });

  it('wires cancel and delete buttons to onCancel/onConfirm', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      confirmDeleteSession('Leg Day', onConfirm, onCancel);
    });

    const buttons = result.current!.buttons;
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatchObject({ text: 'Cancel', style: 'cancel' });
    expect(buttons[1]).toMatchObject({ text: 'Delete', style: 'destructive' });

    buttons[0].onPress?.();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    buttons[1].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('works without an onCancel callback', async () => {
    const onConfirm = jest.fn();
    const { result } = await renderHook(() => useAppAlert());
    await act(async () => {
      confirmDeleteSession('Leg Day', onConfirm);
    });

    const buttons = result.current!.buttons;
    expect(() => buttons[0].onPress?.()).not.toThrow();
  });
});
