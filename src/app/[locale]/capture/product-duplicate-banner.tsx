"use client";

interface ProductDuplicateBannerProps {
  t: (key: string) => string;
  duplicateProductId: string;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function ProductDuplicateBanner({ t, duplicateProductId, onUpdate, onDismiss }: ProductDuplicateBannerProps) {
  if (!duplicateProductId) return null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p className="font-medium text-aldi-text">{t("duplicateTitle")}</p>
      <p className="mt-1 text-sm text-aldi-muted">{t("duplicateMessage")}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onUpdate}
          className="rounded-xl bg-aldi-blue px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98]"
        >
          {t("update")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl bg-aldi-bg px-4 py-2.5 text-sm font-medium text-aldi-text-secondary transition-colors hover:bg-aldi-muted-light"
        >
          {t("dontUpdate")}
        </button>
      </div>
    </div>
  );
}
