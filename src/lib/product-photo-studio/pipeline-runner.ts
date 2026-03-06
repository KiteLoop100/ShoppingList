/**
 * Resumable pipeline runner with intermediate result persistence.
 * Wraps the photo studio pipeline to track steps in Supabase,
 * enabling restart from the last successful step on failure.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/utils/logger";

export type PipelineStep =
  | "classify"
  | "extract"
  | "bg_remove"
  | "enhance"
  | "verify"
  | "completed";

const STEP_ORDER: PipelineStep[] = [
  "classify",
  "extract",
  "bg_remove",
  "enhance",
  "verify",
  "completed",
];

export interface PipelineState {
  [key: string]: unknown;
}

interface StepContext {
  uploadId: string;
  supabase: SupabaseClient;
  state: PipelineState;
}

type StepFn<T> = (ctx: StepContext) => Promise<T>;

export class PipelineRunner {
  private uploadId: string;
  private supabase: SupabaseClient;
  private state: PipelineState;
  private completedStep: PipelineStep | null;

  constructor(uploadId: string, supabase: SupabaseClient) {
    this.uploadId = uploadId;
    this.supabase = supabase;
    this.state = {};
    this.completedStep = null;
  }

  async loadState(): Promise<void> {
    const { data } = await this.supabase
      .from("photo_uploads")
      .select("pipeline_step, pipeline_state")
      .eq("upload_id", this.uploadId)
      .single();

    if (data?.pipeline_state) {
      this.state = data.pipeline_state as PipelineState;
    }
    this.completedStep = (data?.pipeline_step as PipelineStep) ?? null;
    log.debug(
      "[pipeline-runner] loaded state for",
      this.uploadId,
      "last step:",
      this.completedStep,
    );
  }

  private shouldSkip(step: PipelineStep): boolean {
    if (!this.completedStep) return false;
    const completedIdx = STEP_ORDER.indexOf(this.completedStep);
    const currentIdx = STEP_ORDER.indexOf(step);
    return currentIdx <= completedIdx;
  }

  async runStep<T>(step: PipelineStep, fn: StepFn<T>): Promise<T> {
    if (this.shouldSkip(step)) {
      log.debug("[pipeline-runner] skipping completed step:", step);
      return this.state[step] as T;
    }

    log.debug("[pipeline-runner] running step:", step);
    await this.persistStep(step);

    const result = await fn({
      uploadId: this.uploadId,
      supabase: this.supabase,
      state: this.state,
    });

    this.state[step] = result;
    this.completedStep = step;
    await this.persistState(step);

    return result;
  }

  /**
   * Store a binary intermediate result in Supabase Storage.
   * Returns the storage path for later retrieval.
   */
  async storeIntermediate(
    buffer: Buffer,
    suffix: string,
    contentType: string,
  ): Promise<string> {
    const path = `pipeline/${this.uploadId}_${suffix}`;
    const { error } = await this.supabase.storage
      .from("product-photos")
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      log.warn("[pipeline-runner] intermediate store failed:", error.message);
      throw error;
    }
    return path;
  }

  async loadIntermediate(path: string): Promise<Buffer | null> {
    const { data, error } = await this.supabase.storage
      .from("product-photos")
      .download(path);

    if (error || !data) {
      log.warn("[pipeline-runner] intermediate load failed:", error?.message);
      return null;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  private async persistStep(step: PipelineStep): Promise<void> {
    await this.supabase
      .from("photo_uploads")
      .update({
        status: "pipeline_running",
        pipeline_step: step,
      })
      .eq("upload_id", this.uploadId);
  }

  private async persistState(step: PipelineStep): Promise<void> {
    const stateForDb = { ...this.state };
    for (const key of Object.keys(stateForDb)) {
      if (Buffer.isBuffer(stateForDb[key])) {
        delete stateForDb[key];
      }
    }

    await this.supabase
      .from("photo_uploads")
      .update({
        pipeline_step: step,
        pipeline_state: stateForDb,
      })
      .eq("upload_id", this.uploadId);
  }

  async markCompleted(): Promise<void> {
    this.completedStep = "completed";
    await this.supabase
      .from("photo_uploads")
      .update({
        pipeline_step: "completed",
        status: "completed",
      })
      .eq("upload_id", this.uploadId);
  }

  async markError(message: string): Promise<void> {
    await this.supabase
      .from("photo_uploads")
      .update({
        status: "error",
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      .eq("upload_id", this.uploadId);
  }

  getState(): PipelineState {
    return this.state;
  }
}
