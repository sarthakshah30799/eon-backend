import { Injectable } from "@nestjs/common";
import { Storage as GoogleCloudStorage } from "@google-cloud/storage";
import { ConfigService } from "../config/config.service";

@Injectable()
export class StorageService {
  private readonly gcs: GoogleCloudStorage;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.gcs = new GoogleCloudStorage({
      projectId: this.configService.getOptional("GCP_PROJECT_ID") || "",
      credentials: {
        private_key: (
          this.configService.getOptional("GCP_PRIVATE_KEY") || ""
        ).replace(/\\n/g, "\n"),
        client_email: this.configService.getOptional("GCP_CLIENT_EMAIL") || "",
      },
    });
    this.bucketName = this.configService.getOptional("GCP_BUCKET_NAME") || "";
  }

  async store(filename: string, data: Buffer | string): Promise<string> {
    const bucket = this.gcs.bucket(this.bucketName);
    const file = bucket.file(filename);

    await file.save(data);
    return file.publicUrl();
  }

  async retrieve(filename: string): Promise<string | null> {
    const bucket = this.gcs.bucket(this.bucketName);
    const file = bucket.file(filename);
    try {
      const [content] = await file.download();
      return content.toString("utf-8");
    } catch (error) {
      console.error("Error retrieving file from GCS:", error);
      return null;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the file path from the public URL
      const url = new URL(fileUrl);
      const filePath = url.pathname.split(`/${this.bucketName}/`).pop();

      if (!filePath) {
        throw new Error("Invalid file URL");
      }

      const file = this.gcs.bucket(this.bucketName).file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
      }
    } catch (error) {
      console.error("Error deleting file from GCS:", error);
      throw error;
    }
  }
}
