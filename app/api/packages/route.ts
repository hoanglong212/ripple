import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { DATASET_SCOPE } from "@/lib/domain/packages";
import { errorResponse, successResponse } from "@/lib/http/responses";
import { packageSearchSchema } from "@/lib/http/schemas";
import { getNpmRegistryClient } from "@/lib/registry/npm-registry-client";
import { getGraphRepository } from "@/lib/repositories/graph-repository";
import { PackageService } from "@/lib/services/package-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const input = packageSearchSchema.parse({
      query: request.nextUrl.searchParams.get("query") ?? undefined,
    });
    const service = new PackageService(
      getGraphRepository(),
      getNpmRegistryClient(),
    );
    const packages = await service.searchPackages(input.query);

    return successResponse(
      { packages },
      {
        catalogScope: "Public packages from the npm registry.",
        scope: DATASET_SCOPE,
      },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
