/**
 * How both apps reach Claude (the web app's Ask AI, the CMS Translate button).
 *
 * - Direct: `ANTHROPIC_API_KEY`, with `ANTHROPIC_BASE_URL` optional.
 * - Cloudflare AI Gateway with stored keys (BYOK): `ANTHROPIC_BASE_URL` is the
 *   gateway's Anthropic endpoint
 *   (`https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/anthropic`) and
 *   `CF_AIG_TOKEN` the gateway's token. The Anthropic key is kept in Cloudflare,
 *   so no `x-api-key` is sent and `ANTHROPIC_API_KEY` is ignored. A gateway
 *   spend limit answers 429.
 *
 * Returns options for `new Anthropic(...)`, or null when neither is configured.
 * `read` looks up one environment variable.
 */
export type AnthropicConnection = {
  apiKey: string
  baseURL?: string
  defaultHeaders?: Record<string, string | null>
}

export const anthropicConnection = (read: (key: string) => string | undefined): AnthropicConnection | null => {
  const baseURL = read('ANTHROPIC_BASE_URL')?.trim() || undefined
  const gatewayToken = read('CF_AIG_TOKEN')?.trim()
  if (gatewayToken && baseURL) {
    return {
      // The SDK needs some key; the null header below keeps it from being sent.
      apiKey: 'stored-in-ai-gateway',
      baseURL,
      defaultHeaders: { 'cf-aig-authorization': `Bearer ${gatewayToken}`, 'x-api-key': null },
    }
  }
  const apiKey = read('ANTHROPIC_API_KEY')?.trim()
  return apiKey ? { apiKey, ...(baseURL ? { baseURL } : {}) } : null
}
