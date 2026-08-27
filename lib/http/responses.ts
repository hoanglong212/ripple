import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NpmRegistryUnavailableError } from "@/lib/registry/npm-registry-client";
import {
  DatabaseUnavailableError,
  InvalidInputError,
  NotIndexedError,
} from "@/lib/services/errors";

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiEnvelope<
  Data extends Record<string, unknown>,
  Meta extends Record<string, unknown>,
> {
  data: Data;
  meta: Meta;
}

export function apiEnvelope<
  Data extends Record<string, unknown>,
  Meta extends Record<string, unknown>,
>(data: Data, meta: Meta): ApiEnvelope<Data, Meta> {
  return { data, meta };
}

export function successResponse<
  Data extends Record<string, unknown>,
  Meta extends Record<string, unknown>,
>(data: Data, meta: Meta): NextResponse {
  return NextResponse.json(apiEnvelope(data, meta));
}

function mappedErrorResponse(
  status: number,
  error: ApiErrorDetail,
): NextResponse {
  return NextResponse.json(apiEnvelope({}, { error }), { status });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return mappedErrorResponse(400, {
      code: "INVALID_INPUT",
      message: error.issues[0]?.message ?? "The request is invalid.",
    });
  }

  if (error instanceof InvalidInputError) {
    return mappedErrorResponse(400, {
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof NotIndexedError) {
    return mappedErrorResponse(404, {
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof DatabaseUnavailableError) {
    console.error("Ripple database request failed:", error.cause ?? error);
    return mappedErrorResponse(503, {
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof NpmRegistryUnavailableError) {
    console.error("npm registry request failed:", error.cause ?? error);
    return mappedErrorResponse(503, {
      code: error.code,
      message: error.message,
    });
  }

  console.error("Ripple application request failed:", error);
  return mappedErrorResponse(500, {
    code: "INTERNAL_ERROR",
    message: "Ripple could not complete this request.",
  });
}
