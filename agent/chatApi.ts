/**
 * Packaged Route Handler for the chat-agent SSE endpoint.
 *
 * Lives inside `octocms/agent` so the user app keeps a thin re-export at
 * `app/api/octocms/agent/route.ts` (scaffolded by `octocms init` and `octocms update`,
 * see `octocms/cli/lib/templates.ts` → `agentChatRouteTemplate`). The user
 * file's only job is to side-effect-import `cms/__generated__/configInit` (so
 * `getAgentConfig()` resolves on cold start) and re-export {@link chatRoute}
 * as `POST`.
 *
 * **Stateless**: each request carries the full message history and any
 * uploaded attachments. Vercel-safe — no temp files, no cross-request memory.
 *
 * **Abort handling**: the request's `signal` is forwarded into a per-request
 * `AbortController`. The agent loop checks it between turns; the SSE stream
 * also cancels naturally when the client disconnects.
 */
import { cookies } from 'next/headers';

import { getCmsSession } from '../admin/auth/session';
import { getConfig } from '../lib/configStore';

import {
  checkAttachmentCount,
  checkAttachmentSize,
  normalizeAttachments,
  type AttachmentDiagnostic,
  type RawAttachment,
} from './attachments';
import { runChat, type ChatEvent } from './chat';
import { getAgentConfig } from './configStore';
import { isAgentEnabled } from './featureFlag';
import { getChatProvider } from './providers';
import type { NormalizedContentBlock, NormalizedMessage } from './providers/types';
import { buildSystemPrompt, type StyleExemplar } from './systemPrompt';

const CMS_ACTIVE_BRANCH_COOKIE = 'cms-active-branch';

type ChatRequestBody = {
  messages?: NormalizedMessage[];
  styleExemplars?: StyleExemplar[];
};

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * `POST /api/octocms/agent` — streams the chat response as SSE. Accepts both JSON
 * (no attachments — Phase 3/4 behaviour) and `multipart/form-data` (Phase 5,
 * with files). Auth-gated; 404 when the agent feature is disabled for this
 * deploy.
 */
export async function chatRoute(request: Request): Promise<Response> {
  const agentConfig = getAgentConfig();
  if (!agentConfig || !isAgentEnabled(agentConfig)) return notFound();

  const session = await getCmsSession();
  if (!session) return unauthorized();

  // Two body formats: JSON (no attachments — Phase 3/4 behaviour) and
  // multipart/form-data (Phase 5, with files). Detect via Content-Type.
  const contentType = request.headers.get('content-type') ?? '';
  let body: ChatRequestBody;
  let rawAttachments: RawAttachment[] = [];
  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest('Multipart body could not be parsed.');
    }
    const messagesField = form.get('messages');
    const exemplarsField = form.get('styleExemplars');
    try {
      body = {
        messages: typeof messagesField === 'string' ? (JSON.parse(messagesField) as NormalizedMessage[]) : [],
        styleExemplars:
          typeof exemplarsField === 'string' ? (JSON.parse(exemplarsField) as StyleExemplar[]) : undefined,
      };
    } catch {
      return badRequest('`messages` (and `styleExemplars`) must be JSON-encoded form fields.');
    }
    rawAttachments = await collectFormAttachments(form);
  } else {
    try {
      body = (await request.json()) as ChatRequestBody;
    } catch {
      return badRequest('Body must be JSON.');
    }
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return badRequest('`messages` must be a non-empty array.');

  const countError = checkAttachmentCount(rawAttachments.length, agentConfig);
  if (countError) return badRequest(countError);
  for (const a of rawAttachments) {
    const sizeError = checkAttachmentSize(a.bytes.length, agentConfig);
    if (sizeError) return badRequest(`${a.filename}: ${sizeError}`);
  }

  const config = getConfig();
  const branch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value || undefined;

  let provider;
  try {
    provider = getChatProvider(agentConfig.provider);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Failed to initialise chat provider.');
  }

  // Phase 5: turn raw uploads into normalised content blocks (PDF passes
  // through natively to Anthropic; everything else is text). Append them to
  // the LAST user message so the model sees them in the right turn.
  let attachmentDiagnostics: AttachmentDiagnostic[] = [];
  if (rawAttachments.length > 0) {
    const normalized = await normalizeAttachments(rawAttachments, {
      supportsNativePdf: provider.supportsNativePdf,
    });
    attachmentDiagnostics = normalized.diagnostics;
    if (normalized.blocks.length > 0) {
      attachLastUserMessage(messages, normalized.blocks);
    }
  }

  const systemPrompt = buildSystemPrompt({
    config,
    styleExemplars: body.styleExemplars,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // Controller already closed (client disconnected mid-write).
          closed = true;
        }
      };
      const send = (event: ChatEvent) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Forward the request abort signal so client-side aborts (the Stop
      // button, page navigation) cleanly stop the agent loop.
      const onAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener('abort', onAbort);

      // Initial provider info — UI shows "Local · qwen/qwen2.5-coder-14b" etc.
      safeEnqueue(
        encoder.encode(
          `event: meta\ndata: ${JSON.stringify({
            provider: provider.providerType,
            model: provider.modelId,
          })}\n\n`,
        ),
      );

      // Surface any attachment diagnostics (skipped files, etc.) to the client
      // BEFORE the agent loop runs, so the UI can render warnings inline.
      if (attachmentDiagnostics.length > 0) {
        safeEnqueue(
          encoder.encode(`event: attachments\ndata: ${JSON.stringify({ diagnostics: attachmentDiagnostics })}\n\n`),
        );
      }

      try {
        for await (const ev of runChat({
          agentConfig,
          config,
          systemPrompt,
          messages,
          provider,
          branch,
        })) {
          if (request.signal.aborted) break;
          send(ev);
          if (ev.type === 'done' || ev.type === 'error' || ev.type === 'budget_exceeded') break;
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Agent loop crashed.' });
      } finally {
        request.signal.removeEventListener('abort', onAbort);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/**
 * `GET /api/octocms/agent` — small health endpoint so the client can verify the
 * agent is enabled and read the active provider/model without opening a
 * stream. Auth-gated; 404 when disabled.
 */
export async function chatStatusRoute(): Promise<Response> {
  const agentConfig = getAgentConfig();
  if (!agentConfig || !isAgentEnabled(agentConfig)) return notFound();

  const session = await getCmsSession();
  if (!session) return unauthorized();

  const provider = agentConfig.provider;
  return new Response(
    JSON.stringify({
      enabled: true,
      provider: provider.type,
      model: provider.model,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Pull every `file` form field out of the multipart body. We don't validate
 * them here — `normalizeAttachments` does that — we just collect them.
 */
async function collectFormAttachments(form: FormData): Promise<RawAttachment[]> {
  const out: RawAttachment[] = [];
  // FormData.getAll('files') accepts an array uploaded under one field name.
  // We also accept indexed names ('files[0]', etc.) for robustness.
  const candidates: FormDataEntryValue[] = [];
  for (const v of form.getAll('files')) candidates.push(v);
  for (const [key, value] of form.entries()) {
    if (key === 'files' || key === 'messages' || key === 'styleExemplars') continue;
    if (key.startsWith('files[')) candidates.push(value);
  }
  for (const v of candidates) {
    if (typeof v === 'string') continue;
    const file = v as File;
    const ab = await file.arrayBuffer();
    out.push({
      filename: file.name || 'upload',
      mediaType: file.type || '',
      bytes: new Uint8Array(ab),
    });
  }
  return out;
}

/**
 * Append the given content blocks to the last user message in the history.
 * If the last message isn't a user turn (defensive — should never happen for
 * the request just sent), append a fresh user message instead.
 */
function attachLastUserMessage(messages: NormalizedMessage[], blocks: NormalizedContentBlock[]): void {
  const lastIdx = messages.length - 1;
  const last = messages[lastIdx];
  if (last && last.role === 'user') {
    const existing: NormalizedContentBlock[] =
      typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content];
    messages[lastIdx] = { role: 'user', content: [...existing, ...blocks] };
    return;
  }
  messages.push({ role: 'user', content: blocks });
}
