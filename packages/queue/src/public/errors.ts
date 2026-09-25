import { DjangoJsError, type DjangoJsErrorOptions } from '@django-js/core';

export class QueueError extends DjangoJsError {
  constructor(options: DjangoJsErrorOptions) {
    super(options);
    this.name = 'QueueError';
  }
}

export class JobNotFoundError extends QueueError {
  constructor(jobId: string, queueName?: string) {
    super({
      code: 'ERR_JOB_NOT_FOUND',
      message: `Job with ID "${jobId}" was not found${queueName ? ` in queue "${queueName}"` : ''}.`,
      metadata: { jobId, queueName },
      statusCode: 404,
    });
    this.name = 'JobNotFoundError';
  }
}

export class JobRegistrationError extends QueueError {
  constructor(message: string, jobType?: string) {
    super({
      code: 'ERR_JOB_REGISTRATION',
      message,
      metadata: jobType ? { jobType } : undefined,
      statusCode: 500,
    });
    this.name = 'JobRegistrationError';
  }
}

export class JobSerializationError extends QueueError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'ERR_JOB_SERIALIZATION',
      message,
      cause,
      statusCode: 500,
    });
    this.name = 'JobSerializationError';
  }
}

export class JobExecutionError extends QueueError {
  constructor(jobId: string, jobType: string, message: string, cause?: unknown) {
    super({
      code: 'ERR_JOB_EXECUTION_FAILED',
      message: `Job "${jobType}" [${jobId}] failed during execution: ${message}`,
      cause,
      metadata: { jobId, jobType },
      statusCode: 500,
    });
    this.name = 'JobExecutionError';
  }
}

export class JobTimeoutError extends QueueError {
  constructor(jobId: string, jobType: string, timeoutMs: number) {
    super({
      code: 'ERR_JOB_TIMEOUT',
      message: `Job "${jobType}" [${jobId}] timed out after ${timeoutMs}ms.`,
      metadata: { jobId, jobType, timeoutMs },
      statusCode: 504,
    });
    this.name = 'JobTimeoutError';
  }
}

export class QueueConnectionError extends QueueError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'ERR_QUEUE_CONNECTION',
      message,
      cause,
      statusCode: 503,
    });
    this.name = 'QueueConnectionError';
  }
}

export class WorkerShutdownError extends QueueError {
  constructor(message: string) {
    super({
      code: 'ERR_WORKER_SHUTDOWN',
      message,
      statusCode: 503,
    });
    this.name = 'WorkerShutdownError';
  }
}
