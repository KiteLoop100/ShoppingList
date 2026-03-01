"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { db, type LocalCategoryAlias } from "@/lib/db";
import { normalizeName } from "@/lib/products/normalize";
import { generateId } from "@/lib/utils/generate-id";
import type { Category } from "@/types";

interface CategoryAliasPanelProps {
  aliases: LocalCategoryAlias[];
  categories: Category[];
  onDataChanged: () => void;
}

export function CategoryAliasPanel({ aliases, categories, onDataChanged }: CategoryAliasPanelProps) {
  const t = useTranslations("admin");
  const [aliasForm, setAliasForm] = useState({ term_normalized: "", category_id: "" });
  const [editingAlias, setEditingAlias] = useState<LocalCategoryAlias | null>(null);

  const addAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = normalizeName(aliasForm.term_normalized.trim());
    if (!term || !aliasForm.category_id) return;
    const now = new Date().toISOString();
    const alias: LocalCategoryAlias = {
      alias_id: generateId("alias"),
      term_normalized: term,
      category_id: aliasForm.category_id,
      source: "manual",
      confidence: 1,
      created_at: now,
      updated_at: now,
    };
    await db.category_aliases.add(alias as never);
    setAliasForm({ term_normalized: "", category_id: "" });
    onDataChanged();
  };

  const updateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlias) return;
    const term = normalizeName(aliasForm.term_normalized.trim());
    if (!term || !aliasForm.category_id) return;
    await db.category_aliases.update(editingAlias.id!, {
      term_normalized: term,
      category_id: aliasForm.category_id,
    });
    setEditingAlias(null);
    setAliasForm({ term_normalized: "", category_id: "" });
    onDataChanged();
  };

  const deleteAlias = async (id: number) => {
    await db.category_aliases.delete(id);
    onDataChanged();
  };

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-aldi-blue">{t("aliases")}</h2>
      <form onSubmit={editingAlias ? updateAlias : addAlias} className="space-y-3 rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
        <input
          value={aliasForm.term_normalized}
          onChange={(e) => setAliasForm((f) => ({ ...f, term_normalized: e.target.value }))}
          placeholder={t("aliasTerm")}
          className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
          required
        />
        <select
          value={aliasForm.category_id}
          onChange={(e) => setAliasForm((f) => ({ ...f, category_id: e.target.value }))}
          className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
          required
        >
          <option value="">{t("category")}</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 font-semibold text-white">{editingAlias ? t("save") : t("addAlias")}</button>
          {editingAlias && (
            <button type="button" onClick={() => { setEditingAlias(null); setAliasForm({ term_normalized: "", category_id: "" }); }} className="min-h-touch rounded-xl border-2 border-aldi-muted-light px-4 py-2 font-medium">{t("cancel")}</button>
          )}
        </div>
      </form>
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-aldi-blue/10">
              <th className="p-3 text-left font-semibold text-aldi-blue">{t("aliasTerm")}</th>
              <th className="p-3 text-left font-semibold text-aldi-blue">{t("category")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {aliases.map((a) => (
              <tr key={a.alias_id} className="border-t border-aldi-muted-light">
                <td className="p-3 font-medium">{a.term_normalized}</td>
                <td className="p-3">{categories.find((c) => c.category_id === a.category_id)?.name ?? a.category_id}</td>
                <td className="p-3">
                  <button type="button" onClick={() => { setEditingAlias(a); setAliasForm({ term_normalized: a.term_normalized, category_id: a.category_id }); }} className="font-medium text-aldi-blue">{t("edit")}</button>
                  {a.id != null && <><span className="mx-1 text-aldi-muted">|</span><button type="button" onClick={() => deleteAlias(a.id!)} className="font-medium text-aldi-error">{t("delete")}</button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
