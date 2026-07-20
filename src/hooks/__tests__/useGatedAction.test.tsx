import { renderHook } from '@testing-library/react-native';
import { useGatedAction } from '../useGatedAction';
import { PremiumContext, type PremiumContextValue } from '../../lib/premiumContext';

function wrapperWithAccess(hasAccess: boolean) {
  const value: PremiumContextValue = {
    isPremium: hasAccess,
    hasAccess,
    trialDaysRemaining: 0,
    loading: false,
    purchase: async () => false,
    restore: async () => false,
    setMockPremium: () => {},
    expireTrialForTesting: async () => {},
    resetTrialForTesting: async () => {},
  };
  return ({ children }: { children: React.ReactNode }) => (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
}

describe('useGatedAction', () => {
  it('runs the wrapped action and does not call onDenied when hasAccess is true', async () => {
    const onDenied = jest.fn();
    const { result } = await renderHook(() => useGatedAction(onDenied), {
      wrapper: wrapperWithAccess(true),
    });

    const action = jest.fn();
    const gated = result.current(action);
    gated('arg1', 2);

    expect(action).toHaveBeenCalledWith('arg1', 2);
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('calls onDenied and does not run the wrapped action when hasAccess is false', async () => {
    const onDenied = jest.fn();
    const { result } = await renderHook(() => useGatedAction(onDenied), {
      wrapper: wrapperWithAccess(false),
    });

    const action = jest.fn();
    const gated = result.current(action);
    gated('arg1');

    expect(action).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledTimes(1);
  });

  it('returns a new callable gate function each time gate() is invoked', async () => {
    const { result } = await renderHook(() => useGatedAction(jest.fn()), {
      wrapper: wrapperWithAccess(true),
    });

    const gateFn = result.current;
    const gatedA = gateFn(jest.fn());
    const gatedB = gateFn(jest.fn());

    expect(typeof gatedA).toBe('function');
    expect(typeof gatedB).toBe('function');
    expect(gatedA).not.toBe(gatedB);
  });
});
