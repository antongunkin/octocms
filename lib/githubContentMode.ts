/**
 * Runtime check: true when content reads use the GitHub API. True in
 * production builds; in dev, true only when `CMS_FORCE_GITHUB_API=true`.
 *
 * NOTE on bundler dead-code elimination: this is a function call, so the
 * bundler can't see through it. To gate dev-only filesystem code so it's
 * eliminated from production bundles, prefix the runtime check with an
 * inline `process.env.NODE_ENV` test in the SAME file:
 *
 *     if (process.env.NODE_ENV === 'production' || isProductionMode()) {
 *       // GitHub path — taken in prod, taken in dev when CMS_FORCE_GITHUB_API=true
 *     } else {
 *       // local FS path — DCE'd in prod, kept in dev
 *       fsPromises.readFile(path.join(process.cwd(), filePath), 'utf8');
 *     }
 *
 * Next.js statically replaces `process.env.NODE_ENV` with a string literal
 * at build time, so in production `'production' === 'production'` folds to
 * `true`, the `||` short-circuits, the `else` becomes unreachable, and the
 * bundler removes its `path.join(process.cwd(), …)` calls (which would
 * otherwise trip the NFT tracer into pulling in unrelated files like
 * `next.config.ts`). The replacement only happens for `process.env.NODE_ENV`
 * literals in the calling file — propagating a `const` exported from this
 * module across module boundaries is unreliable, so inline the check.
 */
export function isProductionMode(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return process.env.CMS_FORCE_GITHUB_API === 'true';
}

/**
 * True during Vercel's `next build` step. `VERCEL_REGION` is only set in serverless
 * runtime, so the cloned git checkout (with `cms/content/` on disk) is available here.
 */
export function isVercelBuildStep(): boolean {
  return process.env.VERCEL === '1' && !process.env.VERCEL_REGION;
}
