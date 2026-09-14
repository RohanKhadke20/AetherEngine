/**
 * Structured JSON logger — compatible with cloud log ingestion (e.g. GCP Cloud Logging, Datadog).
 * Emits newline-delimited JSON to stdout/stderr so log aggregators can parse fields directly.
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info('Worker initialized', { bodyCount: 42 });
 *   // → {"level":"info","msg":"Worker initialized","bodyCount":42,"ts":1726308492123}
 */
export const logger = {
  info: (msg, ctx = {}) =>
    console.log(JSON.stringify({ level: 'info', msg, ...ctx, ts: Date.now() })),
  warn: (msg, ctx = {}) =>
    console.log(JSON.stringify({ level: 'warn', msg, ...ctx, ts: Date.now() })),
  error: (msg, ctx = {}) =>
    console.error(JSON.stringify({ level: 'error', msg, ...ctx, ts: Date.now() })),
};
