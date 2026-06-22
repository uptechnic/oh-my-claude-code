import * as React from 'react';
import { Text } from '../../ink.js';
import { removeApiKey } from '../../utils/auth.js';
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js';

export async function performLogout(): Promise<void> {
  // Flush telemetry BEFORE clearing credentials to prevent data leakage
  const { flushTelemetry } = await import(
    '../../utils/telemetry/instrumentation.js'
  );
  await flushTelemetry();

  await removeApiKey();
}

export async function call(): Promise<React.ReactNode> {
  await performLogout();

  const message = <Text>Successfully removed API Key.</Text>;

  setTimeout(() => {
    gracefulShutdownSync(0, 'logout');
  }, 200);

  return message;
}
