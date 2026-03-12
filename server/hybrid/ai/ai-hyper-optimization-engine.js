import { createHash } from 'node:crypto';
import { buildKnowledgeGuardianInstruction } from '../../knowledge-validation.js';
const normalizeText = (value) => value.replace(/\s+/g, ' ').trim();
const contentToPlainText = (content) => {
    if (typeof content === 'string') {
        return content;
    }
    return content
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim();
};
export class AIHyperOptimizationEngine {
    groundingCache = new Map();
    compactHistory(history) {
        return history
            .slice(-6)
            .map((message) => ({
            role: message.role,
            content: normalizeText(contentToPlainText(message.content))
        }))
            .filter((message) => typeof message.content === 'string' && message.content.trim().length > 0);
    }
    createGroundingBlock(results, languageCode) {
        if (results.length === 0) {
            return '';
        }
        const cacheKey = createHash('sha1')
            .update(results.map((item) => `${item.id}:${item.updatedAt}`).join('|'))
            .digest('hex');
        const cached = this.groundingCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        const title = languageCode === 'ar'
            ? 'استخدم فقط الأدلة التالية كأساس معرفي معتمد:'
            : 'Use only the following grounded evidence as the approved knowledge context:';
        const block = [
            title,
            ...results.slice(0, 3).map((item, index) => [
                `${languageCode === 'ar' ? 'مرجع' : 'Reference'} ${index + 1}: ${item.sourceTitle}`,
                `${languageCode === 'ar' ? 'الموضوع' : 'Topic'}: ${item.title}`,
                `${languageCode === 'ar' ? 'المقتطف' : 'Excerpt'}: ${item.content}`
            ].join('\n'))
        ].join('\n\n');
        this.groundingCache.set(cacheKey, {
            value: block,
            expiresAt: Date.now() + 10 * 60 * 1000
        });
        return block;
    }
    buildUserContent(request) {
        const userMessagePart = {
            type: 'text',
            text: normalizeText(request.message)
        };
        const parts = [userMessagePart];
        if (request.attachmentText) {
            parts.push({
                type: 'text',
                text: [
                    'Attached source text:',
                    request.attachmentText.slice(0, 22000)
                ].join('\n')
            });
        }
        if ((request.attachmentImages || []).length > 0) {
            parts.push(...(request.attachmentImages || []));
        }
        if ((request.attachmentNotes || []).length > 0) {
            parts.push({
                type: 'text',
                text: `Attachment notes:\n- ${(request.attachmentNotes || []).join('\n- ')}`
            });
        }
        return parts.length === 1 ? userMessagePart.text : parts;
    }
    selectModel(requestedModel, decision, fastModel) {
        if (decision.complexity === 'simple' || decision.route === 'rag') {
            return fastModel;
        }
        return requestedModel || fastModel;
    }
    createResponseCacheKey(request, decision) {
        const fingerprint = createHash('sha1')
            .update(JSON.stringify({
            route: decision.route,
            model: decision.preferredModel || request.model,
            jsonMode: request.jsonMode,
            domain: request.validationContext.domain,
            language: request.validationContext.languageCode,
            featureHint: request.featureHint,
            knowledgeMode: request.knowledgeMode,
            systemInstruction: normalizeText(request.systemInstruction),
            message: normalizeText(request.message)
        }))
            .digest('hex');
        return `hybrid-response:${fingerprint}`;
    }
    buildMessages(request, groundedResults) {
        const messages = [];
        if (request.jsonMode) {
            messages.push({
                role: 'system',
                content: 'Return strictly valid JSON only. Do not include markdown fences or extra explanations.'
            });
        }
        const guardian = buildKnowledgeGuardianInstruction(request.validationContext);
        const systemInstruction = normalizeText(request.systemInstruction);
        const grounding = this.createGroundingBlock(groundedResults, request.validationContext.languageCode);
        messages.push({
            role: 'system',
            content: [systemInstruction, guardian, grounding].filter(Boolean).join('\n\n')
        });
        messages.push(...this.compactHistory(request.historyMessages));
        messages.push({
            role: 'user',
            content: this.buildUserContent(request)
        });
        const promptFingerprint = createHash('sha1')
            .update(JSON.stringify(messages))
            .digest('hex');
        return {
            messages,
            promptFingerprint
        };
    }
}
