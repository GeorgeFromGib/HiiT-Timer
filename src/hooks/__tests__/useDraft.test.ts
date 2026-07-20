import { act, renderHook } from '@testing-library/react-native';
import { useDraft } from '../useDraft';

describe('useDraft', () => {
  it('isDirty is false when current value matches the initial snapshot', async () => {
    const { result } = await renderHook(() => useDraft({ a: 1, b: 'x' }));
    expect(result.current.isDirty({ a: 1, b: 'x' })).toBe(false);
  });

  it('isDirty is true when current value differs from the initial snapshot', async () => {
    const { result } = await renderHook(() => useDraft({ a: 1, b: 'x' }));
    expect(result.current.isDirty({ a: 2, b: 'x' })).toBe(true);
  });

  it('treats reordered object keys as dirty since it compares raw JSON.stringify output, not deep equality', async () => {
    const { result } = await renderHook(() => useDraft({ a: 1, b: 'x' }));
    // Same values, different key order -> different JSON string -> considered dirty.
    expect(result.current.isDirty({ b: 'x', a: 1 })).toBe(true);
  });

  it('commit updates the snapshot so a subsequent isDirty check reflects the new baseline', async () => {
    const { result } = await renderHook(() => useDraft({ a: 1 }));
    expect(result.current.isDirty({ a: 2 })).toBe(true);

    await act(async () => { result.current.commit({ a: 2 }); });

    expect(result.current.isDirty({ a: 2 })).toBe(false);
    expect(result.current.isDirty({ a: 1 })).toBe(true);
  });

  it('works with primitive values, not just objects', async () => {
    const { result } = await renderHook(() => useDraft(5));
    expect(result.current.isDirty(5)).toBe(false);
    expect(result.current.isDirty(6)).toBe(true);
  });

  it('snapshot persists across rerenders without a commit', async () => {
    const { result, rerender } = await renderHook(() => useDraft({ a: 1 }));
    await act(async () => rerender());
    expect(result.current.isDirty({ a: 1 })).toBe(false);
    expect(result.current.isDirty({ a: 9 })).toBe(true);
  });
});
