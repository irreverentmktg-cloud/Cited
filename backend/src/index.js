/**
 * index.js — Cited Railway API Server
 * Starts Express + registers routes + schedules nightly cron
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const cron      = require('node-cron');
const rateLimit = require('express-rate-limit');
const logger    = require('./lib/logger');
const { runNightlyJob } = require('./jobs/nightly');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Rate limit the analyze endpoint (it triggers LLM calls)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  message: { error: 'Too many requests — please wait a moment.' }
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/analyze',     analyzeLimiter, require('./routes/analyze'));
app.use('/api/brands',      require('./routes/brands'));
app.use('/api/scores',      require('./routes/scores'));
app.use('/api/prompts',     require('./routes/prompts'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/competitors', require('./routes/competitors'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Manual trigger for the nightly job (protected by a secret header)
app.post('/internal/run-nightly', (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ message: 'Job triggered' });
  runNightlyJob().catch(err => logger.error(`Manual job failed: ${err.message}`));
});

// ── Cron scheduler ────────────────────────────────────────────
const cronSchedule = process.env.NIGHTLY_CRON || '0 2 * * *';  // 2am UTC
cron.schedule(cronSchedule, () => {
  logger.info(`⏰ Cron triggered (${cronSchedule})`);
  runNightlyJob().catch(err => logger.error(`Cron job failed: ${err.message}`));
}, { timezone: 'UTC' });

logger.info(`Nightly job scheduled: ${cronSchedule} UTC`);

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Cited backend running on port ${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Supabase: ${process.env.SUPABASE_URL ? '✓ connected' : '✗ not configured (dry-run mode)'}`);
});

module.exports = app;
