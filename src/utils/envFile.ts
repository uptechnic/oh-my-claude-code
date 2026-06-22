/**
 * Utility to read .env files for informational purposes (auth status).
 * Writing to .env is intentionally not supported — for security, API
 * credentials should be configured via environment variables at startup,
 * not persisted to the working directory by the CLI.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ENV_FILENAME = '.env'

function getEnvFilePath(): string {
  return join(process.cwd(), ENV_FILENAME)
}

/** Parse a .env-style string into key-value pairs. */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/** Read existing .env file, return parsed key-value pairs. */
export function readEnvFile(): Record<string, string> {
  const path = getEnvFilePath()
  if (!existsSync(path)) return {}
  return parseEnvFile(readFileSync(path, 'utf-8'))
}

/**
 * Set environment variables on process.env for the current session only.
 * Does NOT persist to disk. Users should configure env vars at startup
 * (e.g. in their shell profile or a .env file they manage themselves).
 */
export function setSessionEnvVars(vars: Record<string, string>): void {
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value
  }
}

/**
 * The set of variables that the login flow can configure for the session.
 */
export const LOGIN_ENV_VAR_DEFS: {
  key: string
  label: string
  placeholder: string
  required: boolean
  advanced?: boolean
}[] = [
  {
    key: 'ANTHROPIC_BASE_URL',
    label: 'API Base URL',
    placeholder: 'https://api.deepseek.com/anthropic',
    required: true,
  },
  {
    key: 'ANTHROPIC_AUTH_TOKEN',
    label: 'Auth Token / API Key',
    placeholder: 'sk-...',
    required: true,
  },
  {
    key: 'ANTHROPIC_MODEL',
    label: 'Default Model',
    placeholder: 'deepseek-v4-pro[1m]',
    required: false,
    advanced: true,
  },
  {
    key: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    label: 'Opus-tier Model',
    placeholder: 'deepseek-v4-pro[1m]',
    required: false,
    advanced: true,
  },
  {
    key: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    label: 'Sonnet-tier Model',
    placeholder: 'deepseek-v4-pro[1m]',
    required: false,
    advanced: true,
  },
  {
    key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    label: 'Haiku-tier Model',
    placeholder: 'deepseek-v4-flash',
    required: false,
    advanced: true,
  },
  {
    key: 'ANTHROPIC_SMALL_FAST_MODEL',
    label: 'Small Fast Model',
    placeholder: 'deepseek-v4-flash',
    required: false,
    advanced: true,
  },
  {
    key: 'CLAUDE_CODE_SUBAGENT_MODEL',
    label: 'Subagent Model',
    placeholder: 'deepseek-v4-flash',
    required: false,
    advanced: true,
  },
  {
    key: 'CLAUDE_CODE_EFFORT_LEVEL',
    label: 'Effort Level',
    placeholder: 'max',
    required: false,
    advanced: true,
  },
]
