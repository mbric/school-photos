import fs from "fs/promises";
import path from "path";

export interface StorageProvider {
  upload(file: Buffer, filename: string, eventId: string): Promise<{ storagePath: string }>;
  getUrl(storagePath: string): string;
  delete(storagePath: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), "uploads");
  }

  async upload(file: Buffer, filename: string, eventId: string) {
    const dir = path.join(this.basePath, eventId);
    await fs.mkdir(dir, { recursive: true });

    const storagePath = path.join(eventId, filename);
    const fullPath = path.join(this.basePath, storagePath);
    await fs.writeFile(fullPath, file);

    return { storagePath };
  }

  getUrl(storagePath: string): string {
    return `/api/photos/file/${storagePath}`;
  }

  async delete(storagePath: string) {
    const fullPath = path.join(this.basePath, storagePath);
    await fs.unlink(fullPath).catch(() => {});
  }
}

// Factory - can switch to S3 later
export function getStorage(): StorageProvider {
  return new LocalStorageProvider();
}
