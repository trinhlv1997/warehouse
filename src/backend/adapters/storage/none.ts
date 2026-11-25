import { AppError } from "../../domain/errors";
import type { StorageProvider } from "./types";

/** Used when no storage binding is configured: the app keeps working, uploads are disabled. */
export class NoStorageProvider implements StorageProvider {
  readonly provider = "none";
  readonly available = false;
  async put(): Promise<void> {
    throw new AppError("STORAGE_UNAVAILABLE", "File storage is not configured");
  }
  async get() {
    return null;
  }
  async delete(): Promise<void> {}
}
