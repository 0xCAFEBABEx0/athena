import type { Config } from 'payload'

/**
 * Workers-safe Payload logger configuration.
 *
 * Payload's default pino transport (pino-pretty) requires fs/worker threads,
 * which are not implemented in the workerd runtime ("fs.write not
 * implemented"). On Cloudflare we write structured JSON lines straight to
 * console so they land in Workers Logs / `wrangler tail`.
 *
 * Returns `undefined` off-Workers so local dev and the Vercel bridge keep the
 * default pretty logger.
 */
export const getLoggerConfig = (): Config['logger'] => {
  if (process.env.CF_WORKER !== '1') return undefined

  return {
    options: { level: process.env.LOG_LEVEL || 'info' },
    destination: {
      write: (msg: string) => {
        try {
          const parsed = JSON.parse(msg)
          const { level, msg: message, ...rest } = parsed
          const line = JSON.stringify({ level, message, ...rest })
          if (typeof level === 'number' && level >= 50) console.error(line)
          else if (typeof level === 'number' && level >= 40) console.warn(line)
          else console.log(line)
        } catch {
          console.log(msg)
        }
      },
    },
  }
}
