/**
 * Lightweight module-scoped signal for receipt data changes.
 * Call markReceiptsChanged() after a new receipt is successfully processed.
 * Consumers (e.g. PurchaseHistoryMenu) check getLastReceiptChangeTs() to decide
 * whether to revalidate their cache without polling or TTL.
 */

let _lastReceiptChangeTs = 0;

export function markReceiptsChanged(): void {
  _lastReceiptChangeTs = Date.now();
}

export function getLastReceiptChangeTs(): number {
  return _lastReceiptChangeTs;
}
