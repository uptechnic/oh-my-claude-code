import type { Command } from '../../commands.js'
import { getAnthropicApiKeyWithSource } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default () => {
  const { key, source } = getAnthropicApiKeyWithSource({
    skipRetrievingKeyFromApiKeyHelper: true,
  })
  const hasKey = key !== null && source !== 'none'

  return {
    type: 'local-jsx',
    name: 'login',
    description: hasKey
      ? 'Switch API Key'
      : 'Configure API Key',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  } satisfies Command
}
