import Image from "next/image";

export function ProductRow({ name, category, thumbnail, price, badge, qty, onClick }: {
  name: string;
  category: string | null;
  thumbnail: string | null | undefined;
  price?: number | null;
  badge?: string;
  qty?: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-aldi-muted-light/40" onClick={onClick}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          {thumbnail ? (
            <Image src={thumbnail} alt="" role="presentation" width={40} height={40} className="rounded object-contain" unoptimized />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded bg-aldi-muted-light text-xs text-aldi-muted">?</span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="truncate text-[15px] font-medium text-aldi-text">{name}</span>
          {category && <span className="truncate text-xs text-aldi-muted">{category}</span>}
          {badge && <span className="inline-block w-fit rounded-full bg-aldi-orange/10 px-2 py-0.5 text-[10px] font-semibold text-aldi-orange">{badge}</span>}
        </span>
        {qty != null && qty > 1 && (
          <span className="shrink-0 text-sm font-semibold text-aldi-muted">{qty}x</span>
        )}
        {price != null && (
          <span className="shrink-0 text-sm font-semibold text-aldi-blue">{price.toFixed(2)}&nbsp;&euro;</span>
        )}
      </button>
    </li>
  );
}
