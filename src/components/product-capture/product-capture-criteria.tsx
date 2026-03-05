"use client";

export interface CriteriaValues {
  isBio: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  animalWelfareLevel: number | null;
}

export interface CriteriaLabels {
  bio: string;
  vegan: string;
  glutenFree: string;
  lactoseFree: string;
  animalWelfare: string;
  animalWelfareNone: string;
  animalWelfareLevel: string;
}

export function ProductCaptureCriteria({
  values,
  onChange,
  labels,
}: {
  values: CriteriaValues;
  onChange: (v: CriteriaValues) => void;
  labels: CriteriaLabels;
}) {
  const set = (patch: Partial<CriteriaValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-2">
      <CheckboxRow label={labels.bio} checked={values.isBio} onChange={(v) => set({ isBio: v })} color="green" />
      <CheckboxRow label={labels.vegan} checked={values.isVegan} onChange={(v) => set({ isVegan: v })} color="green" />
      <CheckboxRow label={labels.glutenFree} checked={values.isGlutenFree} onChange={(v) => set({ isGlutenFree: v })} color="amber" />
      <CheckboxRow label={labels.lactoseFree} checked={values.isLactoseFree} onChange={(v) => set({ isLactoseFree: v })} color="amber" />
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-aldi-text">{labels.animalWelfare}</span>
        <select
          value={values.animalWelfareLevel ?? ""}
          onChange={(e) => set({ animalWelfareLevel: e.target.value ? Number(e.target.value) : null })}
          className="rounded-lg border border-aldi-muted-light px-2 py-1 text-sm focus:border-aldi-blue focus:outline-none"
        >
          <option value="">{labels.animalWelfareNone}</option>
          {[1, 2, 3, 4].map((lvl) => (
            <option key={lvl} value={lvl}>{labels.animalWelfareLevel} {lvl}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: "green" | "amber";
}) {
  const ring = color === "green" ? "focus:ring-green-500" : "focus:ring-amber-500";
  const text = color === "green" ? "text-green-600" : "text-amber-600";
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4.5 w-4.5 rounded border-aldi-muted-light ${text} ${ring}`}
      />
      <span className="text-sm text-aldi-text">{label}</span>
    </label>
  );
}
