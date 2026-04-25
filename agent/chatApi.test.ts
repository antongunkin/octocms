/**
 * Tests for the package-level chat Route Handler
 * (`octocms/agent/chatApi.ts`). The user-app `route.ts` is a one-line
 * re-export, so this test file covers the whole stack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../types';
import type { AgentConfig } from './types';

const minimalConfig: Config = {
  projectName: 'T',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Posts',
      hasMany: true,
      fields: { title: { label: 'Title', format: 'string', required: true, entryTitle: true } },
    },
  },
} as unknown as Config;

const enabledAgentConfig: AgentConfig = {
  provider: { type: 'local', model: 'test', baseURL: 'http://x' },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 3,
  maxAttachmentBytes: 100,
  maxAttachmentsPerTurn: 1,
  totalBudgetUSD: 0,
};

beforeEach(async () => {
  vi.resetModules();
  vi.doMock('../lib/configStore', () => ({
    getConfig: () => minimalConfig,
    setConfig: vi.fn(),
  }));
  vi.doMock('next-auth/next', () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { name: 'Test' } }),
  }));
  vi.doMock('../admin/auth', () => ({ authOptions: {} }));
  vi.doMock('next/headers', () => ({
    cookies: () => ({ get: () => undefined }),
  }));
  // No-op chat provider — yields nothing so the SSE stream closes immediately.
  vi.doMock('./providers', () => ({
    getChatProvider: () => ({
      providerType: 'local',
      modelId: 'test',
      supportsNativePdf: false,
      // eslint-disable-next-line require-yield
      async *streamChat() {
        return;
      },
    }),
  }));
  const u = await import('./usage');
  u.resetUsage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonRequest(url: string, body: unknown, init?: RequestInit): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
}

async function readStreamText(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe('chatRoute — auth + body parsing', () => {
  it('404s when the agent feature is disabled', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => null, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const res = await chatRoute(jsonRequest('http://test/agent', { messages: [{ role: 'user', content: 'hi' }] }));
    expect(res.status).toBe(404);
  });

  it('401s when the user is not signed in', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    vi.doMock('next-auth/next', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
    const { chatRoute } = await import('./chatApi');
    const res = await chatRoute(jsonRequest('http://test/agent', { messages: [{ role: 'user', content: 'hi' }] }));
    expect(res.status).toBe(401);
  });

  it('400s when the JSON body cannot be parsed', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const res = await chatRoute(
      new Request('http://test/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/JSON/i);
  });

  it('400s when `messages` is empty', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const res = await chatRoute(jsonRequest('http://test/agent', { messages: [] }));
    expect(res.status).toBe(400);
  });

  it('opens an SSE stream with a meta event for valid JSON requests', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const res = await chatRoute(jsonRequest('http://test/agent', { messages: [{ role: 'user', content: 'hi' }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const text = await readStreamText(res);
    expect(text).toContain('event: meta');
    expect(text).toContain('"provider":"local"');
  });
});

describe('chatRoute — multipart attachments', () => {
  /**
   * Build a multipart Request whose round-trip through `request.formData()`
   * preserves filename + size metadata. Hand-rolled so we don't depend on
   * Node's FormData→Request serialization (which can drop filenames in Node 20).
   */
  function multipartRequest(
    messages: unknown,
    files: Array<{ name: string; type: string; body: string }>,
  ): Request {
    const boundary = '----TestBoundary' + Math.random().toString(36).slice(2);
    const CRLF = '\r\n';
    let body = '';
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="messages"${CRLF}${CRLF}`;
    body += `${JSON.stringify(messages)}${CRLF}`;
    for (const f of files) {
      body += `--${boundary}${CRLF}`;
      body += `Content-Disposition: form-data; name="files"; filename="${f.name}"${CRLF}`;
      body += `Content-Type: ${f.type}${CRLF}${CRLF}`;
      body += `${f.body}${CRLF}`;
    }
    body += `--${boundary}--${CRLF}`;
    return new Request('http://test/agent', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
  }

  it('400s on too many attachments', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const file = { name: 'a.txt', type: 'text/plain', body: 'ok' };
    const res = await chatRoute(
      multipartRequest([{ role: 'user', content: 'hi' }], [file, file]), // cap is 1
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Too many/);
  });

  it('400s on oversized attachments', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const tooBig = { name: 'big.txt', type: 'text/plain', body: 'x'.repeat(200) };
    const res = await chatRoute(multipartRequest([{ role: 'user', content: 'hi' }], [tooBig]));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds/);
  });

  it('emits an `attachments` SSE event when files are attached', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatRoute } = await import('./chatApi');
    const file = { name: 'note.txt', type: 'text/plain', body: 'hi' };
    const res = await chatRoute(multipartRequest([{ role: 'user', content: 'hi' }], [file]));
    expect(res.status).toBe(200);
    const text = await readStreamText(res);
    expect(text).toContain('event: attachments');
    expect(text).toContain('"filename":"note.txt"');
    expect(text).toContain('"status":"ok"');
  });
});

describe('chatRoute — abort', () => {
  it('closes the stream cleanly when the request is aborted mid-flight', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    // A provider that "hangs" — emits an event after a delay so we have time to abort.
    vi.doMock('./providers', () => ({
      getChatProvider: () => ({
        providerType: 'local',
        modelId: 'test',
        supportsNativePdf: false,
        async *streamChat() {
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 20));
            yield { type: 'text_delta', text: 'tick ' };
          }
          yield {
            type: 'message_stop',
            stopReason: 'end_turn',
            usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
          };
        },
      }),
    }));
    const { chatRoute } = await import('./chatApi');
    const ac = new AbortController();
    const req = new Request('http://test/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      signal: ac.signal,
    });
    const res = await chatRoute(req);
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    // Read at least the meta event so we know the stream is open.
    const first = await reader.read();
    expect(first.done).toBe(false);
    ac.abort();
    // Drain — should terminate without throwing on subsequent reads.
    let safetyCounter = 0;
    while (true) {
      const { done } = await reader.read();
      if (done) break;
      if (++safetyCounter > 50) throw new Error('Stream did not close after abort');
    }
    expect(safetyCounter).toBeLessThan(50);
  });
});

describe('chatStatusRoute', () => {
  it('404s when disabled', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => null, setAgentConfig: vi.fn() }));
    const { chatStatusRoute } = await import('./chatApi');
    const res = await chatStatusRoute();
    expect(res.status).toBe(404);
  });

  it('401s when the user is not signed in', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    vi.doMock('next-auth/next', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
    const { chatStatusRoute } = await import('./chatApi');
    const res = await chatStatusRoute();
    expect(res.status).toBe(401);
  });

  it('returns provider info when enabled', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { chatStatusRoute } = await import('./chatApi');
    const res = await chatStatusRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ enabled: true, provider: 'local', model: 'test' });
  });
});
