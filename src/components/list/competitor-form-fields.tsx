"use client";

export function CompetitorFormFields({
  name, setName, brand, setBrand, price, setPrice, ean, setEan,
  retailer, setRetailer, customRetailer, setCustomRetailer,
  isBio, setIsBio, retailers, isEditMode, labels,
}: {
  name: string; setName: (v: string) => void;
  brand: string; setBrand: (v: string) => void;
  price: string; setPrice: (v: string) => void;
  ean: string; setEan: (v: string) => void;
  retailer: string; setRetailer: (v: string) => void;
  customRetailer: string; setCustomRetailer: (v: string) => void;
  isBio: boolean; setIsBio: (v: boolean) => void;
  retailers: Array<{ id: string; name: string }>;
  isEditMode: boolean;
  labels: {
    name: string;
    brand: string;
    retailer: string;
    price: string;
    ean: string;
    bio: string;
    otherRetailer: string;
    otherRetailerPlaceholder: string;
  };
}) {
  const showCustom = retailer === "__custom__";

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.name} *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none" autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.brand}</label>
        <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none" />
      </div>
      {!isEditMode && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.retailer} *</label>
            <select value={retailer} onChange={(e) => setRetailer(e.target.value)} className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none">
              <option value="">--</option>
              {retailers.map((r) => (<option key={r.id} value={r.name}>{r.name}</option>))}
              <option value="__custom__">{labels.otherRetailer}</option>
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.price}</label>
            <div className="flex items-center rounded-xl border-2 border-aldi-muted-light focus-within:border-aldi-blue">
              <span className="pl-3 text-sm text-aldi-muted">€</span>
              <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="w-full bg-transparent px-2 py-2.5 text-sm focus:outline-none" />
            </div>
          </div>
        </div>
      )}
      {!isEditMode && showCustom && (
        <input type="text" value={customRetailer} onChange={(e) => setCustomRetailer(e.target.value)} placeholder={labels.otherRetailerPlaceholder} className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none" />
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.ean}</label>
        <input type="text" value={ean} onChange={(e) => setEan(e.target.value)} placeholder="4001234567890" className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none" />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={isBio} onChange={(e) => setIsBio(e.target.checked)} className="h-4.5 w-4.5 rounded border-aldi-muted-light text-green-600 focus:ring-green-500" />
        <span className="text-sm text-aldi-text">{labels.bio}</span>
      </label>
    </>
  );
}
