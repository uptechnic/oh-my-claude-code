/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import { performLogout } from '../../commands/logout/logout.js'
import { logEvent } from '../../services/analytics/index.js'
import {
  getAnthropicApiKeyWithSource,
  saveApiKey,
} from '../../utils/auth.js'
import { saveGlobalConfig } from '../../utils/config.js'
import { isRunningOnHomespace } from '../../utils/envUtils.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  buildAccountProperties,
  buildAPIProviderProperties,
} from '../../utils/status.js'

/**
 * Login by reading an API Key from the environment variable
 * ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY, and persisting it
 * to the local config.
 */
export async function authLogin(): Promise<void> {
  // Read API key from env
  const apiKey =
    process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    process.stderr.write(
      'No API key found in environment.\n' +
        'Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY, then run:\n' +
        '  claude auth login\n',
    )
    process.exit(1)
  }

  try {
    logEvent('tengu_offline_login', {})
    await saveApiKey(apiKey)

    // Mark onboarding complete
    saveGlobalConfig(current => {
      if (current.hasCompletedOnboarding) return current
      return { ...current, hasCompletedOnboarding: true }
    })

    process.stdout.write('Login successful. API Key saved.\n')
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
  const { source: apiKeySource, key } = getAnthropicApiKeyWithSource()
  const hasApiKeyEnvVar =
    !!process.env.ANTHROPIC_API_KEY && !isRunningOnHomespace()
  const hasAuthTokenEnvVar = !!process.env.ANTHROPIC_AUTH_TOKEN
  const loggedIn =
    apiKeySource !== 'none' ||
    hasApiKeyEnvVar ||
    hasAuthTokenEnvVar

  // Determine auth method
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
    if (!loggedIn) {
      process.stdout.write(
        'Not logged in. Run claude auth login to configure your API key.\n',
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
    const output: Record<string, string | boolean | null> = {
      loggedIn,
      authMethod,
      apiProvider,
    }
    if (resolvedApiKeySource) {
      output.apiKeySource = resolvedApiKeySource
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

/**
 * Stub — OAuth token installation is not supported in offline mode.
 * Kept for backward compatibility with ConsoleOAuthFlow and print.ts
 * which still reference this function (to be removed in Phase 2/3).
 */
export async function installOAuthTokens(_tokens: unknown): Promise<void> {
  throw new Error(
    'OAuth login is not available in offline mode. ' +
    'Use claude auth login (with ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY set) ' +
    'or /login in the REPL to configure an API key.',
  )
}
