"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { db, type LocalProduct, type LocalCategoryAlias, type LocalProductSuggestion, type LocalSortingError } from "@/lib/db";
import { normalizeForSearch, findSimilarProductNames } from "@/lib/search/normalize";
import { getStoresSorted } from "@/lib/store/store-service";
import type { Category } from "@/types";

type Section = "products" | "aliases" | "crowdsourcing" | "errors";

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return prefix + "-" + crypto.randomUUID().slice(0, 8);
  }
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

function buildProduct(form: {
  name: string;
  brand: string;
  category_id: string;
  price: string;
  assortment_type: "daily_range" | "special";
}): LocalProduct {
  const now = new Date().toISOString();
  return {
    product_id: generateId("prod"),
    article_number: null,
    ean_barcode: null,
    name: form.name.trim(),
    name_normalized: normalizeForSearch(form.name.trim()),
    brand: form.brand.trim() || null,
    demand_group: null,
    demand_sub_group: null,
    category_id: form.category_id,
    price: form.price.trim() ? parseFloat(form.price) : null,
    price_updated_at: null,
    popularity_score: null,
    assortment_type: form.assortment_type,
    availability: "national",
    region: null,
    country: "DE",
    special_start_date: null,
    special_end_date: null,
    status: "active",
    source: "admin",
    crowdsource_status: null,
    created_at: now,
    updated_at: now,
  };
}

export function AdminClient() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [auth, setAuth] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [section, setSection] = useState<Section>("products");

  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [aliases, setAliases] = useState<LocalCategoryAlias[]>([]);
  const [suggestions, setSuggestions] = useState<LocalProductSuggestion[]>([]);
  const [errors, setErrors] = useState<LocalSortingError[]>([]);
  const [stores, setStores] = useState<{ store_id: string; name: string }[]>([]);

  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    category_id: "",
    price: "",
    assortment_type: "daily_range" as "daily_range" | "special",
  });
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [aliasForm, setAliasForm] = useState({ term_normalized: "", category_id: "" });
  const [editingAlias, setEditingAlias] = useState<LocalCategoryAlias | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [assignDemandGroupsLoading, setAssignDemandGroupsLoading] = useState(false);
  const [assignDemandGroupsProgress, setAssignDemandGroupsProgress] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/check");
      setAuth(res.ok);
    } catch {
      setAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuth(true);
      setPassword("");
    } else {
      setLoginError(true);
    }
  };

  const loadData = useCallback(async () => {
    const [prods, cats, al, sugg, errs, sts] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
      db.category_aliases.toArray(),
      db.product_suggestions.where("status").equals("pending").toArray(),
      db.sorting_errors.toArray(),
      getStoresSorted().then((s) => s.map((x) => ({ store_id: x.store_id, name: x.name }))),
    ]);
    setProducts(prods as LocalProduct[]);
    setCategories(cats);
    setAliases(al as LocalCategoryAlias[]);
    setSuggestions(sugg as LocalProductSuggestion[]);
    setErrors(errs as LocalSortingError[]);
    setStores(sts);
  }, []);

  useEffect(() => {
    if (auth === true) loadData();
  }, [auth, loadData]);

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.category_id) return;
    const prod = buildProduct(productForm);
    await db.products.add(prod as never);
    setProductForm({ name: "", brand: "", category_id: "", price: "", assortment_type: "daily_range" });
    await loadData();
  };

  const updateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const updated = {
      ...editingProduct,
      name: productForm.name.trim(),
      name_normalized: normalizeForSearch(productForm.name.trim()),
      brand: productForm.brand.trim() || null,
      category_id: productForm.category_id,
      price: productForm.price.trim() ? parseFloat(productForm.price) : null,
      assortment_type: productForm.assortment_type,
      updated_at: new Date().toISOString(),
    };
    await db.products.put(updated as never);
    setEditingProduct(null);
    setProductForm({ name: "", brand: "", category_id: "", price: "", assortment_type: "daily_range" });
    await loadData();
  };

  const deleteProduct = async (product_id: string) => {
    if (!confirm(t("confirmDeleteProduct"))) return;
    await db.products.where("product_id").equals(product_id).delete();
    await loadData();
  };

  const startEditProduct = (p: LocalProduct) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      brand: p.brand ?? "",
      category_id: p.category_id,
      price: p.price != null ? String(p.price) : "",
      assortment_type: p.assortment_type,
    });
  };

  const bulkImportCsv = async () => {
    const lines = csvText.trim().split(/\n/).filter(Boolean);
    if (lines.length === 0) {
      setCsvResult(t("csvNoLines"));
      return;
    }
    const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    const cols = lines[0].split(delim).map((c) => c.trim().toLowerCase());
    const getCol = (line: string, name: string) => {
      const idx = cols.indexOf(name);
      if (idx === -1) return "";
      return line.split(delim).map((c) => c.trim())[idx] ?? "";
    };
    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const name = getCol(line, "name") || line.split(delim).map((c) => c.trim())[0] || "";
      if (!name) continue;
      const category_id = getCol(line, "category_id") || getCol(line, "category") || categories[0]?.category_id || "";
      if (!category_id) continue;
      const prod = buildProduct({
        name,
        brand: getCol(line, "brand") || "",
        category_id,
        price: getCol(line, "price") || "",
        assortment_type: (getCol(line, "assortment_type") || "daily_range") as "daily_range" | "special",
      });
      await db.products.add(prod as never);
      added++;
    }
    setCsvResult(t("csvImported", { count: added }));
    setCsvText("");
    await loadData();
  };

  const addAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = normalizeForSearch(aliasForm.term_normalized.trim());
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
    await loadData();
  };

  const updateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlias) return;
    const term = normalizeForSearch(aliasForm.term_normalized.trim());
    if (!term || !aliasForm.category_id) return;
    await db.category_aliases.update(editingAlias.id!, {
      term_normalized: term,
      category_id: aliasForm.category_id,
    });
    setEditingAlias(null);
    setAliasForm({ term_normalized: "", category_id: "" });
    await loadData();
  };

  const deleteAlias = async (id: number) => {
    await db.category_aliases.delete(id);
    await loadData();
  };

  const approveSuggestion = async (s: LocalProductSuggestion) => {
    const similar = findSimilarProductNames(s.name_normalized, products);
    if (similar.length > 0 && !confirm(t("duplicateWarning", { names: similar.map((p) => p.name).join(", ") }))) return;
    const now = new Date().toISOString();
    const prod: LocalProduct = {
      product_id: generateId("prod"),
      article_number: null,
      ean_barcode: null,
      name: s.name,
      name_normalized: s.name_normalized,
      brand: null,
      demand_group: null,
      demand_sub_group: null,
      category_id: s.category_id,
      price: s.price,
      price_updated_at: null,
      popularity_score: null,
      assortment_type: "daily_range",
      availability: "national",
      region: null,
      country: "DE",
      special_start_date: null,
      special_end_date: null,
      status: "active",
      source: "crowdsourcing",
      crowdsource_status: "approved",
      created_at: now,
      updated_at: now,
    };
    await db.products.add(prod as never);
    await db.product_suggestions.update(s.id!, { status: "approved" });
    await loadData();
  };

  const rejectSuggestion = async (s: LocalProductSuggestion) => {
    await db.product_suggestions.update(s.id!, { status: "rejected" });
    await loadData();
  };

  const getStoreName = (store_id: string) => stores.find((s) => s.store_id === store_id)?.name ?? store_id;

  const runAssignDemandGroups = async () => {
    setAssignDemandGroupsLoading(true);
    setAssignDemandGroupsProgress(null);
    let totalAssigned = 0;
    let batchNum = 0;
    let totalEstimated = 0;
    try {
      for (;;) {
        batchNum++;
        const res = await fetch("/api/admin/assign-demand-groups", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setAssignDemandGroupsProgress(t("loginError") + " " + (data.error ?? res.statusText));
          break;
        }
        totalAssigned += data.assigned_this_batch ?? 0;
        if (batchNum === 1 && (data.total_remaining ?? 0) >= 0) {
          totalEstimated = totalAssigned + (data.total_remaining ?? 0);
        }
        const total = totalEstimated > 0 ? totalEstimated : totalAssigned + (data.total_remaining ?? 0);
        setAssignDemandGroupsProgress(
          data.done
            ? t("assignDemandGroupsDone", { count: totalAssigned })
            : t("assignDemandGroupsProgress", {
                batch: batchNum,
                assigned: totalAssigned,
                total: total || totalAssigned + (data.total_remaining ?? 0),
              })
        );
        if (data.done) break;
      }
    } finally {
      setAssignDemandGroupsLoading(false);
    }
  };

  if (auth === null) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl bg-white p-4">
        <p className="text-aldi-muted">{tCommon("loading")}</p>
      </main>
    );
  }

  if (auth === false) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-white p-4">
        <h1 className="mb-6 text-xl font-bold text-aldi-blue">{t("title")}</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-aldi-muted">{t("password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light px-4 py-3 focus:border-aldi-blue focus:outline-none"
              autoComplete="current-password"
            />
          </label>
          {loginError && <p className="text-sm font-medium text-aldi-error">{t("loginError")}</p>}
          <button type="submit" className="min-h-touch w-full rounded-xl bg-aldi-blue px-4 py-3 font-semibold text-white transition-colors hover:bg-aldi-blue/90">
            {t("login")}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white p-4">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="touch-target flex items-center justify-center rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50" aria-label={tCommon("back")}>←</Link>
        <h1 className="text-xl font-bold text-aldi-blue">{t("title")}</h1>
      </header>

      <nav className="mb-6 flex gap-2 border-b border-aldi-muted-light pb-2">
        {(["products", "aliases", "crowdsourcing", "errors"] as Section[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`min-h-touch rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              section === s ? "bg-aldi-blue text-white" : "bg-aldi-muted-light/40 text-aldi-text hover:bg-aldi-muted-light/70"
            }`}
          >
            {t(s)}
          </button>
        ))}
      </nav>

      {section === "products" && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-aldi-blue">{t("products")}</h2>
          {editingProduct ? (
            <form onSubmit={updateProduct} className="space-y-3 rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
              <input
                value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("productName")}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              />
              <input
                value={productForm.brand}
                onChange={(e) => setProductForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder={t("brand")}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              />
              <select
                value={productForm.category_id}
                onChange={(e) => setProductForm((f) => ({ ...f, category_id: e.target.value }))}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              >
                <option value="">{t("category")}</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                placeholder={t("price")}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              />
              <select
                value={productForm.assortment_type}
                onChange={(e) => setProductForm((f) => ({ ...f, assortment_type: e.target.value as "daily_range" | "special" }))}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              >
                <option value="daily_range">{t("dailyRange")}</option>
                <option value="special">{t("special")}</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 font-semibold text-white">{t("save")}</button>
                <button type="button" onClick={() => setEditingProduct(null)} className="min-h-touch rounded-xl border-2 border-aldi-muted-light px-4 py-2 font-medium">{t("cancel")}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={addProduct} className="space-y-3 rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
              <input
                value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("productName")}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
                required
              />
              <input
                value={productForm.brand}
                onChange={(e) => setProductForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder={t("brand")}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              />
              <select
                value={productForm.category_id}
                onChange={(e) => setProductForm((f) => ({ ...f, category_id: e.target.value }))}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
                required
              >
                <option value="">{t("category")}</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                placeholder={t("price")}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              />
              <select
                value={productForm.assortment_type}
                onChange={(e) => setProductForm((f) => ({ ...f, assortment_type: e.target.value as "daily_range" | "special" }))}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 focus:border-aldi-blue focus:outline-none"
              >
                <option value="daily_range">{t("dailyRange")}</option>
                <option value="special">{t("special")}</option>
              </select>
              <button type="submit" className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 font-semibold text-white">{t("addProduct")}</button>
            </form>
          )}

          <div className="rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
            <label className="mb-2 block text-sm font-semibold text-aldi-muted">{t("bulkImport")}</label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="name,brand,category_id,price,assortment_type"
              rows={4}
              className="w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 font-mono text-sm focus:border-aldi-blue focus:outline-none"
            />
            <button type="button" onClick={bulkImportCsv} className="mt-3 min-h-touch rounded-xl bg-aldi-text px-4 py-2 text-sm font-semibold text-white">{t("import")}</button>
            {csvResult && <p className="mt-2 text-sm text-aldi-muted">{csvResult}</p>}
          </div>

          <div className="rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
            <p className="mb-2 text-sm text-aldi-muted">
              {t("assignDemandGroups")} (Supabase: Produkte ohne demand_group per Claude zuordnen)
            </p>
            <button
              type="button"
              onClick={runAssignDemandGroups}
              disabled={assignDemandGroupsLoading}
              className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {assignDemandGroupsLoading ? "…" : t("assignDemandGroups")}
            </button>
            {assignDemandGroupsProgress && (
              <p className="mt-2 text-sm font-medium text-aldi-text">{assignDemandGroupsProgress}</p>
            )}
          </div>

          <div className="rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
            <p className="mb-2 text-sm text-aldi-muted">
              {t("assignDemandGroups")} (Supabase: Produkte ohne demand_group per Claude zuordnen)
            </p>
            <button
              type="button"
              onClick={runAssignDemandGroups}
              disabled={assignDemandGroupsLoading}
              className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {assignDemandGroupsLoading ? "…" : t("assignDemandGroups")}
            </button>
            {assignDemandGroupsProgress && (
              <p className="mt-2 text-sm font-medium text-aldi-text">{assignDemandGroupsProgress}</p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-aldi-blue/10">
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("productName")}</th>
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("brand")}</th>
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("category")}</th>
                  <th className="p-3 text-right font-semibold text-aldi-blue">{t("price")}</th>
                  <th className="p-3 font-semibold text-aldi-blue">{t("assortmentType")}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id} className="border-t border-aldi-muted-light">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-aldi-muted">{p.brand ?? "—"}</td>
                    <td className="p-3">{categories.find((c) => c.category_id === p.category_id)?.name ?? p.category_id}</td>
                    <td className="p-3 text-right tabular-nums">{p.price != null ? `€${p.price.toFixed(2)}` : "—"}</td>
                    <td className="p-3">{p.assortment_type}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => startEditProduct(p)} className="font-medium text-aldi-blue">{t("edit")}</button>
                      <span className="mx-1 text-aldi-muted">|</span>
                      <button type="button" onClick={() => deleteProduct(p.product_id)} className="font-medium text-aldi-error">{t("delete")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === "aliases" && (
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
      )}

      {section === "crowdsourcing" && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-aldi-blue">{t("crowdsourcing")}</h2>
          <p className="text-sm text-aldi-muted">{t("reviewSuggestions", { count: suggestions.length })}</p>
          <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-aldi-blue/10">
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("productName")}</th>
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("category")}</th>
                  <th className="p-3 text-right font-semibold text-aldi-blue">{t("price")}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
            <tbody>
              {suggestions.map((s) => {
                const similar = findSimilarProductNames(s.name_normalized, products);
                return (
                  <tr key={s.suggestion_id} className="border-t border-aldi-muted-light">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">{categories.find((c) => c.category_id === s.category_id)?.name ?? s.category_id}</td>
                    <td className="p-3 text-right tabular-nums">{s.price != null ? `€${s.price.toFixed(2)}` : "—"}</td>
                    <td className="p-3">
                      {similar.length > 0 && (
                        <span className="mb-1 block text-xs font-medium text-aldi-orange" title={similar.map((p) => p.name).join(", ")}>
                          {t("possibleDuplicate")}: {similar.map((p) => p.name).join(", ")}
                        </span>
                      )}
                      <button type="button" onClick={() => approveSuggestion(s)} className="font-medium text-aldi-success">{t("approve")}</button>
                      <span className="mx-1 text-aldi-muted">|</span>
                      <button type="button" onClick={() => rejectSuggestion(s)} className="font-medium text-aldi-error">{t("reject")}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {suggestions.length === 0 && <p className="text-aldi-muted">{t("noPendingSuggestions")}</p>}
        </section>
      )}

      {section === "errors" && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-aldi-blue">{t("errors")}</h2>
          <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-aldi-blue/10">
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("store")}</th>
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("reportedAt")}</th>
                  <th className="p-3 text-left font-semibold text-aldi-blue">{t("sortOrder")}</th>
                  <th className="p-3 font-semibold text-aldi-blue">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.error_id} className="border-t border-aldi-muted-light">
                    <td className="p-3 font-medium">{getStoreName(e.store_id)}</td>
                    <td className="p-3 text-aldi-muted">{new Date(e.reported_at).toLocaleString()}</td>
                    <td className="p-3">
                      <pre className="max-w-md overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(e.current_sort_order, null, 2)}
                      </pre>
                    </td>
                    <td className="p-3">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.length === 0 && <p className="text-aldi-muted">{t("noErrors")}</p>}
        </section>
      )}
    </main>
  );
}
