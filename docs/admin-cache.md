# Admin Cache

OctoCMS accelerates only the admin routes. Public `query()` reads keep their existing behavior.

Configure the admin cache in `cms/schema.json`:

```json
{
  "admin": {
    "cache": {
      "enabled": true,
      "branchRevalidateSeconds": 30,
      "staleIfErrorSeconds": 86400
    }
  }
}
```

All fields are optional. These values are the defaults, so existing projects do not need a migration.

- `enabled` controls the shared Next.js admin cache. The process-local L1 store remains active.
- `branchRevalidateSeconds` controls how often OctoCMS reconciles the active branch HEAD with GitHub.
- `staleIfErrorSeconds` controls how long the last snapshot remains readable during a GitHub outage. It must be greater than or equal to `branchRevalidateSeconds`.

Self-hosted Node uses Next.js in-memory caching. Vercel uses Next.js remote caching automatically. No Vercel SDK or cache-specific environment variables are required.
