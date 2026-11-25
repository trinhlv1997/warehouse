/** Object storage port. R2 today; any S3-compatible store can implement it later. */
export interface StoredObject {
  body: ReadableStream;
  contentType: string | null;
  size: number;
  etag: string;
}

export interface StorageProvider {
  readonly provider: string;
  readonly available: boolean;
  put(key: string, data: ArrayBuffer | ReadableStream, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
