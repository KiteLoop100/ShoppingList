/**
 * Admin batch-jobs API — client-driven batch processing.
 *
 * POST with { job_type, country? }:  Create a new job → returns { job_id }
 * POST with { job_id }:              Process ONE batch → returns updated status
 * GET  with ?job_id=...:             Pure status poll (no side effects)
 *
 * Each POST processes a single batch (~40 products ≈ 30-40s), staying well
 * within Vercel's maxDuration. The client loops POST { job_id } until done.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMAND_GROUPS_INSTRUCTION } from "@/lib/products/demand-groups-prompt";
import { loadCategories, buildCategoryListPrompt } from "@/lib/categories/constants";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { requireApiKey, requireAdminAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaude, ClaudeApiError, cleanJsonFences } from "@/lib/api/claude-client";

const batchJobContinueSchema = z.object({
  job_id: z.string().min(1),
});

const batchJobStartSchema = z.object({
  job_type: z.enum(["assign_demand_groups", "reclassify"]),
  country: z.string().min(1).max(5).optional(),
});

export const maxDuration = 120;
const BATCH_SIZE_ASSIGN = 50;
const BATCH_SIZE_RECLASSIFY = 40;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function callClaudeWithRetry(
  prompt: string,
  maxTokens: number
): Promise<{ text: string } | { error: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await callClaude({
        model: CLAUDE_MODEL_HAIKU,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      });
      return { text };
    } catch (e) {
      const isServerError = e instanceof ClaudeApiError && e.status >= 500;
      const isNetworkError = !(e instanceof ClaudeApiError);
      if (attempt < MAX_RETRIES && (isServerError || isNetworkError)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      if (e instanceof ClaudeApiError) {
        return { error: `Claude API ${e.status} – ${e.message.slice(0, 150)}` };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return { error: `Netzwerkfehler nach ${MAX_RETRIES + 1} Versuchen: ${msg}` };
    }
  }
  return { error: "Unreachable" };
}

// ----- GET: poll status (read-only) -----
export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const { data, error } = await supabase
    .from("batch_jobs")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// ----- POST: start a new job OR continue an existing one -----
export async function POST(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const apiKeyCheck = requireApiKey();
  if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- Mode 1: Continue an existing job (process one batch) ---
  const continueResult = batchJobContinueSchema.safeParse(rawBody);
  if (continueResult.success) {
    const { job_id } = continueResult.data;
    const { data: job, error: jobErr } = await supabase
      .from("batch_jobs")
      .select("*")
      .eq("job_id", job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "running") {
      return NextResponse.json(job);
    }

    const batchFn =
      job.job_type === "assign_demand_groups"
        ? processOneBatchAssign
        : processOneBatchReclassify;

    const result = await batchFn(supabase, job);
    return NextResponse.json(result);
  }

  // --- Mode 2: Start a new job ---
  const startResult = batchJobStartSchema.safeParse(rawBody);
  if (!startResult.success) {
    return NextResponse.json(
      { error: "Invalid input", details: startResult.error.flatten() },
      { status: 400 }
    );
  }
  const { job_type: jobType, country } = startResult.data;

  const jobId = generateJobId();
  await supabase.from("batch_jobs").insert({
    job_id: jobId,
    job_type: jobType,
    status: "running",
    country: country ?? null,
    current_batch: 0,
    total_processed: 0,
    total_updated: 0,
    total_remaining: null,
    log_lines: [],
  });

  return NextResponse.json({ job_id: jobId, status: "started" });
}

// ==================== Process ONE batch: Assign Demand Groups ====================
async function processOneBatchAssign(
  supabase: SupabaseClient,
  job: Record<string, unknown>,
) {
  const jobId = job.job_id as string;
  const country = job.country as string | null;
  const logs: string[] = Array.isArray(job.log_lines) ? [...(job.log_lines as string[])] : [];
  let totalUpdated = (job.total_updated as number) ?? 0;
  let batchNum = ((job.current_batch as number) ?? 0) + 1;
  let zeroStreak = 0;
  if (logs.length > 0) {
    const lastLog = logs[logs.length - 1];
    if (lastLog.includes("0 zugeordnet")) zeroStreak = 1;
  }

  let fetchQuery = supabase
    .from("products")
    .select("product_id, name")
    .is("demand_group", null)
    .eq("status", "active");
  if (country) fetchQuery = fetchQuery.eq("country", country);
  const { data: batch, error: fetchErr } = await fetchQuery.limit(BATCH_SIZE_ASSIGN);

  if (fetchErr) {
    logs.push(`❌ Batch ${batchNum}: DB-Fehler – ${fetchErr.message}`);
    return await markFailed(supabase, jobId, fetchErr.message, logs, batchNum, totalUpdated);
  }

  if (!batch || batch.length === 0) {
    logs.push(`✅ Fertig! ${totalUpdated} Produkte zugeordnet in ${batchNum - 1} Batches.`);
    return await markCompleted(supabase, jobId, logs, batchNum - 1, totalUpdated, 0);
  }

  const productList = batch.map((p) => `${p.product_id}: ${p.name ?? ""}`).join("\n");
  const prompt = `${DEMAND_GROUPS_INSTRUCTION}\n\nHier ist eine Liste von Produktnamen (Format: product_id: Name). Ordne jedem Produkt eine demand_group und demand_sub_group zu. Wähle aus der vorgegebenen Liste.\n\nProduktliste:\n${productList}\n\nAntworte ausschließlich mit einem JSON-Array. Kein Markdown, keine Backticks. Jedes Element: { "product_id": "uuid", "demand_group": "string", "demand_sub_group": "string or null" }.`;

  let parsed: Array<{ product_id: string; demand_group: string; demand_sub_group: string | null }> = [];
  const claudeResult = await callClaudeWithRetry(prompt, 4096);
    if ("error" in claudeResult) {
    logs.push(`❌ Batch ${batchNum}: ${claudeResult.error}`);
    return await markFailed(supabase, jobId, claudeResult.error, logs, batchNum, totalUpdated);
  }
  try {
    const cleaned = cleanJsonFences(claudeResult.text);
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`❌ Batch ${batchNum}: Parse-Fehler – ${msg}`);
    return await markFailed(supabase, jobId, msg, logs, batchNum, totalUpdated);
  }

  const byId = new Set(batch.map((p) => p.product_id));
  let batchUpdated = 0;
  const now = new Date().toISOString();
  for (const item of parsed) {
    if (!byId.has(item.product_id)) continue;
    const dg = typeof item.demand_group === "string" ? item.demand_group.trim() : null;
    const dsg = item.demand_sub_group != null && typeof item.demand_sub_group === "string" ? item.demand_sub_group.trim() || null : null;
    if (!dg) continue;
    const { error: updErr } = await supabase
      .from("products")
      .update({ demand_group: dg, demand_sub_group: dsg, updated_at: now })
      .eq("product_id", item.product_id);
    if (!updErr) batchUpdated++;
  }

  totalUpdated += batchUpdated;

  const { count: remaining } = await supabase
    .from("products")
    .select("product_id", { count: "exact", head: true })
    .is("demand_group", null)
    .eq("status", "active");

  logs.push(`✓ Batch ${batchNum}: ${batchUpdated} zugeordnet, ${remaining ?? 0} verbleibend`);

  if (batchUpdated === 0) {
    zeroStreak++;
    if (zeroStreak >= 2) {
      logs.push(`⚠ ${zeroStreak} Batches ohne Zuordnung – Abbruch`);
      return await markFailed(supabase, jobId, "Multiple zero-result batches", logs, batchNum, totalUpdated);
    }
  }

  if ((remaining ?? 0) === 0) {
    logs.push(`✅ Fertig! ${totalUpdated} Produkte zugeordnet in ${batchNum} Batches.`);
    return await markCompleted(supabase, jobId, logs, batchNum, totalUpdated, 0);
  }

  await supabase.from("batch_jobs").update({
    log_lines: logs,
    current_batch: batchNum,
    total_updated: totalUpdated,
    total_remaining: remaining ?? 0,
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);

  return await getJob(supabase, jobId);
}

// ==================== Process ONE batch: Reclassify ====================
async function processOneBatchReclassify(
  supabase: SupabaseClient,
  job: Record<string, unknown>,
) {
  const jobId = job.job_id as string;
  const country = job.country as string | null;
  const logs: string[] = Array.isArray(job.log_lines) ? [...(job.log_lines as string[])] : [];
  let totalUpdated = (job.total_updated as number) ?? 0;
  const currentOffset = (job.total_processed as number) ?? 0;
  const batchNum = ((job.current_batch as number) ?? 0) + 1;

  const CATEGORIES = await loadCategories(supabase);
  const CATEGORY_LIST = buildCategoryListPrompt(CATEGORIES);
  const VALID_IDS = new Set(CATEGORIES.map((c) => c.id));

  const VALID_ASSORTMENT = new Set(["daily_range", "special_food", "special_nonfood"]);
  const VALID_AVAILABILITY = new Set(["national", "regional", "seasonal"]);

  let query = supabase
    .from("products")
    .select("product_id, name, brand, category_id, assortment_type")
    .eq("status", "active");
  if (country) query = query.eq("country", country);
  const { data: batch, error: fetchErr } = await query
    .order("name", { ascending: true })
    .range(currentOffset, currentOffset + BATCH_SIZE_RECLASSIFY - 1);

  if (fetchErr) {
    logs.push(`❌ Batch ${batchNum}: DB-Fehler – ${fetchErr.message}`);
    return await markFailed(supabase, jobId, fetchErr.message, logs, batchNum, totalUpdated);
  }

  if (!batch || batch.length === 0) {
    logs.push(`✅ Fertig! ${totalUpdated} Produkte neu klassifiziert in ${batchNum - 1} Batches.`);
    return await markCompleted(supabase, jobId, logs, batchNum - 1, totalUpdated, 0);
  }

  const productList = batch.map((p) => {
    const brandPart = p.brand ? ` (${p.brand})` : "";
    return `${p.product_id}: ${p.name}${brandPart}`;
  }).join("\n");

  const prompt = `Du bist ein Supermarkt-Experte. Ordne jedem Produkt eine category_id, einen assortment_type, eine availability, is_private_label und is_seasonal zu.\n\nVerfügbare Kategorien:\n${CATEGORY_LIST}\n\nRegeln für assortment_type – es gibt genau 3 Werte:\n- "daily_range": Dauersortiment\n- "special_food": Food-Aktionsartikel\n- "special_nonfood": Non-Food-Aktionsartikel\n\nis_private_label: true = Eigenmarke, false = Fremdmarke, null = unbekannt\nis_seasonal: true = Saisonprodukt, false = kein Saisonprodukt\n\nProduktliste:\n${productList}\n\nAntworte NUR mit einem JSON-Array. Kein Markdown, keine Backticks.\n[{"product_id":"uuid","category_id":"uuid","assortment_type":"...","availability":"national oder regional oder seasonal","is_private_label":true/false/null,"is_seasonal":true/false}]`;

  let parsed: Array<{
    product_id: string;
    category_id: string;
    assortment_type: string;
    availability?: string;
    is_private_label?: boolean | null;
    is_seasonal?: boolean;
  }> = [];

  const claudeResult = await callClaudeWithRetry(prompt, 8192);
  if ("error" in claudeResult) {
    logs.push(`❌ Batch ${batchNum}: ${claudeResult.error}`);
    return await markFailed(supabase, jobId, claudeResult.error, logs, batchNum, totalUpdated);
  }
  try {
    const cleaned = cleanJsonFences(claudeResult.text);
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`❌ Batch ${batchNum}: Parse-Fehler – ${msg}`);
    return await markFailed(supabase, jobId, msg, logs, batchNum, totalUpdated);
  }

  const batchIds = new Set(batch.map((p) => p.product_id));
  let batchUpdated = 0;
  const now = new Date().toISOString();

  for (const item of parsed) {
    if (!batchIds.has(item.product_id)) continue;
    if (!VALID_IDS.has(item.category_id)) continue;
    const at = VALID_ASSORTMENT.has(item.assortment_type) ? item.assortment_type : "daily_range";
    const av = item.availability && VALID_AVAILABILITY.has(item.availability) ? item.availability : "national";
    const plVal = typeof item.is_private_label === "boolean" ? item.is_private_label : null;
    const seVal = item.is_seasonal === true;

    const { error: updErr } = await supabase
      .from("products")
      .update({
        category_id: item.category_id,
        assortment_type: at,
        availability: av,
        is_private_label: plVal,
        is_seasonal: seVal,
        updated_at: now,
      })
      .eq("product_id", item.product_id);
    if (!updErr) batchUpdated++;
  }

  totalUpdated += batchUpdated;
  const newOffset = currentOffset + batch.length;

  let countQuery = supabase
    .from("products")
    .select("product_id", { count: "exact", head: true })
    .eq("status", "active");
  if (country) countQuery = countQuery.eq("country", country);
  const { count: totalProducts } = await countQuery;

  logs.push(`✓ Batch ${batchNum}: ${batchUpdated} aktualisiert (${newOffset}/${totalProducts ?? 0})`);

  const done = batch.length < BATCH_SIZE_RECLASSIFY;

  if (done) {
    logs.push(`✅ Fertig! ${totalUpdated} Produkte neu klassifiziert in ${batchNum} Batches.`);
    return await markCompleted(supabase, jobId, logs, batchNum, totalUpdated, 0);
  }

  await supabase.from("batch_jobs").update({
    log_lines: logs,
    current_batch: batchNum,
    total_updated: totalUpdated,
    total_processed: newOffset,
    total_remaining: (totalProducts ?? 0) - newOffset,
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);

  return await getJob(supabase, jobId);
}

// ==================== Helpers ====================
async function getJob(
  supabase: SupabaseClient,
  jobId: string
) {
  const { data } = await supabase
    .from("batch_jobs")
    .select("*")
    .eq("job_id", jobId)
    .single();
  return data ?? { job_id: jobId, status: "unknown" };
}

async function markCompleted(
  supabase: SupabaseClient,
  jobId: string,
  logs: string[],
  batches: number,
  updated: number,
  remaining: number
) {
  await supabase.from("batch_jobs").update({
    status: "completed",
    log_lines: logs,
    current_batch: batches,
    total_updated: updated,
    total_remaining: remaining,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);
  return await getJob(supabase, jobId);
}

async function markFailed(
  supabase: SupabaseClient,
  jobId: string,
  errorMsg: string,
  logs: string[],
  batches: number,
  updated: number
) {
  await supabase.from("batch_jobs").update({
    status: "failed",
    error_message: errorMsg,
    log_lines: logs,
    current_batch: batches,
    total_updated: updated,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);
  return await getJob(supabase, jobId);
}
