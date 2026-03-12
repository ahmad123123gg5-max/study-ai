import net from 'node:net';
import tls from 'node:tls';
import { URL } from 'node:url';
import { isExpiredEnvelope } from './cache-layer.js';
const encodeCommand = (parts) => `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
const parseReply = (buffer, start = 0) => {
    if (start >= buffer.length) {
        return null;
    }
    const type = String.fromCharCode(buffer[start]);
    const lineEnd = buffer.indexOf('\r\n', start);
    if (lineEnd === -1) {
        return null;
    }
    const line = buffer.toString('utf8', start + 1, lineEnd);
    if (type === '+' || type === '-') {
        return { value: line, offset: lineEnd + 2 };
    }
    if (type === ':') {
        return { value: Number.parseInt(line, 10), offset: lineEnd + 2 };
    }
    if (type === '$') {
        const length = Number.parseInt(line, 10);
        if (length === -1) {
            return { value: null, offset: lineEnd + 2 };
        }
        const bodyStart = lineEnd + 2;
        const bodyEnd = bodyStart + length;
        if (bodyEnd + 2 > buffer.length) {
            return null;
        }
        return {
            value: buffer.toString('utf8', bodyStart, bodyEnd),
            offset: bodyEnd + 2
        };
    }
    if (type === '*') {
        const length = Number.parseInt(line, 10);
        if (length === -1) {
            return { value: null, offset: lineEnd + 2 };
        }
        let cursor = lineEnd + 2;
        const values = [];
        for (let index = 0; index < length; index += 1) {
            const parsed = parseReply(buffer, cursor);
            if (!parsed) {
                return null;
            }
            values.push(parsed.value);
            cursor = parsed.offset;
        }
        return { value: values, offset: cursor };
    }
    return null;
};
export class RedisCacheLayer {
    name = 'l2_redis';
    url;
    constructor(redisUrl) {
        this.url = redisUrl ? new URL(redisUrl) : null;
    }
    isAvailable() {
        return !!this.url;
    }
    async execute(commands) {
        if (!this.url) {
            throw new Error('Redis is not configured');
        }
        const isTls = this.url.protocol === 'rediss:';
        const port = this.url.port ? Number.parseInt(this.url.port, 10) : 6379;
        const host = this.url.hostname;
        const db = this.url.pathname ? this.url.pathname.replace(/^\//, '') : '';
        const username = decodeURIComponent(this.url.username || '');
        const password = decodeURIComponent(this.url.password || '');
        const commandQueue = [];
        if (password) {
            commandQueue.push(username ? ['AUTH', username, password] : ['AUTH', password]);
        }
        if (db && db !== '0') {
            commandQueue.push(['SELECT', db]);
        }
        commandQueue.push(...commands);
        const payload = commandQueue.map((command) => encodeCommand(command)).join('');
        const rawResponse = await new Promise((resolve, reject) => {
            const chunks = [];
            const socket = isTls
                ? tls.connect({ host, port }, () => {
                    socket.write(payload);
                })
                : net.connect({ host, port }, () => {
                    socket.write(payload);
                });
            socket.on('data', (chunk) => {
                chunks.push(Buffer.from(chunk));
            });
            socket.on('error', reject);
            socket.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            socket.on('close', (hadError) => {
                if (!hadError) {
                    resolve(Buffer.concat(chunks));
                }
            });
            setTimeout(() => {
                socket.end();
            }, 1500);
        });
        const responses = [];
        let offset = 0;
        while (offset < rawResponse.length) {
            const parsed = parseReply(rawResponse, offset);
            if (!parsed) {
                break;
            }
            responses.push(parsed.value);
            offset = parsed.offset;
        }
        return responses.slice(commandQueue.length - commands.length);
    }
    async get(key) {
        if (!this.url) {
            return null;
        }
        try {
            const [rawValue] = await this.execute([['GET', key]]);
            if (typeof rawValue !== 'string') {
                return null;
            }
            const entry = JSON.parse(rawValue);
            if (isExpiredEnvelope(entry)) {
                await this.delete(key);
                return null;
            }
            return entry;
        }
        catch {
            return null;
        }
    }
    async set(key, envelope) {
        if (!this.url) {
            return;
        }
        try {
            const ttlMs = Math.max(1, envelope.expiresAt - Date.now());
            await this.execute([[
                    'SET',
                    key,
                    JSON.stringify(envelope),
                    'PX',
                    String(ttlMs)
                ]]);
        }
        catch {
            // Redis is optional. Fail open.
        }
    }
    async delete(key) {
        if (!this.url) {
            return;
        }
        try {
            await this.execute([['DEL', key]]);
        }
        catch {
            // Redis is optional. Fail open.
        }
    }
}
