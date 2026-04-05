import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import { AppError } from '../errors/app.error';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');
    this.region = this.configService.get<string>('AWS_REGION');

    const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
    const missing = required.filter((k) => !this.configService.get(k));
    if (missing.length) {
      this.logger.warn(`[S3] Missing env vars: ${missing.join(', ')} — file uploads will fail`);
    } else {
      this.logger.log(`[S3] Configured — bucket: ${this.bucket}, region: ${this.region}`);
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadToS3(buffer: Buffer, originalName: string, mimetype: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    const key = `prescriptions/prescription-${Date.now()}${ext}`;

    this.logger.log(`[S3] Uploading: key=${key}, size=${buffer.length} bytes, type=${mimetype}`);

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );
    } catch (err: any) {
      this.logger.error(`[S3] Upload failed: ${err.name} — ${err.message}`);
      if (err.$metadata) {
        this.logger.error(
          `[S3]    HTTP status: ${err.$metadata.httpStatusCode}, requestId: ${err.$metadata.requestId}`,
        );
      }
      const readable = new AppError(
        `S3 upload failed: ${err.name} — ${err.message}`,
        err.$metadata?.httpStatusCode || 500,
      );
      throw readable;
    }

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    this.logger.log(`[S3] Upload successful: ${url}`);
    return url;
  }
}
