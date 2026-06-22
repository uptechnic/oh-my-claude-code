# Offline Mode Plan — Remove Online OAuth Login, Support API-Key-Only

## Goal

Remove Anthropic's OAuth authentication infrastructure (`platform.claude.com` /
`claude.com`) as the default (and only) behavior. Replace `/login` / `/logout` with local
API Key management. The app works with any API endpoint (DeepSeek, local LLM, proxy)
without phoning home to Anthropic services. Offline mode is the default — there is no
feature flag to toggle between online/offline.

## Current State (baseline)

The `.env` already bypasses most online paths — `ANTHROPIC_BASE_URL` points to DeepSeek,
`ANTHROPIC_AUTH_TOKEN` provides the bearer token directly. This causes
`isFirstPartyAnthropicBaseUrl()` to return `false`, which already skips Bootstrap, Settings
Sync, Remote Managed Settings, Datadog analytics, and Fast Mode checks. What remains is a
cleanup: removing the dead OAuth code and rewiring the user-facing login/logout surface.

---

## Phase 1 — Rewire `/login` and `/logout`

**Goal:** Replace the OAuth browser flow with a local API Key configuration UI. This is
the user-facing change.

### 1.1 Rewrite `/login` command

Files: `src/commands/login/index.ts`, `src/commands/login/login.tsx`

Current behavior: Opens `ConsoleOAuthFlow` inside a `Dialog` → browser OAuth → stores
OAuth tokens + API Key.

New behavior:
- Render a `Dialog` with a text input for the API Key (masked).
- On submit: validate the key with a lightweight test call (single message to the
  configured `ANTHROPIC_BASE_URL`).
- Store the key via the existing `saveGlobalConfig` / keychain path.
- Bump `authVersion` in AppState (preserve the existing reactivity pattern).
- Remove the `ConsoleOAuthFlow` import.

### 1.2 Rewrite `/logout` command

Files: `src/commands/logout/index.ts`, `src/commands/logout/logout.tsx`

Current behavior (`performLogout`):
1. Flush telemetry
2. Remove API Key from keychain/config
3. Wipe OAuth tokens from secure storage
4. Clear OAuth token cache, trusted device tokens, betas, GrowthBook, remote managed
   settings, policy limits
5. Save config with `oauthAccount: undefined`

New behavior:
- Keep step 1 (flush telemetry) — still useful locally.
- Keep step 2 (remove API Key).
- Remove steps 3–5 (OAuth-specific cleanup).
- Add: clear any cached API Key from memory.

### 1.3 Rewire `claude auth` CLI

File: `src/cli/handlers/auth.ts`

- `authLogin()` (lines 112–230): Remove OAuth flow, replace with:
  - Read `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` from env / prompt the user.
  - Store it to `~/.claude.json` → `primaryApiKey`.
- `authLogout()`: Remove OAuth-specific cleanup. Only clear the stored API Key.
- `authStatus()` (lines 232–319): Remove OAuth token checks from the `loggedIn`
  computation; only check API Key presence.

### 1.4 Disable `/login` when using 3P services

File: `src/commands.ts:337`

Current check: `!isUsing3PServices()` gates login/logout registration.

No change needed — the existing logic already conditionally excludes login from the REPL
when using Bedrock/Vertex/Foundry. Offline mode behaves the same way.

### 1.5 Remove OAuth imports from main.tsx

File: `src/main.tsx`

- Remove any OAuth-related imports and initialization (profile loading, token refresh on
  startup).

---

## Phase 2 — Remove OAuth Service Layer

**Goal:** Delete the OAuth-specific modules entirely.

### 2.1 Remove OAuth service directory

Delete: `src/services/oauth/` (entire directory)

Contents:
- `index.ts` — `OAuthService` class (PKCE flow)
- `crypto.ts` — `codeVerifier`/`codeChallenge` generation
- `auth-code-listener.ts` — localhost HTTP server for redirect capture
- `client.ts` — token exchange, profile fetch
- `getOauthProfile.ts` — profile fetch helpers

### 2.2 Remove OAuth constants

Delete: `src/constants/oauth.ts`

This file defines:
- Production/staging/local OAuth URLs (`platform.claude.com`, `claude.com`,
  `api.anthropic.com`)
- Client ID `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Scope definitions
- `BASE_API_URL` used by bootstrap.ts

If `BASE_API_URL` is needed elsewhere, extract just that value to a separate constants
file. Otherwise delete the entire file.

### 2.3 Remove CLI auth handler OAuth paths

File: `src/cli/handlers/auth.ts`

- Remove `startOAuthFlow()` call and surrounding logic.
- Remove `OAuthService` import.
- Remove `installOAuthTokens()`, `refreshOAuthToken()`, `refreshAndClearOAuthToken()`.
- Remove OAuth-specific CLI flags (`--email`, `--sso`, `--console`, `--claudeai`).

---

## Phase 3 — Simplify `src/utils/auth.ts`

**Goal:** Strip OAuth token management; keep only API Key paths.

### 3.1 Remove OAuth token functions

Remove the following exports from `src/utils/auth.ts`:

| Function | Rationale |
|----------|-----------|
| `getClaudeAIOAuthTokens()` | No OAuth tokens stored |
| `saveClaudeAIOAuthTokens()` | No OAuth tokens to save |
| `clearClaudeAIOAuthTokens()` | No OAuth tokens to clear |
| `checkAndRefreshOAuthTokenIfNeeded()` | No token refresh needed for API keys |
| `refreshOAuthToken()` | No OAuth flow |
| `handleOAuth401Error()` | API Key 401s are terminal, not refreshable |
| `installOAuthTokens()` | No OAuth installation |
| `hasProfileScope()` | No OAuth scopes |
| `getOauthAccountInfo()` | No OAuth account |
| `isClaudeAISubscriber()` | Always `false` — all users are API users |
| `getSubscriptionType()` | Always return `null` |
| `isManagedOAuthContext()` | No managed OAuth — always `false` |

### 3.2 Simplify `getAuthTokenSource()` (lines 153–206)

After cleanup, only these sources remain:
1. `apiKeyHelper` (bare mode)
2. `ANTHROPIC_AUTH_TOKEN` env var
3. `ANTHROPIC_API_KEY` env var / keychain

Remove: `CLAUDE_CODE_OAUTH_TOKEN`, OAuth FD token, keychain OAuth token branches.

### 3.3 Simplify `getAnthropicApiKeyWithSource()` (lines 226–348)

Keep only: env var, apiKeyHelper, keychain `primaryApiKey`.

Remove: OAuth-based key creation for Console users.

### 3.4 Simplify `isAnthropicAuthEnabled()` (lines 100–149)

Remove OAuth detection logic. Since offline is the default, this function should only
return `false` (disable Anthropic auth) in all cases. Can be simplified to a constant or
removed entirely after verifying no caller depends on it dynamically.

### 3.5 Remove `withOAuth401Retry()`

File: `src/utils/http.ts`

Replace callers with standard fetch — API Key 401s are terminal errors, not retryable.

---

## Phase 4 — Clean Up Cascading Dependencies

**Goal:** Remove all remaining imports and references to deleted functions.

### 4.1 `src/services/api/client.ts`

- Line 5: Remove `checkAndRefreshOAuthTokenIfNeeded` import.
- Line 132: Remove `await checkAndRefreshOAuthTokenIfNeeded()` call. API Key is set once
  at startup.
- Lines 301–305: Remove subscriber vs API-key branching. Always use API Key path.

### 4.2 `src/services/api/bootstrap.ts`

- Already skipped (line 48: `getAPIProvider() !== 'firstParty'`).
- Remove entirely, or add an early return at the top. The file fetches from
  `${BASE_API_URL}/api/claude_cli/bootstrap` which only exists on Anthropic's API.

### 4.3 `src/services/settingsSync/index.ts`

- Already skipped (line 213: `getAPIProvider() !== 'firstParty' || !isFirstPartyAnthropicBaseUrl()`).
- No change needed.

### 4.4 `src/services/remoteManagedSettings/syncCache.ts`

- Already skipped (lines 53–58).
- No change needed.

### 4.5 `src/services/analytics/datadog.ts`

- Already skipped (line 169: `getAPIProvider() !== 'firstParty'`).
- No change needed.

### 4.6 `src/utils/api.ts`

- Lines 200–201: Already gated behind `isFirstPartyAnthropicBaseUrl()`. Verify no
  additional changes needed.

### 4.7 `src/utils/toolSearch.ts`

- Lines 301–302: Already gated behind `isFirstPartyAnthropicBaseUrl()`. No change needed.

### 4.8 `src/utils/fastMode.ts`

- Line 113: Already skipped for non-first-party.
- Review effort configuration for offline models.

### 4.9 `src/hooks/useManageMCPConnections.ts`

- `authVersion` reactivity still works — bumped on login (new API Key stored). No change
  needed to the hook itself.

### 4.10 `src/hooks/useVoiceEnabled.ts`

- `authVersion` reactivity preserved. Voice can be configured via local settings without
  OAuth.

### 4.11 `src/commands/logout/logout.tsx` — `clearAuthRelatedCaches()`

- Remove OAuth-specific cache keys: `oauthTokens`, `trustedDeviceTokens`, `betas`.
- Keep local caches that are still relevant.

---

## Phase 5 — Verify

### 5.1 TypeScript compilation

```bash
bun run typecheck
```

Fix all type errors from removed imports/exports.

### 5.2 Runtime smoke test

```bash
bun run start -- -p "hello"
```

### 5.3 Verify commands

- `/login` → prompts for API Key, stores it, bumps `authVersion`.
- `/logout` → clears API Key, clear caches.
- `/doctor` → reports offline mode, no OAuth errors.
- All offline tools (Bash, Read, Write, Grep, Glob) → work normally.

---

## Summary of Files Modified/Deleted

### Deleted

| Path | Reason |
|------|--------|
| `src/services/oauth/` | Entire OAuth service layer |
| `src/constants/oauth.ts` | OAuth URLs, client IDs, scopes |

### Modified

| Path | Change |
|------|--------|
| `src/utils/auth.ts` | Remove OAuth functions, simplify to API-Key-only |
| `src/utils/http.ts` | Remove `withOAuth401Retry()` |
| `src/cli/handlers/auth.ts` | Replace OAuth with API Key management |
| `src/commands/login/index.ts` | Rewire to API Key input |
| `src/commands/login/login.tsx` | Rewrite UI for API Key input |
| `src/commands/logout/index.ts` | Simplify logout |
| `src/commands/logout/logout.tsx` | Remove OAuth cleanup |
| `src/services/api/client.ts` | Skip OAuth token refresh |
| `src/services/api/bootstrap.ts` | Remove or add early return |
| `src/main.tsx` | Remove OAuth init |
| `src/hooks/useManageMCPConnections.ts` | Review authVersion usage |
| `src/hooks/useVoiceEnabled.ts` | Review authVersion usage |

---

## Risks & Notes

1. **authVersion reactivity** — Phase 1 preserves the `authVersion++` bump on login.
   This ensures MCP connection management, voice hooks, and any other `authVersion`
   consumers continue to react to login/logout events without modification.

2. **GrowthBook** — Currently fetches feature flag configuration from the remote
   Bootstrap API. Since Bootstrap is already skipped when
   `isFirstPartyAnthropicBaseUrl()` is `false`, GrowthBook receives no remote config. If
   offline feature flags are needed, add a local JSON fallback in
   `src/services/analytics/`.

3. **Keychain dependency** — API Key storage uses `@ant/secure-storage` (macOS Keychain)
   or `~/.claude.json`. The latter works cross-platform. The stubs already provide no-op
   replacements for `@ant/*` packages, so keychain failures won't crash the app.

4. **No rollback needed** — Offline is the default behavior. There is no feature flag
   to toggle; removed OAuth code is dead code that no caller depends on.
