/**
 * Returns the base URL for API requests.
 *
 * Uses ANTHROPIC_BASE_URL env var when set (for custom endpoints / proxies),
 * otherwise defaults to api.anthropic.com.
 */
const BASE_API_URL: string =
  process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'

export function getBaseApiUrl(): string {
  return BASE_API_URL
}
