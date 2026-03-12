const parseOpenAIError = async (response, fallbackMessage) => {
    const payload = (await response.json().catch(() => null));
    return payload?.error?.message || fallbackMessage;
};
export const createOpenAIChatCompletionDetailed = async ({ apiKey, model, messages, temperature = 0.7, maxTokens }) => {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {})
        })
    });
    if (!upstream.ok) {
        throw new Error(await parseOpenAIError(upstream, 'AI provider request failed'));
    }
    const payload = await upstream.json().catch(() => null);
    const text = payload?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
        throw new Error('No text returned from AI provider');
    }
    return {
        text: text.trim(),
        model: typeof payload?.model === 'string' ? payload.model : model,
        usage: payload?.usage
            ? {
                promptTokens: payload.usage.prompt_tokens,
                completionTokens: payload.usage.completion_tokens,
                totalTokens: payload.usage.total_tokens
            }
            : undefined
    };
};
export const createOpenAIChatCompletion = async (options) => {
    const result = await createOpenAIChatCompletionDetailed(options);
    return result.text;
};
export const createOpenAIEmbeddings = async ({ apiKey, model, input }) => {
    const upstream = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            input
        })
    });
    if (!upstream.ok) {
        throw new Error(await parseOpenAIError(upstream, 'Embedding request failed'));
    }
    const payload = await upstream.json().catch(() => null);
    const vectors = (payload?.data || []).map((entry) => entry.embedding || []).filter((entry) => entry.length > 0);
    if (vectors.length === 0) {
        throw new Error('No embeddings returned from AI provider');
    }
    return vectors;
};
export async function* streamOpenAIChatCompletion({ apiKey, model, messages, temperature = 0.7, maxTokens }) {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            stream: true,
            stream_options: { include_usage: true },
            ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {})
        })
    });
    if (!upstream.ok) {
        throw new Error(await parseOpenAIError(upstream, 'AI stream request failed'));
    }
    const reader = upstream.body?.getReader();
    if (!reader) {
        throw new Error('AI stream body is unavailable');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let finalUsage;
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) {
                continue;
            }
            const data = line.slice(5).trim();
            if (!data) {
                continue;
            }
            if (data === '[DONE]') {
                yield { type: 'done', usage: finalUsage };
                return;
            }
            const payload = JSON.parse(data);
            if (payload.usage) {
                finalUsage = {
                    promptTokens: payload.usage.prompt_tokens,
                    completionTokens: payload.usage.completion_tokens,
                    totalTokens: payload.usage.total_tokens
                };
            }
            const delta = payload.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
                yield { type: 'delta', text: delta };
            }
        }
    }
    yield { type: 'done', usage: finalUsage };
}
export const transcribeOpenAIAudio = async ({ apiKey, model, audioBuffer, mimeType, fileName, language }) => {
    const formData = new FormData();
    formData.append('model', model);
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: mimeType || 'audio/webm' }), fileName || 'audio.webm');
    if (language) {
        formData.append('language', language);
    }
    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`
        },
        body: formData
    });
    if (!upstream.ok) {
        throw new Error(await parseOpenAIError(upstream, 'AI transcription failed'));
    }
    const payload = await upstream.json().catch(() => null);
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) {
        throw new Error('No transcription text returned');
    }
    return text;
};
export const synthesizeOpenAISpeech = async ({ apiKey, model, voice, text, responseFormat = 'mp3', instructions, speed }) => {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            voice,
            input: text,
            response_format: responseFormat,
            ...(instructions ? { instructions } : {}),
            ...(typeof speed === 'number' ? { speed } : {})
        })
    });
    if (!upstream.ok) {
        throw new Error(await parseOpenAIError(upstream, 'AI speech synthesis failed'));
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length) {
        throw new Error('No audio returned from AI provider');
    }
    const mimeTypeByFormat = {
        mp3: 'audio/mpeg',
        opus: 'audio/ogg',
        aac: 'audio/aac',
        flac: 'audio/flac',
        wav: 'audio/wav',
        pcm: 'audio/L16'
    };
    return {
        buffer,
        mimeType: mimeTypeByFormat[responseFormat] || 'audio/mpeg',
        extension: responseFormat
    };
};
