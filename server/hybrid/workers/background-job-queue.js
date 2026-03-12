import { randomUUID } from 'node:crypto';
export class BackgroundJobQueue {
    concurrency;
    handler;
    monitor;
    queue = [];
    jobs = new Map();
    activeWorkers = 0;
    constructor(concurrency, handler, monitor) {
        this.concurrency = concurrency;
        this.handler = handler;
        this.monitor = monitor;
    }
    pump() {
        while (this.activeWorkers < this.concurrency && this.queue.length > 0) {
            const jobId = this.queue.shift();
            if (!jobId) {
                return;
            }
            const job = this.jobs.get(jobId);
            if (!job || job.status !== 'queued') {
                continue;
            }
            this.activeWorkers += 1;
            job.status = 'running';
            job.updatedAt = new Date().toISOString();
            this.monitor.recordJobStatus('running');
            void this.handler(job.request)
                .then((response) => {
                job.status = 'completed';
                job.response = response;
                job.updatedAt = new Date().toISOString();
                this.monitor.recordJobStatus('completed');
            })
                .catch((error) => {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : 'Background job failed';
                job.updatedAt = new Date().toISOString();
                this.monitor.recordJobStatus('failed');
            })
                .finally(() => {
                this.activeWorkers -= 1;
                this.pump();
            });
        }
    }
    async enqueue(type, request) {
        const now = new Date().toISOString();
        const job = {
            id: randomUUID(),
            type,
            status: 'queued',
            createdAt: now,
            updatedAt: now,
            request
        };
        this.jobs.set(job.id, job);
        this.queue.push(job.id);
        this.monitor.recordJobStatus('queued');
        this.pump();
        return job;
    }
    get(jobId) {
        return this.jobs.get(jobId) || null;
    }
    summary() {
        return {
            queued: this.queue.length,
            activeWorkers: this.activeWorkers,
            totalJobs: this.jobs.size
        };
    }
}
