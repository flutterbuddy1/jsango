import { QueueConnectionError } from '../errors.js';
/**
 * Production Database Queue Driver leveraging @jsango/database
 * with safe SQL execution, leased claiming, and multi-worker safety.
 */
export class DatabaseQueueDriver {
    name = 'database';
    capabilities = {
        supportsPriority: true,
        supportsDelayedJobs: true,
        supportsVisibilityLease: true,
        maxPayloadBytes: 16 * 1024 * 1024,
    };
    db;
    tableName;
    tableEnsured = false;
    constructor(options) {
        this.db = options.databaseManager;
        this.tableName = options.tableName ?? 'jsango_jobs';
    }
    /**
     * Idempotently verifies or creates the jobs table.
     */
    async ensureTable() {
        if (this.tableEnsured) {
            return;
        }
        const ddl = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id VARCHAR(64) PRIMARY KEY,
        queue_name VARCHAR(128) NOT NULL,
        job_type VARCHAR(255) NOT NULL,
        payload TEXT NOT NULL,
        schema_version INT NOT NULL DEFAULT 1,
        status VARCHAR(32) NOT NULL,
        priority INT NOT NULL DEFAULT 0,
        attempt INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        timeout_ms INT NOT NULL DEFAULT 30000,
        retry_policy TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        scheduled_at BIGINT NOT NULL,
        locked_at BIGINT,
        locked_until BIGINT,
        locked_by VARCHAR(128),
        failed_at BIGINT,
        error TEXT
      )
    `;
        try {
            await this.db.query(ddl);
            this.tableEnsured = true;
        }
        catch (err) {
            throw new QueueConnectionError(`Failed to initialize queue table "${this.tableName}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async enqueue(job) {
        await this.ensureTable();
        const sql = `
      INSERT INTO ${this.tableName} (
        id, queue_name, job_type, payload, schema_version, status,
        priority, attempt, max_attempts, timeout_ms, retry_policy,
        created_at, scheduled_at, locked_at, locked_until, locked_by, failed_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const params = [
            job.id,
            job.queue,
            job.type,
            JSON.stringify(job.payload),
            job.schemaVersion,
            job.status,
            job.priority,
            job.attempt,
            job.maxAttempts,
            job.timeoutMs,
            JSON.stringify(job.retryPolicy),
            job.createdAt,
            job.scheduledAt,
            job.lockedAt ?? null,
            job.lockedUntil ?? null,
            job.lockedBy ?? null,
            job.failedAt ?? null,
            job.error ? JSON.stringify(job.error) : null,
        ];
        try {
            await this.db.query(sql, params);
        }
        catch (err) {
            throw new QueueConnectionError(`Failed to enqueue job "${job.id}" into database: ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async claim(queueName, workerId, leaseTimeoutMs, count = 1) {
        await this.ensureTable();
        const now = Date.now();
        return this.db.transaction(async (tx) => {
            const selectSql = `SELECT * FROM ${this.tableName} WHERE queue_name = ?`;
            const res = await tx.query(selectSql, [queueName]);
            const candidates = [];
            for (const row of res.rows) {
                if (row.status === 'completed' || row.status === 'cancelled' || row.status === 'failed') {
                    continue;
                }
                if (row.status === 'pending') {
                    candidates.push(row);
                    continue;
                }
                if (row.status === 'scheduled' && Number(row.scheduled_at) <= now) {
                    candidates.push(row);
                    continue;
                }
                if (row.status === 'processing' &&
                    row.locked_until !== null &&
                    row.locked_until !== undefined &&
                    now >= Number(row.locked_until)) {
                    candidates.push(row);
                }
            }
            if (candidates.length === 0) {
                return [];
            }
            // Sort candidate rows: priority DESC, scheduled_at / created_at ASC
            candidates.sort((a, b) => {
                const pA = Number(a.priority);
                const pB = Number(b.priority);
                if (pB !== pA) {
                    return pB - pA;
                }
                const tA = Number(a.scheduled_at || a.created_at);
                const tB = Number(b.scheduled_at || b.created_at);
                return tA - tB;
            });
            const selected = candidates.slice(0, count);
            const claimedJobs = [];
            for (const row of selected) {
                const newAttempt = Number(row.attempt) + 1;
                const lockedUntil = now + leaseTimeoutMs;
                const updateSql = `
          UPDATE ${this.tableName}
          SET status = ?,
              attempt = ?,
              locked_at = ?,
              locked_until = ?,
              locked_by = ?
          WHERE id = ?
        `;
                await tx.query(updateSql, ['processing', newAttempt, now, lockedUntil, workerId, row.id]);
                const updatedRow = {
                    ...row,
                    status: 'processing',
                    attempt: newAttempt,
                    locked_at: now,
                    locked_until: lockedUntil,
                    locked_by: workerId,
                };
                claimedJobs.push(this.mapRowToJob(updatedRow));
            }
            return claimedJobs;
        });
    }
    async acknowledge(queueName, jobId) {
        await this.ensureTable();
        const sql = `DELETE FROM ${this.tableName} WHERE queue_name = ? AND id = ?`;
        const res = await this.db.query(sql, [queueName, jobId]);
        return res.rowCount > 0;
    }
    async release(queueName, jobId, delayMs = 0, error) {
        await this.ensureTable();
        const now = Date.now();
        const scheduledAt = delayMs > 0 ? now + delayMs : now;
        const status = delayMs > 0 ? 'scheduled' : 'pending';
        const sql = `
      UPDATE ${this.tableName}
      SET status = ?,
          scheduled_at = ?,
          locked_at = ?,
          locked_until = ?,
          locked_by = ?,
          error = ?
      WHERE queue_name = ? AND id = ?
    `;
        const res = await this.db.query(sql, [
            status,
            scheduledAt,
            null,
            null,
            null,
            error ? JSON.stringify(error) : null,
            queueName,
            jobId,
        ]);
        return res.rowCount > 0;
    }
    async fail(queueName, jobId, error) {
        await this.ensureTable();
        const sql = `
      UPDATE ${this.tableName}
      SET status = ?,
          locked_at = ?,
          locked_until = ?,
          locked_by = ?,
          failed_at = ?,
          error = ?
      WHERE queue_name = ? AND id = ?
    `;
        const res = await this.db.query(sql, [
            'failed',
            null,
            null,
            null,
            Date.now(),
            JSON.stringify(error),
            queueName,
            jobId,
        ]);
        return res.rowCount > 0;
    }
    async cancel(queueName, jobId) {
        await this.ensureTable();
        const sql = `
      UPDATE ${this.tableName}
      SET status = ?,
          locked_at = ?,
          locked_until = ?,
          locked_by = ?
      WHERE queue_name = ? AND id = ?
    `;
        const res = await this.db.query(sql, ['cancelled', null, null, null, queueName, jobId]);
        return res.rowCount > 0;
    }
    async getJob(queueName, jobId) {
        await this.ensureTable();
        const sql = `SELECT * FROM ${this.tableName} WHERE queue_name = ? AND id = ?`;
        const res = await this.db.query(sql, [queueName, jobId]);
        if (res.rows.length === 0) {
            return undefined;
        }
        return this.mapRowToJob(res.rows[0]);
    }
    async clear(queueName) {
        await this.ensureTable();
        const sql = `DELETE FROM ${this.tableName} WHERE queue_name = ?`;
        await this.db.query(sql, [queueName]);
    }
    async getQueueDepth(queueName) {
        await this.ensureTable();
        const sql = `SELECT status FROM ${this.tableName} WHERE queue_name = ?`;
        const res = await this.db.query(sql, [queueName]);
        return res.rows.filter((r) => r.status === 'pending' || r.status === 'scheduled').length;
    }
    async getStats(queueName) {
        await this.ensureTable();
        const sql = `SELECT status FROM ${this.tableName} WHERE queue_name = ?`;
        const res = await this.db.query(sql, [queueName]);
        let pendingCount = 0;
        let scheduledCount = 0;
        let processingCount = 0;
        let completedCount = 0;
        let failedCount = 0;
        for (const row of res.rows) {
            switch (row.status) {
                case 'pending':
                    pendingCount++;
                    break;
                case 'scheduled':
                    scheduledCount++;
                    break;
                case 'processing':
                    processingCount++;
                    break;
                case 'completed':
                    completedCount++;
                    break;
                case 'failed':
                    failedCount++;
                    break;
            }
        }
        return {
            queueName,
            pendingCount,
            scheduledCount,
            processingCount,
            completedCount,
            failedCount,
        };
    }
    async close() {
        // Connection lifecycle is managed by DatabaseManager
    }
    mapRowToJob(row) {
        return {
            id: row.id,
            queue: row.queue_name,
            type: row.job_type,
            payload: typeof row.payload === 'string'
                ? JSON.parse(row.payload)
                : row.payload,
            schemaVersion: Number(row.schema_version),
            status: row.status,
            priority: Number(row.priority),
            attempt: Number(row.attempt),
            maxAttempts: Number(row.max_attempts),
            timeoutMs: Number(row.timeout_ms),
            retryPolicy: typeof row.retry_policy === 'string'
                ? JSON.parse(row.retry_policy)
                : row.retry_policy,
            createdAt: Number(row.created_at),
            scheduledAt: Number(row.scheduled_at),
            lockedAt: row.locked_at !== null && row.locked_at !== undefined && !isNaN(Number(row.locked_at))
                ? Number(row.locked_at)
                : undefined,
            lockedUntil: row.locked_until !== null &&
                row.locked_until !== undefined &&
                !isNaN(Number(row.locked_until))
                ? Number(row.locked_until)
                : undefined,
            lockedBy: row.locked_by ?? undefined,
            failedAt: row.failed_at !== null && row.failed_at !== undefined && !isNaN(Number(row.failed_at))
                ? Number(row.failed_at)
                : undefined,
            error: row.error
                ? typeof row.error === 'string'
                    ? JSON.parse(row.error)
                    : row.error
                : undefined,
        };
    }
}
//# sourceMappingURL=database.js.map