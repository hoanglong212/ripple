import type { DatasetStats, GraphRepository } from "@/lib/domain/packages";

export class DatasetService {
  constructor(private readonly repository: GraphRepository) {}

  getStats(): Promise<DatasetStats> {
    return this.repository.findDatasetStats();
  }
}
