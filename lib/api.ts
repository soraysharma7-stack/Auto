import "server-only";

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { AppError, errorMessage } from "@/lib/errors";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("Request body must be valid JSON", 400, "INVALID_JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message ?? "Invalid request",
      422,
      "VALIDATION_ERROR",
    );
  }
  return result.data;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: "The request could not be completed", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function requireWorkerAuthorization(request: Request): void {
  const authorization = request.headers.get("authorization");
  const expected = process.env.WORKER_SECRET;
  if (!expected || expected.length < 32) {
    throw new AppError("Worker authentication is not configured", 503, "SETUP_REQUIRED");
  }
  if (authorization !== `Bearer ${expected}`) {
    throw new AppError("Invalid worker credentials", 401, "UNAUTHORIZED");
  }
}

export { errorMessage };
