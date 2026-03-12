export class MultiLevelCacheSystem {
    layers;
    defaultTtlMs;
    monitor;
    constructor(layers, defaultTtlMs, monitor) {
        this.layers = layers;
        this.defaultTtlMs = defaultTtlMs;
        this.monitor = monitor;
    }
    buildEnvelope(value, ttlMs, metadata) {
        const createdAt = Date.now();
        return {
            value,
            createdAt,
            expiresAt: createdAt + ttlMs,
            metadata
        };
    }
    async get(key) {
        for (let index = 0; index < this.layers.length; index += 1) {
            const layer = this.layers[index];
            if (!layer.isAvailable()) {
                continue;
            }
            const entry = await layer.get(key);
            if (!entry) {
                continue;
            }
            const promotionTargets = this.layers.slice(0, index);
            await Promise.all(promotionTargets
                .filter((target) => target.isAvailable())
                .map((target) => target.set(key, entry)));
            return {
                value: entry.value,
                layer: layer.name
            };
        }
        return {
            value: null,
            layer: 'miss'
        };
    }
    async set(key, value, ttlMs = this.defaultTtlMs, metadata) {
        const envelope = this.buildEnvelope(value, ttlMs, metadata);
        await Promise.all(this.layers
            .filter((layer) => layer.isAvailable())
            .map((layer) => layer.set(key, envelope)));
    }
    async delete(key) {
        await Promise.all(this.layers
            .filter((layer) => layer.isAvailable())
            .map((layer) => layer.delete(key)));
    }
    recordCacheObservation(layer) {
        this.monitor.recordRequest('cache', 0, layer);
    }
}
