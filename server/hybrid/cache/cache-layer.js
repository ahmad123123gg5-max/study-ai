export const isExpiredEnvelope = (envelope) => !envelope || envelope.expiresAt <= Date.now();
