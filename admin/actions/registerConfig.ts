/**
 * Side-effect module: runs `setConfig()` / `setAgentConfig()` via the generated
 * `cms/__generated__/configInit.ts`. Imported at the top of every admin server
 * action file so Next.js server-action bundles (which may omit layout and
 * catch-all `page.tsx`) still initialise the config singleton before `getConfig()`.
 *
 * Requires `tsconfig` path `cms/__generated__/*` → `./cms/__generated__/*`
 * (`octocms init` / `octocms update` add this).
 */
import 'cms/__generated__/configInit';
