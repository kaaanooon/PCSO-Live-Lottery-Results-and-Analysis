import { describe, expect, it } from 'vitest';

import { EntitlementReconciliation } from '../entitlement-reconciliation';

describe('purchase entitlement reconciliation', () => {
  it('accepts a current no-purchase result during a normal store check', () => {
    const reconciliation = new EntitlementReconciliation();
    const revision = reconciliation.captureRevision();

    expect(reconciliation.canApplyNegativeResult(revision)).toBe(true);
  });

  it('rejects an older empty result after a purchase completes', () => {
    const reconciliation = new EntitlementReconciliation();
    const revision = reconciliation.captureRevision();

    reconciliation.confirmPurchase();

    expect(reconciliation.canApplyNegativeResult(revision)).toBe(false);
  });

  it('protects a new purchase until Google Play reports it as owned', () => {
    const reconciliation = new EntitlementReconciliation();

    reconciliation.confirmPurchase();
    const postPurchaseRevision = reconciliation.captureRevision();

    expect(reconciliation.canApplyNegativeResult(postPurchaseRevision)).toBe(false);

    reconciliation.confirmStoreOwnership();
    const storeConfirmedRevision = reconciliation.captureRevision();

    expect(reconciliation.canApplyNegativeResult(storeConfirmedRevision)).toBe(true);
  });

  it('invalidates an older negative result when the store confirms ownership', () => {
    const reconciliation = new EntitlementReconciliation();
    const revision = reconciliation.captureRevision();

    reconciliation.confirmStoreOwnership();

    expect(reconciliation.canApplyNegativeResult(revision)).toBe(false);
  });
});
