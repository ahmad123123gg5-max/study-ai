const parseOpenAIError = async (response, fallbackMessage) => {
    const payload = (await response.json().catch(() => null));
    return payload?.error?.message || fallbackMessage;
};
export const createOpenAIChatCompletion = async ({ apiKey, model, messages, temperature = 0.7, maxTokens }) => {
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
    return text.trim();
};
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
