const cosineSimilarity = (left, right) => {
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    const length = Math.min(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        dot += left[index] * right[index];
        leftNorm += left[index] * left[index];
        rightNorm += right[index] * right[index];
    }
    if (leftNorm === 0 || rightNorm === 0) {
        return 0;
    }
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};
export class InMemoryVectorStore {
    backend = 'memory';
    points = new Map();
    isAvailable() {
        return true;
    }
    async upsert(points) {
        points.forEach((point) => {
            this.points.set(point.id, point);
        });
    }
    async search(vector, limit, filter) {
        const results = [];
        this.points.forEach((point) => {
            if (filter?.domain && point.payload.domain !== filter.domain) {
                return;
            }
            results.push({
                score: cosineSimilarity(vector, point.vector),
                payload: point.payload
            });
        });
        return results
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    }
    count() {
        return this.points.size;
    }
}
