import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns either the validated data or a NextResponse with 400 status.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  return result.data;
}

/**
 * Parse and validate URL search params against a Zod schema.
 */
export function validateSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> | NextResponse {
  const raw = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  return result.data;
}
