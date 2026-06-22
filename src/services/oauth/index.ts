/**
 * Stub — OAuth service is not available in offline mode.
 * All methods throw. Use API Key authentication instead.
 */
export class OAuthService {
  async startOAuthFlow(): Promise<never> {
    throw new Error(
      'OAuth login is not available in offline mode. ' +
      'Use /login in the REPL to configure an API key.',
    )
  }

  handleManualAuthCodeInput(): void {
    throw new Error(
      'OAuth login is not available in offline mode.',
    )
  }

  cleanup(): void {
    // No-op — no OAuth resources to clean up
  }
}
