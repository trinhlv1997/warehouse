import type { StorageProvider, StoredObject } from "./types";

export class R2StorageProvider implements StorageProvider {
  readonly provider = "r2";
  readonly available = true;
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, data: ArrayBuffer | ReadableStream, contentType: string): Promise<void> {
    await this.bucket.put(key, data, { httpMetadata: { contentType } });
  }

  async get(key: string): Promise<StoredObject | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.httpMetadata?.contentType ?? null, size: obj.size, etag: obj.httpEtag };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
