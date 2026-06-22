import React, { useState } from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import TextInput from '../../components/TextInput.js';
import { Text } from '../../ink.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { saveApiKey } from '../../utils/auth.js';

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return (
    <Login
      onDone={async success => {
        context.onChangeAPIKey();
        if (success) {
          context.setAppState(prev => ({
            ...prev,
            authVersion: prev.authVersion + 1,
          }));
        }
        onDone(success ? 'API Key configured' : 'Login interrupted');
      }}
    />
  );
}

type Props = {
  onDone: (success: boolean) => void;
  startingMessage?: string;
};

export function Login({ onDone, startingMessage }: Props): React.ReactNode {
  const [apiKey, setApiKey] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('API Key cannot be empty');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveApiKey(trimmed);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save API Key');
      setSaving(false);
    }
  }

  return (
    <Dialog
      title="Configure API Key"
      onCancel={() => onDone(false)}
      color="permission"
    >
      <Text>
        {startingMessage ?? 'Enter your API Key to authenticate:'}
      </Text>
      <TextInput
        value={apiKey}
        onChange={setApiKey}
        onSubmit={handleSubmit}
        focus={true}
        showCursor={true}
        mask="*"
        placeholder="sk-..."
        columns={60}
        cursorOffset={cursorOffset}
        onChangeCursorOffset={setCursorOffset}
      />
      {error && <Text color="red">{error}</Text>}
      {saving && <Text>Saving API Key...</Text>}
    </Dialog>
  );
}

// Backward-compatible alias for components that import the old name
export { Login as ApiKeyLogin };
