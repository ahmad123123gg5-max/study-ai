export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
}

export interface OpenAIChatCompletionOptions {
  apiKey: string;
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface OpenAIEmbeddingOptions {
  apiKey: string;
  model: string;
  input: string[];
}

export interface OpenAIChatCompletionUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface OpenAIChatCompletionDetailedResult {
  text: string;
  usage?: OpenAIChatCompletionUsage;
  model?: string;
}

export interface OpenAITranscriptionOptions {
  apiKey: string;
  model: string;
  audioBuffer: Buffer;
  mimeType: string;
  fileName: string;
  language?: string;
}

export interface OpenAISpeechOptions {
  apiKey: string;
  model: string;
  voice: string;
  text: string;
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  instructions?: string;
  speed?: number;
}

interface OpenAIErrorShape {
  error?: {
    message?: string;
  };
}

const parseOpenAIError = async (response: Response, fallbackMessage: string): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as OpenAIErrorShape | null;
  return payload?.error?.message || fallbackMessage;
};

export const createOpenAIChatCompletionDetailed = async ({
  apiKey,
  model,
  messages,
  temperature = 0.7,
  maxTokens
}: OpenAIChatCompletionOptions): Promise<OpenAIChatCompletionDetailedResult> => {
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

  const payload = await upstream.json().catch(() => null) as {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  } | null;

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

export const createOpenAIChatCompletion = async (options: OpenAIChatCompletionOptions): Promise<string> => {
  const result = await createOpenAIChatCompletionDetailed(options);
  return result.text;
};

export const createOpenAIEmbeddings = async ({
  apiKey,
  model,
  input
}: OpenAIEmbeddingOptions): Promise<number[][]> => {
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

  const payload = await upstream.json().catch(() => null) as {
    data?: Array<{ embedding?: number[] }>;
  } | null;

  const vectors = (payload?.data || []).map((entry) => entry.embedding || []).filter((entry) => entry.length > 0);
  if (vectors.length === 0) {
    throw new Error('No embeddings returned from AI provider');
  }

  return vectors;
};

export type OpenAIChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage?: OpenAIChatCompletionUsage };

export async function* streamOpenAIChatCompletion({
  apiKey,
  model,
  messages,
  temperature = 0.7,
  maxTokens
}: OpenAIChatCompletionOptions): AsyncGenerator<OpenAIChatStreamEvent> {
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
  let finalUsage: OpenAIChatCompletionUsage | undefined;

  const processStreamLine = (rawLine: string): OpenAIChatStreamEvent | null => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) {
      return null;
    }

    const data = line.slice(5).trim();
    if (!data) {
      return null;
    }

    if (data === '[DONE]') {
      return { type: 'done', usage: finalUsage };
    }

    const payload = JSON.parse(data) as {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      choices?: Array<{
        delta?: {
          content?: string;
        };
      }>;
    };

    if (payload.usage) {
      finalUsage = {
        promptTokens: payload.usage.prompt_tokens,
        completionTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens
      };
    }

    const delta = payload.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      return { type: 'delta', text: delta };
    }

    return null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const event = processStreamLine(rawLine);
      if (!event) {
        continue;
      }

      if (event.type === 'done') {
        yield event;
        return;
      }

      yield event;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const rawLine of buffer.split('\n')) {
      const event = processStreamLine(rawLine);
      if (!event) {
        continue;
      }

      if (event.type === 'done') {
        yield event;
        return;
      }

      yield event;
    }
  }

  yield { type: 'done', usage: finalUsage };
}

export const transcribeOpenAIAudio = async ({
  apiKey,
  model,
  audioBuffer,
  mimeType,
  fileName,
  language
}: OpenAITranscriptionOptions): Promise<string> => {
  const formData = new FormData();
  formData.append('model', model);
  formData.append(
    'file',
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType || 'audio/webm' }),
    fileName || 'audio.webm'
  );

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

  const payload = await upstream.json().catch(() => null) as { text?: string } | null;
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    throw new Error('No transcription text returned');
  }

  return text;
};

export const synthesizeOpenAISpeech = async ({
  apiKey,
  model,
  voice,
  text,
  responseFormat = 'mp3',
  instructions,
  speed
}: OpenAISpeechOptions): Promise<{ buffer: Buffer; mimeType: string; extension: string }> => {
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

  const mimeTypeByFormat: Record<string, string> = {
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
