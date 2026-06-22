/**
 * Stubs — OAuth profile fetching is not available in offline mode.
 */

import type { OAuthProfileResponse } from 'src/services/oauth/types.js'

/** Always returns undefined in offline mode. */
export async function getOauthProfileFromApiKey(): Promise<OAuthProfileResponse | undefined> {
  return undefined
}

/** Always returns undefined in offline mode. */
export async function getOauthProfileFromOauthToken(
  _accessToken: string,
): Promise<OAuthProfileResponse | undefined> {
  return undefined
}
