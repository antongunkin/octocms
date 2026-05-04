/**
 * Route Handler for the `/media/[...slug]` proxy that serves uploaded
 * assets in both dev (local FS under `public/media/`) and prod (GitHub
 * Contents API). The user-app file at `src/app/media/[...slug]/route.ts`
 * is a thin re-export of `mediaRoute` plus a side-effect import of
 * `cms/__generated__/configInit`. `octocms init` / `octocms update`
 * scaffold that re-export via `mediaRouteTemplate` in `octocms/cli/lib/templates.ts`.
 *
 * Why a Route Handler at all? Vercel's deployed filesystem is immutable
 * after build, so an image committed to GitHub from the CMS UI never lands
 * in the function's `public/media/` directory. Routing image requests
 * through this handler lets `next/image` and bare `<img>` tags both work
 * transparently in dev and prod with no `remotePatterns` config.
 *
 * Branch behaviour: when the editor cookie `cms-active-branch` is set,
 * the handler reads from that feature branch first so editors see their
 * own uploads before publish; on miss it falls back to the published
 * content branch (`resolveContentBranch()`) so older assets keep
 * resolving. Editor responses ship with `private, max-age=60` so a CDN
 * never serves a feature-branch asset to a non-editor visitor.
 */

import fsPromises from 'fs/promises';
import path from 'path';

import { cookies } from 'next/headers';

import { isProductionMode, readGitHubBinaryFilePublic } from './github';

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

// Plain `Request`/`Response` (not `NextRequest`/`NextResponse`) so a duplicate
// `next` install in the package's node_modules during dev doesn't trip Next's
// route-validator type check on the user app's GET re-export.
export async function mediaRoute(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const { slug } = await params;
  const filename = slug.join('/');
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (isProductionMode()) {
    const activeBranch = (await cookies()).get('cms-active-branch')?.value;
    let buffer = await readGitHubBinaryFilePublic(`public/media/${filename}`, activeBranch);

    // Asset isn't on the editor's active branch — fall back to the published
    // branch so previews of pre-existing assets still resolve.
    if (!buffer && activeBranch) {
      buffer = await readGitHubBinaryFilePublic(`public/media/${filename}`);
    }

    if (!buffer) {
      return new Response(null, { status: 404 });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': activeBranch ? 'private, max-age=60' : 'public, max-age=31536000, immutable',
      },
    });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'media', filename);
    const data = await fsPromises.readFile(filePath);

    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
