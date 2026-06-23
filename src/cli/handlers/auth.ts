/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import { performLogout } from '../../commands/logout/logout.js'
import { logEvent } from '../../services/analytics/index.js'
import {
  getAnthropicApiKeyWithSource,
  saveApiKey,
} from '../../utils/auth/auth.js'
import { saveGlobalConfig } from '../../utils/config/config.js'
import { isRunningOnHomespace } from '../../utils/platform/envUtils.js'
import {
  LOGIN_ENV_VAR_DEFS,
  readEnvFile,
  setSessionEnvVars,
} from '../../utils/config/envFile.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  buildAccountProperties,
  buildAPIProviderProperties,
} from '../../utils/rendering/status.js'

/**
 * Login by reading configuration from environment variables
 * (ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, model mappings, etc.)
 * and applying them to the current session only.
 *
 * No credentials are written to disk. For permanent configuration,
 * set environment variables before starting the program.
 */
export async function authLogin(): Promise<void> {
  const apiKey =
    process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    process.stderr.write(
      'No API key found in environment.\n' +
        'Set the following environment variables before running claude auth login:\n\n' +
        '  Required:\n' +
        '    ANTHROPIC_AUTH_TOKEN   Your API key / bearer token\n' +
        '    ANTHROPIC_BASE_URL     API endpoint URL\n\n' +
        '  Recommended:\n' +
        '    ANTHROPIC_MODEL              Default model name\n' +
        '    ANTHROPIC_DEFAULT_OPUS_MODEL     Opus-tier model\n' +
        '    ANTHROPIC_DEFAULT_SONNET_MODEL   Sonnet-tier model\n' +
        '    ANTHROPIC_DEFAULT_HAIKU_MODEL    Haiku-tier model\n' +
        '    ANTHROPIC_SMALL_FAST_MODEL       Fast/small model\n' +
        '    CLAUDE_CODE_SUBAGENT_MODEL       Subagent model\n' +
        '    CLAUDE_CODE_EFFORT_LEVEL         Thinking effort (low/medium/high/xhigh/max)\n\n' +
        'For permanent configuration, add these to your shell profile or .env file.\n' +
        'Then run: claude auth login\n',
    )
    process.exit(1)
  }

  try {
    logEvent('tengu_offline_login', {})

    // Apply env vars to current session (no disk persistence)
    const vars: Record<string, string> = {}
    for (const def of LOGIN_ENV_VAR_DEFS) {
      const value = process.env[def.key]
      if (value) vars[def.key] = value
    }
    if (Object.keys(vars).length > 0) {
      setSessionEnvVars(vars)
    }

    // Save auth token via the standard path (keychain/config) — this is the
    // only credential that gets persisted, for convenience across sessions
    await saveApiKey(apiKey)

    // Mark onboarding complete
    saveGlobalConfig(current => {
      if (current.hasCompletedOnboarding) return current
      return { ...current, hasCompletedOnboarding: true }
    })

    const baseUrl = process.env.ANTHROPIC_BASE_URL || '(default)'
    process.stdout.write(
      `Login successful (session-only).\n` +
      `  Base URL:  ${baseUrl}\n` +
      `  Auth:      configured\n\n` +
      `Note: This configuration is temporary. For permanent setup, add env vars\n` +
      `to your shell profile or .env file before starting the program.\n`,
    )
    process.exit(0)
  } catch (err) {
    process.stderr.write(`Login failed: ${String(err)}\n`)
    process.exit(1)
  }
}

export async function authStatus(opts: {
  json?: boolean
  text?: boolean
}): Promise<void> {
  const { source: apiKeySource } = getAnthropicApiKeyWithSource()
  const hasApiKeyEnvVar =
    !!process.env.ANTHROPIC_API_KEY && !isRunningOnHomespace()
  const hasAuthTokenEnvVar = !!process.env.ANTHROPIC_AUTH_TOKEN
  const loggedIn =
    apiKeySource !== 'none' ||
    hasApiKeyEnvVar ||
    hasAuthTokenEnvVar

  let authMethod: string = 'none'
  if (apiKeySource === 'apiKeyHelper') {
    authMethod = 'api_key_helper'
  } else if (apiKeySource !== 'none') {
    authMethod = 'api_key'
  } else if (hasApiKeyEnvVar) {
    authMethod = 'api_key'
  } else if (hasAuthTokenEnvVar) {
    authMethod = 'auth_token'
  }

  const envFileVars = readEnvFile()
  const envFileKeys = Object.keys(envFileVars)

  if (opts.text) {
    const properties = [
      ...buildAccountProperties(),
      ...buildAPIProviderProperties(),
    ]
    let hasAuthProperty = false
    for (const prop of properties) {
      const value =
        typeof prop.value === 'string'
          ? prop.value
          : Array.isArray(prop.value)
            ? prop.value.join(', ')
            : null
      if (value === null || value === 'none') {
        continue
      }
      hasAuthProperty = true
      if (prop.label) {
        process.stdout.write(`${prop.label}: ${value}\n`)
      } else {
        process.stdout.write(`${value}\n`)
      }
    }
    if (!hasAuthProperty && hasApiKeyEnvVar) {
      process.stdout.write('API key: ANTHROPIC_API_KEY\n')
    }

    if (process.env.ANTHROPIC_BASE_URL) {
      process.stdout.write(`Base URL: ${process.env.ANTHROPIC_BASE_URL}\n`)
    }
    if (process.env.ANTHROPIC_MODEL) {
      process.stdout.write(`Model: ${process.env.ANTHROPIC_MODEL}\n`)
    }
    if (process.env.CLAUDE_CODE_EFFORT_LEVEL) {
      process.stdout.write(`Effort: ${process.env.CLAUDE_CODE_EFFORT_LEVEL}\n`)
    }
    if (envFileKeys.length > 0) {
      process.stdout.write(`Config (.env): ${envFileKeys.length} variables found\n`)
    }

    if (!loggedIn) {
      process.stdout.write(
        'Not logged in. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY and run claude auth login.\n',
      )
    }
  } else {
    const apiProvider = getAPIProvider()
    const resolvedApiKeySource =
      apiKeySource !== 'none'
        ? apiKeySource
        : hasApiKeyEnvVar
          ? 'ANTHROPIC_API_KEY'
          : null
    const output: Record<string, string | boolean | number | null> = {
      loggedIn,
      authMethod,
      apiProvider,
    }
    if (resolvedApiKeySource) {
      output.apiKeySource = resolvedApiKeySource
    }
    if (process.env.ANTHROPIC_BASE_URL) {
      output.baseUrl = process.env.ANTHROPIC_BASE_URL
    }
    if (process.env.ANTHROPIC_MODEL) {
      output.model = process.env.ANTHROPIC_MODEL
    }
    if (envFileKeys.length > 0) {
      output.envFileVars = envFileKeys.length
    }

    process.stdout.write(jsonStringify(output, null, 2) + '\n')
  }
  process.exit(loggedIn ? 0 : 1)
}

export async function authLogout(): Promise<void> {
  try {
    await performLogout()
  } catch {
    process.stderr.write('Failed to log out.\n')
    process.exit(1)
  }
  process.stdout.write('Successfully removed API Key.\n')
  process.exit(0)
}
