import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

interface EvaluationArchiveR2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export class EvaluationSheetArchiveStorageService {
  private static client: S3Client | null = null;

  static async upload(archiveId: number, html: string): Promise<void> {
    const config = this.getConfig();
    try {
      await this.getClient(config).send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: this.createObjectKey(archiveId),
          Body: html,
          ContentType: "text/html; charset=utf-8",
        }),
      );
    } catch (error) {
      console.error("[EvaluationSheetArchiveStorage] R2 upload failed", {
        archiveId,
        error,
      });
      throw new Error("❌ 評価シートHTMLのR2保存に失敗しました。スレッドは削除していません。");
    }
  }

  static getPublicUrl(archiveId: number): string {
    const { publicBaseUrl } = this.getConfig();
    return `${publicBaseUrl}/${this.createObjectKey(archiveId)}`;
  }

  static assertConfigured(): void {
    this.getConfig();
  }

  private static createObjectKey(archiveId: number): string {
    return `evaluation-sheets/${archiveId}.html`;
  }

  private static getClient(config: EvaluationArchiveR2Config): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  private static getConfig(): EvaluationArchiveR2Config {
    const endpoint = process.env.EVALUATION_ARCHIVE_R2_ENDPOINT?.trim();
    const accessKeyId = process.env.EVALUATION_ARCHIVE_R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.EVALUATION_ARCHIVE_R2_SECRET_ACCESS_KEY?.trim();
    const bucket = process.env.EVALUATION_ARCHIVE_R2_BUCKET?.trim();
    const publicBaseUrl = process.env.EVALUATION_ARCHIVE_PUBLIC_BASE_URL
      ?.trim()
      .replace(/\/+$/, "");
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      throw new Error(
        "❌ 評価シート用R2の設定が不足しています。EVALUATION_ARCHIVE_R2_* と EVALUATION_ARCHIVE_PUBLIC_BASE_URL を設定してください。",
      );
    }
    return { endpoint, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
  }
}
