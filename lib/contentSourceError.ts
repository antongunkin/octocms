export type ContentSourceCode = 'github_config' | 'github_auth' | 'github_unavailable' | 'github_rate_limit';

const PUBLIC_PREFIX = 'CMS_PUBLIC:';

/**
 * Thrown when the public site cannot load CMS content from GitHub (or config is invalid).
 * `message` uses a stable prefix so the client error boundary can recover details if `code` is lost in serialization.
 */
export class ContentSourceError extends Error {
  readonly code: ContentSourceCode;
  readonly userMessage: string;

  constructor(code: ContentSourceCode, userMessage: string, options?: { cause?: unknown }) {
    super(`${PUBLIC_PREFIX}${code}:${userMessage}`, options);
    this.name = 'ContentSourceError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function isContentSourceError(error: unknown): error is ContentSourceError {
  return error instanceof ContentSourceError;
}

/** Recover code + user text from a serialized error `message` (e.g. in the client error boundary). */
export function parseContentSourceFromMessage(message: string): {
  code: ContentSourceCode;
  userMessage: string;
} | null {
  if (!message.startsWith(PUBLIC_PREFIX)) return null;
  const rest = message.slice(PUBLIC_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon === -1) return null;
  const code = rest.slice(0, colon) as ContentSourceCode;
  const userMessage = rest.slice(colon + 1);
  if (
    code !== 'github_config' &&
    code !== 'github_auth' &&
    code !== 'github_unavailable' &&
    code !== 'github_rate_limit'
  ) {
    return null;
  }
  if (!userMessage) return null;
  return { code, userMessage };
}

type MapContext = { owner: string; repo: string; ref?: string };

/**
 * Map a GitHub REST / Octokit error from `repos.getContent` (and similar) to a public-facing error.
 */
export function mapGitHubApiErrorToContentSource(error: unknown, ctx: MapContext): ContentSourceError {
  const err = error as { status?: number; message?: string; response?: { data?: { message?: string } } };
  const status = err?.status;
  const detail =
    (typeof err?.response?.data?.message === 'string' && err.response.data.message) ||
    (typeof err?.message === 'string' && err.message) ||
    'Unknown error';

  if (status === 429) {
    return new ContentSourceError(
      'github_rate_limit',
      'GitHub rate limit exceeded. Please wait a few minutes and try again.',
      { cause: error },
    );
  }

  if (status === 401 || status === 403) {
    return new ContentSourceError(
      'github_auth',
      `This site could not read content from GitHub (${ctx.owner}/${ctx.repo}). For private repositories, set CMS_GITHUB_TOKEN with Contents: Read access. If you use a token, ensure it is valid and has access to this repository.`,
      { cause: error },
    );
  }

  if (typeof status === 'number' && status >= 500) {
    return new ContentSourceError('github_unavailable', 'GitHub is temporarily unavailable. Please try again later.', {
      cause: error,
    });
  }

  if (status === 404) {
    const refHint = ctx.ref ? ` (ref: ${ctx.ref})` : '';
    return new ContentSourceError(
      'github_auth',
      `Content was not found in GitHub at ${ctx.owner}/${ctx.repo}${refHint}. The branch or file may be missing, or the server may not have permission to read it.`,
      { cause: error },
    );
  }

  const lower = String(detail).toLowerCase();
  if (
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('network') ||
    lower.includes('socket')
  ) {
    return new ContentSourceError(
      'github_unavailable',
      'Could not reach GitHub to load content. Check your network connection and try again later.',
      { cause: error },
    );
  }

  return new ContentSourceError('github_unavailable', `Could not load content from GitHub (${detail}).`, {
    cause: error,
  });
}
