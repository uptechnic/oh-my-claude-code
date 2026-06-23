import type { Command } from '../../commands.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isEnvTruthy } from '../../utils/platform/envUtils.js'
import { isEssentialTrafficOnly } from '../../utils/config/privacyLevel.js'

const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `Submit feedback about Claude Code`,
  argumentHint: '[report]',
  isEnabled: () =>
    !(
      isEnvTruthy(process.env.DISABLE_FEEDBACK_COMMAND) ||
      isEnvTruthy(process.env.DISABLE_BUG_COMMAND) ||
      isEssentialTrafficOnly() ||
      process.env.USER_TYPE === 'ant' ||
      !isPolicyAllowed('allow_product_feedback')
    ),
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback
