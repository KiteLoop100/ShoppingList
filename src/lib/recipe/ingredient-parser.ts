/**
 * Parse German ingredient lines from recipe pages into {@link RecipeIngredient}.
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Section 2.2
 */

import { GERMAN_UNITS } from "@/lib/recipe/constants";
import type { RecipeIngredient } from "@/lib/recipe/types";

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

/** Extra aliases not covered by {@link GERMAN_UNITS} keys (lowercase → canonical). */
const EXTRA_UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gramm: "g",
  ml: "ml",
  kg: "kg",
  l: "l",
  stk: "Stk",
  stück: "Stk",
  el: "EL",
  tl: "TL",
  dose: "Dose",
  bund: "Bund",
  prise: "Prise",
  zehe: "Zehe",
  zehen: "Zehe",
};

type UnitEntry = { key: string; canonical: string };

function buildSortedUnitEntries(): UnitEntry[] {
  const map = new Map<string, string>();

  for (const [k, v] of Object.entries(GERMAN_UNITS)) {
    map.set(k.toLowerCase(), v);
    map.set(v.toLowerCase(), v);
  }
  for (const [k, v] of Object.entries(EXTRA_UNIT_ALIASES)) {
    map.set(k.toLowerCase(), v);
  }

  const entries: UnitEntry[] = [...map.entries()].map(([key, canonical]) => ({
    key,
    canonical,
  }));
  entries.sort((a, b) => b.key.length - a.key.length);
  return entries;
}

const SORTED_UNITS = buildSortedUnitEntries();

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function replaceUnicodeFractions(s: string): string {
  let out = s;
  for (const [sym, val] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.split(sym).join(String(val));
  }
  return out;
}

function parseLeadingFraction(token: string): number | null {
  const t = token.replace(",", ".");
  const slash = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    if (b === 0) return null;
    return a / b;
  }
  const num = Number(t);
  if (!Number.isNaN(num) && t !== "") return num;
  return null;
}

function matchCanonicalUnit(token: string): string | null {
  const lower = token.toLowerCase();
  for (const { key, canonical } of SORTED_UNITS) {
    if (lower === key) return canonical;
  }
  return null;
}

function stripOptionalPrefix(s: string): { rest: string; optional: boolean } {
  let rest = s;
  let optional = false;

  const optColon = /^optional:\s*/i;
  if (optColon.test(rest)) {
    optional = true;
    rest = rest.replace(optColon, "").trim();
  }

  const nachBelieben = /^nach\s+Belieben\s+/i;
  if (nachBelieben.test(rest)) {
    optional = true;
    rest = rest.replace(nachBelieben, "").trim();
  }

  const nb = /^n\.\s*B\.\s*/i;
  if (nb.test(rest)) {
    optional = true;
    rest = rest.replace(nb, "").trim();
  }

  return { rest, optional };
}

function extractTrailingParens(s: string): { text: string; notes: string[] } {
  let text = s;
  const notes: string[] = [];
  const re = /\s*\(([^)]*)\)\s*$/;
  while (re.test(text)) {
    const m = text.match(re);
    if (!m) break;
    notes.push(m[1].trim());
    text = text.replace(re, "").trim();
  }
  return { text, notes };
}

export interface AmountParse {
  value: number | null;
  /** When original was a range like "2-3", store note fragment. */
  rangeNote?: string;
  consumedTokens: number;
}

export function parseAmountFromTokens(tokens: string[]): AmountParse {
  if (tokens.length === 0) {
    return { value: null, consumedTokens: 0 };
  }

  const t0 = tokens[0];
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(t0);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return {
      value: (a + b) / 2,
      rangeNote: `${a}-${b}`,
      consumedTokens: 1,
    };
  }

  const frac = parseLeadingFraction(t0);
  if (frac !== null) {
    return { value: frac, consumedTokens: 1 };
  }

  return { value: null, consumedTokens: 0 };
}

/**
 * Parse a single German ingredient line into structured fields.
 */
export function parseIngredientString(raw: string): RecipeIngredient {
  const empty: RecipeIngredient = {
    name: normalizeWhitespace(raw),
    amount: null,
    unit: null,
    category: "",
    notes: "",
    is_optional: false,
  };

  if (!raw || !raw.trim()) {
    return { ...empty, name: "" };
  }

  let s = normalizeWhitespace(replaceUnicodeFractions(raw.trim()));

  const opt1 = stripOptionalPrefix(s);
  s = opt1.rest;
  let isOptional = opt1.optional;

  if (/^etwas\s+/i.test(s)) {
    s = s.replace(/^etwas\s+/i, "").trim();
    const base = parseIngredientString(s);
    const notes = ["etwas", base.notes].filter(Boolean).join(" ").trim();
    return {
      ...base,
      amount: null,
      unit: null,
      notes,
      is_optional: isOptional || base.is_optional,
    };
  }

  const paren = extractTrailingParens(s);
  s = paren.text;
  const parenNotes = paren.notes;

  const opt2 = stripOptionalPrefix(s);
  s = opt2.rest;
  isOptional = isOptional || opt2.optional;

  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return {
      ...empty,
      name: "",
      is_optional: isOptional,
    };
  }

  const ap = parseAmountFromTokens(tokens);
  let i = ap.consumedTokens;
  let amount: number | null = ap.value;
  const noteParts: string[] = [...parenNotes];
  if (ap.rangeNote) noteParts.push(ap.rangeNote);

  let unit: string | null = null;
  if (i < tokens.length) {
    const u = matchCanonicalUnit(tokens[i]);
    if (u !== null) {
      unit = u;
      i += 1;
    }
  }

  let name = tokens.slice(i).join(" ");

  if (amount === null && unit === null && name && !isOptional) {
    const reprise = /^(\d+)\s+(Prise)\s+(.+)$/i;
    const m = reprise.exec(s);
    if (m) {
      return {
        name: m[3].trim(),
        amount: Number(m[1]),
        unit: "Prise",
        category: "",
        notes: noteParts.join(" ").trim(),
        is_optional: false,
      };
    }
  }

  if (amount !== null && unit === null && /^Eier$/i.test(name.trim())) {
    unit = "Stk";
  }
  if (amount !== null && unit === null && /zehen$/i.test(name.trim())) {
    unit = "Stk";
  }

  return {
    name: name || s,
    amount,
    unit,
    category: "",
    notes: noteParts.join(" ").trim(),
    is_optional: isOptional,
  };
}
