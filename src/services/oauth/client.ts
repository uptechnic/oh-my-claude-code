/**
 * Stubs — OAuth client functions are not available in offline mode.
 * All network-dependent functions return sentinel values or throw.
 */

import type { AccountInfo } from '../../utils/config.js'
import type { OAuthTokens, SubscriptionType } from './types.js'

/** Always false in offline mode — API Key auth only. */
export function shouldUseClaudeAIAuth(_scopes: string[] | undefined): boolean {
  return false
}

export function parseScopes(scopeString?: string): string[] {
  return scopeString?.split(' ').filter(Boolean) ?? []
}

export function buildAuthUrl(): never {
  throw new Error('OAuth is not available in offline mode.')
}

export async function exchangeCodeForTokens(): Promise<never> {
  throw new Error('OAuth token exchange is not available in offline mode.')
}

export async function refreshOAuthToken(): Promise<OAuthTokens> {
  throw new Error('OAuth token refresh is not available in offline mode.')
}

export async function fetchAndStoreUserRoles(): Promise<void> {
  // No-op — no OAuth tokens to fetch roles for
}

export async function createAndStoreApiKey(): Promise<null> {
  return null // No OAuth-based API key creation
}

export function isOAuthTokenExpired(_expiresAt: number | null): boolean {
  return false // No OAuth tokens, never expired
}

export async function fetchProfileInfo(): Promise<{
  subscriptionType: SubscriptionType | null
  displayName?: string
  rateLimitTier: null
  hasExtraUsageEnabled: boolean | null
  billingType: null
  accountCreatedAt?: string
  subscriptionCreatedAt?: string
}> {
  return {
    subscriptionType: null,
    rateLimitTier: null,
    hasExtraUsageEnabled: null,
    billingType: null,
  }
}

/** Always returns null in offline mode. */
export async function getOrganizationUUID(): Promise<null> {
  return null
}

/** No-op — OAuth account info is not populated in offline mode. */
export async function populateOAuthAccountInfoIfNeeded(): Promise<boolean> {
  return false
}

/** No-op — no OAuth account info to store. */
export function storeOAuthAccountInfo(_info: {
  accountUuid: string
  emailAddress: string
  organizationUuid: string | undefined
  displayName?: string
  hasExtraUsageEnabled?: boolean
  billingType?: string
  accountCreatedAt?: string
  subscriptionCreatedAt?: string
}): void {
  // No-op
}
