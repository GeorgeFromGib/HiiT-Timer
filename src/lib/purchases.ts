let _isPremium = false;

export async function initPurchases(_apiKey?: string): Promise<void> {}

export async function getIsPremium(): Promise<boolean> {
  return _isPremium;
}

export async function purchasePremium(): Promise<boolean> {
  _isPremium = true;
  return true;
}

export async function restorePurchases(): Promise<boolean> {
  return _isPremium;
}

export function setMockPremium(val: boolean): void {
  _isPremium = val;
}
