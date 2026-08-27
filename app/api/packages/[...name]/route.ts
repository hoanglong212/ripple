import type { NextResponse } from "next/server";
import { DATASET_SCOPE } from "@/lib/domain/packages";
import { errorResponse, successResponse } from "@/lib/http/responses";
import { packageNameSchema } from "@/lib/http/schemas";
import { getGraphRepository } from "@/lib/repositories/graph-repository";
import { PackageService } from "@/lib/services/package-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PackageRouteContext {
  params: Promise<{ name: string[] }>;
}

export async function GET(
  _request: Request,
  context: PackageRouteContext,
): Promise<NextResponse> {
  try {
    const parameters = await context.params;
    const name = packageNameSchema.parse(
      parameters.name.map(decodeURIComponent).join("/"),
    );
    const service = new PackageService(getGraphRepository());
    const packageDetail = await service.getPackage(name);

    return successResponse(
      { package: packageDetail },
      { scope: DATASET_SCOPE },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
