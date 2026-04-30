import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ZodError } from 'zod'
import { env } from './env.js'
import { analyzeRoutes } from './routes/analyze.js'
import { brandRoutes } from './routes/brands.js'
import { healthRoutes } from './routes/health.js'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors({ origin: env.WEB_ORIGIN, credentials: true }))

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: 'invalid_input', message: err.message }, 400)
  }
  console.error(err)
  return c.json(
    {
      error: 'internal',
      message: err instanceof Error ? err.message : 'Unknown error',
    },
    500,
  )
})

app.route('/api', healthRoutes)
app.route('/api', analyzeRoutes)
app.route('/api', brandRoutes)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`cited server listening on http://localhost:${info.port}`)
})
