import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService implements OnModuleDestroy {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqs: SQSClient;
  /** Tracks active polling loops by queue URL */
  private readonly activeQueues = new Map<string, boolean>();

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    this.sqs = new SQSClient({
      region,
      credentials: {
        accessKeyId:     this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.logger.log(`[SQS] Initialized — region: ${region}`);
  }

  /** Send a message to the given queue URL. */
  async sendMessage(queueUrl: string, body: Record<string, unknown>): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl:    queueUrl,
        MessageBody: JSON.stringify(body),
      }),
    );
    this.logger.log(`[SQS] Sent to ${queueUrl}: ${JSON.stringify(body)}`);
  }

  /**
   * Start long-polling a queue. Calls `handler` for each message,
   * then deletes the message on success.
   */
  startPolling(
    queueUrl: string,
    handler: (body: Record<string, unknown>) => Promise<void>,
  ): void {
    if (!queueUrl) {
      this.logger.warn('[SQS] Consumer queue URL not configured — skipping polling');
      return;
    }
    if (this.activeQueues.has(queueUrl)) {
      this.logger.warn(`[SQS] Already polling ${queueUrl} — skipping duplicate`);
      return;
    }
    this.activeQueues.set(queueUrl, true);
    this.logger.log(`[SQS] Consumer polling started — queue: ${queueUrl}`);
    void this.pollLoop(queueUrl, handler);
  }

  private async pollLoop(
    queueUrl: string,
    handler: (body: Record<string, unknown>) => Promise<void>,
  ): Promise<void> {
    while (this.activeQueues.get(queueUrl)) {
      try {
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl:            queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds:     20, // long polling
          }),
        );

        for (const msg of result.Messages ?? []) {
          try {
            const body = JSON.parse(msg.Body ?? '{}') as Record<string, unknown>;
            await handler(body);
            // Delete only after successful handling
            await this.sqs.send(
              new DeleteMessageCommand({
                QueueUrl:      queueUrl,
                ReceiptHandle: msg.ReceiptHandle,
              }),
            );
          } catch (err: any) {
            this.logger.error(`[SQS] Handler error (msg not deleted): ${err.message}`);
          }
        }
      } catch (err: any) {
        if (this.activeQueues.get(queueUrl)) {
          this.logger.error(`[SQS] Poll error on ${queueUrl}: ${err.message} — retrying in 5s`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  onModuleDestroy() {
    for (const key of this.activeQueues.keys()) this.activeQueues.set(key, false);
    this.activeQueues.clear();
    this.logger.log('[SQS] All consumer polling stopped');
  }
}
