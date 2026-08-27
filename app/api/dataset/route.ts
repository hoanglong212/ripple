import type { NextResponse } from "next/server";
import { DATASET_SCOPE } from "@/lib/domain/packages";
import { errorResponse, successResponse } from "@/lib/http/responses";
import { getGraphRepository } from "@/lib/repositories/graph-repository";
import { DatasetService } from "@/lib/services/dataset-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const service = new DatasetService(getGraphRepository());
    const dataset = await service.getStats();
    return successResponse({ dataset }, { scope: DATASET_SCOPE });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
