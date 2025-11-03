export type ChatRole = 'system' | 'user';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ApprovedChatPayload = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
};

const ALLOWED_ROOT_KEYS = new Set(['model', 'messages', 'temperature', 'max_tokens']);
const ALLOWED_MESSAGE_KEYS = new Set(['role', 'content']);
const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user']);

export class OpenAIError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;
  }
}

const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1/chat/completions';

const ZERO_RETENTION_HEADER = 'respond-no-retain';

const assertApprovedPayload = (payload: ApprovedChatPayload & Record<string, unknown>) => {
  const unexpectedRootKeys = Object.keys(payload).filter(
    (key) => !ALLOWED_ROOT_KEYS.has(key)
  );

  if (unexpectedRootKeys.length > 0) {
    throw new OpenAIError(
      `Payload contains unsupported root keys: ${unexpectedRootKeys.join(', ')}`
    );
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new OpenAIError('Payload must include at least one message.');
  }

  payload.messages.forEach((message, index) => {
    if (!message || typeof message !== 'object') {
      throw new OpenAIError(`Message at index ${index} is not an object.`);
    }

    const messageKeys = Object.keys(message);
    const unexpectedMessageKeys = messageKeys.filter(
      (key) => !ALLOWED_MESSAGE_KEYS.has(key)
    );
    if (unexpectedMessageKeys.length > 0) {
      throw new OpenAIError(
        `Message at index ${index} has unsupported keys: ${unexpectedMessageKeys.join(', ')}`
      );
    }

    if (!ALLOWED_ROLES.has(message.role)) {
      throw new OpenAIError(`Message at index ${index} uses an unsupported role: ${message.role}`);
    }

    if (typeof message.content !== 'string' || message.content.trim() === '') {
      throw new OpenAIError(`Message at index ${index} must include non-empty content.`);
    }
  });
};

export const callOpenAI = async (payload: ApprovedChatPayload): Promise<string> => {
  assertApprovedPayload(payload as ApprovedChatPayload & Record<string, unknown>);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIError('OpenAI API key is not configured.');
  }

  const response = await fetch(OPENAI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Processing-Options': ZERO_RETENTION_HEADER
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const status = response.status;
    let message = `OpenAI request failed with status ${status}.`;
    try {
      const errorBody = await response.text();
      if (errorBody) {
        message += ` ${errorBody}`;
      }
    } catch {
      // ignore
    }
    throw new OpenAIError(message, status);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new OpenAIError('OpenAI response was missing content.');
  }

  return content;
};

