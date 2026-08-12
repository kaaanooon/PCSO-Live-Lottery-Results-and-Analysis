/**
 * Prevents an older Google Play ownership query from overwriting a purchase
 * that completed while the query was in flight.
 */
export class EntitlementReconciliation {
  private revision = 0;
  private confirmedPurchaseAwaitingStore = false;

  captureRevision(): number {
    return this.revision;
  }

  confirmPurchase(): void {
    this.revision += 1;
    this.confirmedPurchaseAwaitingStore = true;
  }

  confirmStoreOwnership(): void {
    this.revision += 1;
    this.confirmedPurchaseAwaitingStore = false;
  }

  canApplyNegativeResult(capturedRevision: number): boolean {
    return (
      capturedRevision === this.revision &&
      !this.confirmedPurchaseAwaitingStore
    );
  }
}
