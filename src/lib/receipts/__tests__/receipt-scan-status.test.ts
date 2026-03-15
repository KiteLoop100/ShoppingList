import { describe, it, expect } from "vitest";

const STALE_THRESHOLD_MS = 6 * 60 * 1000;

interface ScanRow {
  scan_id: string;
  status: "processing" | "completed" | "failed";
  error_code: string | null;
  created_at: string;
}

type DetectedStatus = "processing" | "completed" | "failed" | "timeout";

function detectScanStatus(scan: ScanRow): DetectedStatus {
  if (scan.status === "completed") return "completed";
  if (scan.status === "failed") return "failed";

  const age = Date.now() - new Date(scan.created_at).getTime();
  if (age > STALE_THRESHOLD_MS) return "timeout";
  return "processing";
}

function getErrorMessage(errorCode: string | undefined): string {
  switch (errorCode) {
    case "timeout": return "processingTimeout";
    case "ocr_failed": return "ocrFailed";
    case "not_a_receipt": return "notAReceipt";
    case "unsupported_retailer": return "unsupportedRetailer";
    default: return "processingFailed";
  }
}

function filterStaleFailedScans(
  scans: ScanRow[],
  latestCompletedAt: string | null,
): ScanRow[] {
  if (!latestCompletedAt) return scans;
  return scans.filter((s) => s.created_at > latestCompletedAt);
}

describe("receipt scan status detection", () => {
  it("returns 'processing' for a fresh scan", () => {
    const scan: ScanRow = {
      scan_id: "s1",
      status: "processing",
      error_code: null,
      created_at: new Date().toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("processing");
  });

  it("returns 'completed' for a completed scan", () => {
    const scan: ScanRow = {
      scan_id: "s2",
      status: "completed",
      error_code: null,
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("completed");
  });

  it("returns 'failed' for a server-failed scan", () => {
    const scan: ScanRow = {
      scan_id: "s3",
      status: "failed",
      error_code: "ocr_failed",
      created_at: new Date().toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("failed");
  });

  it("returns 'timeout' for a processing scan older than 6 minutes", () => {
    const scan: ScanRow = {
      scan_id: "s4",
      status: "processing",
      error_code: null,
      created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("timeout");
  });

  it("stays 'processing' at exactly 6 minutes", () => {
    const scan: ScanRow = {
      scan_id: "s5",
      status: "processing",
      error_code: null,
      created_at: new Date(Date.now() - STALE_THRESHOLD_MS).toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("processing");
  });

  it("returns 'timeout' at 6 minutes + 1ms", () => {
    const scan: ScanRow = {
      scan_id: "s6",
      status: "processing",
      error_code: null,
      created_at: new Date(Date.now() - STALE_THRESHOLD_MS - 1).toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("timeout");
  });
});

describe("receipt scan status transitions", () => {
  it("processing -> completed is valid", () => {
    const before: ScanRow = { scan_id: "t1", status: "processing", error_code: null, created_at: new Date().toISOString() };
    const after: ScanRow = { ...before, status: "completed" };
    expect(detectScanStatus(before)).toBe("processing");
    expect(detectScanStatus(after)).toBe("completed");
  });

  it("processing -> failed is valid", () => {
    const before: ScanRow = { scan_id: "t2", status: "processing", error_code: null, created_at: new Date().toISOString() };
    const after: ScanRow = { ...before, status: "failed", error_code: "internal_error" };
    expect(detectScanStatus(before)).toBe("processing");
    expect(detectScanStatus(after)).toBe("failed");
  });

  it("completed scan is never detected as timeout regardless of age", () => {
    const scan: ScanRow = {
      scan_id: "t3",
      status: "completed",
      error_code: null,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("completed");
  });

  it("failed scan is never detected as timeout regardless of age", () => {
    const scan: ScanRow = {
      scan_id: "t4",
      status: "failed",
      error_code: "ocr_failed",
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    expect(detectScanStatus(scan)).toBe("failed");
  });
});

describe("filterStaleFailedScans", () => {
  it("returns all scans when no completed scan exists", () => {
    const scans: ScanRow[] = [
      { scan_id: "f1", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:50:00Z" },
      { scan_id: "f2", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:40:00Z" },
    ];
    expect(filterStaleFailedScans(scans, null)).toHaveLength(2);
  });

  it("filters out failed scans older than the latest completed scan", () => {
    const scans: ScanRow[] = [
      { scan_id: "f1", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:50:00Z" },
      { scan_id: "f2", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:40:00Z" },
    ];
    const result = filterStaleFailedScans(scans, "2026-03-14T16:52:00Z");
    expect(result).toHaveLength(0);
  });

  it("keeps failed scans newer than the latest completed scan", () => {
    const scans: ScanRow[] = [
      { scan_id: "f1", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:55:00Z" },
      { scan_id: "f2", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:40:00Z" },
    ];
    const result = filterStaleFailedScans(scans, "2026-03-14T16:52:00Z");
    expect(result).toHaveLength(1);
    expect(result[0].scan_id).toBe("f1");
  });

  it("reproduces the exact bug scenario: 5 failed + 1 completed newer", () => {
    const failedScans: ScanRow[] = [
      { scan_id: "f1", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:50:00Z" },
      { scan_id: "f2", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:41:00Z" },
      { scan_id: "f3", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:34:00Z" },
      { scan_id: "f4", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:24:00Z" },
      { scan_id: "f5", status: "failed", error_code: "ocr_failed", created_at: "2026-03-14T16:22:00Z" },
    ];
    const latestCompletedAt = "2026-03-14T16:52:50Z";
    const result = filterStaleFailedScans(failedScans, latestCompletedAt);
    expect(result).toHaveLength(0);
  });
});

describe("getErrorMessage", () => {
  it("maps timeout to processingTimeout", () => {
    expect(getErrorMessage("timeout")).toBe("processingTimeout");
  });

  it("maps ocr_failed to ocrFailed", () => {
    expect(getErrorMessage("ocr_failed")).toBe("ocrFailed");
  });

  it("maps not_a_receipt to notAReceipt", () => {
    expect(getErrorMessage("not_a_receipt")).toBe("notAReceipt");
  });

  it("maps unsupported_retailer to unsupportedRetailer", () => {
    expect(getErrorMessage("unsupported_retailer")).toBe("unsupportedRetailer");
  });

  it("maps unknown error codes to processingFailed", () => {
    expect(getErrorMessage("internal_error")).toBe("processingFailed");
  });

  it("maps undefined to processingFailed", () => {
    expect(getErrorMessage(undefined)).toBe("processingFailed");
  });
});
