import { Hono } from 'hono'
import { repoMode } from '../db/repo.js'
import { listAvailable, providers } from '../lib/providers/index.js'

export const healthRoutes = new Hono()

healthRoutes.get('/health', (c) =>
  c.json({
    ok: true,
    repo: repoMode(),
    providers: {
      available: listAvailable(),
      all: Object.fromEntries(
        Object.entries(providers).map(([k, v]) => [k, v.available]),
      ),
    },
  }),
)
