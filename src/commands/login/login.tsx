import React, { useCallback, useState } from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import TextInput from '../../components/TextInput.js';
import { Box, Text } from '../../ink.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import {
  LOGIN_ENV_VAR_DEFS,
  setSessionEnvVars,
} from '../../utils/config/envFile.js';

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
        onDone(
          success
            ? 'Session configured. Set env vars at startup for permanent config.'
            : 'Setup interrupted',
        );
      }}
    />
  );
}

type Props = {
  onDone: (success: boolean) => void;
  startingMessage?: string;
};

export function Login({ onDone, startingMessage }: Props): React.ReactNode {
  const [stepIndex, setStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<Record<string, string>>(() => {
    // Pre-fill from current env
    const initial: Record<string, string> = {};
    for (const def of LOGIN_ENV_VAR_DEFS) {
      const existing = process.env[def.key];
      if (existing) initial[def.key] = existing;
    }
    return initial;
  });

  const currentDef = LOGIN_ENV_VAR_DEFS[stepIndex];
  const isLast = stepIndex >= LOGIN_ENV_VAR_DEFS.length - 1;
  const isRequired = currentDef?.required ?? false;
  const isAdvanced = currentDef?.advanced ?? false;

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();

    if (isRequired && !trimmed) {
      setError(`${currentDef.label} is required`);
      return;
    }

    // Save this step's value
    const updated = { ...savedValues };
    if (trimmed) {
      updated[currentDef.key] = trimmed;
    } else if (updated[currentDef.key]) {
      delete updated[currentDef.key];
    }
    setSavedValues(updated);

    if (isLast) {
      // Apply to current session only (no disk persistence)
      const vars: Record<string, string> = {};
      for (const def of LOGIN_ENV_VAR_DEFS) {
        const v = updated[def.key]?.trim();
        if (v) vars[def.key] = v;
      }

      if (Object.keys(vars).length > 0) {
        setSessionEnvVars(vars);
      }

      onDone(true);
    } else {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setInputValue(updated[LOGIN_ENV_VAR_DEFS[nextIndex].key] ?? '');
      setCursorOffset(updated[LOGIN_ENV_VAR_DEFS[nextIndex].key]?.length ?? 0);
      setError(null);
    }
  }, [inputValue, isRequired, isLast, currentDef, savedValues, stepIndex, onDone]);

  const handleCancel = useCallback(() => {
    if (stepIndex > 0) {
      const prevIndex = stepIndex - 1;
      setStepIndex(prevIndex);
      setInputValue(savedValues[LOGIN_ENV_VAR_DEFS[prevIndex].key] ?? '');
      setCursorOffset(savedValues[LOGIN_ENV_VAR_DEFS[prevIndex].key]?.length ?? 0);
      setError(null);
    } else {
      onDone(false);
    }
  }, [stepIndex, savedValues, onDone]);

  const totalSteps = LOGIN_ENV_VAR_DEFS.length;
  const progress = `(${stepIndex + 1}/${totalSteps})`;
  const sectionLabel = isAdvanced ? 'Advanced' : 'Required';

  return (
    <Dialog
      title={`Configure API — ${sectionLabel} ${progress}`}
      onCancel={handleCancel}
      color="permission"
    >
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text color="yellow" bold={true}>
            Session-only — no credentials are saved to disk.
          </Text>
          <Text dimColor={true}>
            For permanent configuration, set environment variables before starting the program
            (e.g. in .env, shell profile, or startup script).
          </Text>
        </Box>

        {stepIndex === 0 && startingMessage && (
          <Text>{startingMessage}</Text>
        )}

        <Box flexDirection="column">
          <Text bold={true}>{currentDef.label}</Text>
          <Text dimColor={true}>
            {currentDef.placeholder ? `e.g. ${currentDef.placeholder}` : ''}
            {isRequired ? ' (required)' : ' (optional, press Enter to skip)'}
          </Text>
        </Box>
        <TextInput
          value={inputValue}
          onChange={v => {
            setInputValue(v);
            setError(null);
          }}
          onSubmit={handleSubmit}
          focus={true}
          showCursor={true}
          mask={currentDef.key.includes('TOKEN') || currentDef.key.includes('KEY') ? '*' : undefined}
          placeholder={currentDef.placeholder}
          columns={70}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
        {error && <Text color="red">{error}</Text>}
        <Text dimColor={true}>
          {isLast
            ? 'Enter: apply & finish  |  Esc: back'
            : `Enter: ${isRequired ? 'save & next' : 'skip (optional)'}  |  Esc: ${stepIndex > 0 ? 'back' : 'cancel'}`}
        </Text>
      </Box>
    </Dialog>
  );
}
