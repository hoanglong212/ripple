import type { NextResponse } from "next/server";
import { DATASET_SCOPE, type ExplainPath } from "@/lib/domain/packages";
import {
  apiEnvelope,
  errorResponse,
  successResponse,
} from "@/lib/http/responses";
import {
  explainPathQuerySchema,
  versionIdSchema,
} from "@/lib/http/schemas";
import { getGraphRepository } from "@/lib/repositories/graph-repository";
import { VersionService } from "@/lib/services/version-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VersionRouteContext {
  params: Promise<{ versionId: string[] }>;
}

export function explainPathEnvelope(explanation: ExplainPath) {
  return apiEnvelope({ path: explanation }, { scope: DATASET_SCOPE });
}

export async function GET(
  request: Request,
  context: VersionRouteContext,
): Promise<NextResponse> {
  try {
    const parameters = await context.params;
    const isImpactRequest = parameters.versionId.at(-1) === "impact";
    const isPathRequest = parameters.versionId.at(-1) === "path";
    const versionIdSegments = isImpactRequest || isPathRequest
      ? parameters.versionId.slice(0, -1)
      : parameters.versionId;
    const versionId = versionIdSchema.parse(
      versionIdSegments.map(decodeURIComponent).join("/"),
    );
    const service = new VersionService(getGraphRepository());

    if (isPathRequest) {
      const url = new URL(request.url);
      const query = explainPathQuerySchema.parse({
        target: url.searchParams.get("target") ?? undefined,
      });
      const explanation = await service.explainPath(versionId, query.target);
      const envelope = explainPathEnvelope(explanation);
      return successResponse(envelope.data, envelope.meta);
    }

    if (isImpactRequest) {
      const impact = await service.getDownstreamImpact(versionId);

      return successResponse({ impact }, { scope: DATASET_SCOPE });
    }

    const version = await service.getVersion(versionId);

    return successResponse({ version }, { scope: DATASET_SCOPE });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
