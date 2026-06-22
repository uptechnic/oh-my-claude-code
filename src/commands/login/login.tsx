import React, { useState } from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import TextInput from '../../components/TextInput.js';
import { Box, Text } from '../../ink.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { saveApiKey } from '../../utils/auth.js';
import {
  configureEnvVars,
  LOGIN_ENV_VAR_DEFS,
} from '../../utils/envFile.js';

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
        onDone(success ? 'Configuration saved — restart to apply all settings' : 'Setup interrupted');
      }}
    />
  );
}

type Props = {
  onDone: (success: boolean) => void;
  startingMessage?: string;
};

type Step = 'required' | 'advanced';

export function Login({ onDone, startingMessage }: Props): React.ReactNode {
  const [step, setStep] = useState<Step>('required');
  const [values, setValues] = useState<Record<string, string>>(() => {
    // Pre-fill from current env
    const initial: Record<string, string> = {};
    for (const def of LOGIN_ENV_VAR_DEFS) {
      const existing = process.env[def.key];
      if (existing) initial[def.key] = existing;
    }
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requiredDefs = LOGIN_ENV_VAR_DEFS.filter(d => !d.advanced);
  const advancedDefs = LOGIN_ENV_VAR_DEFS.filter(d => d.advanced);
  const currentDefs = step === 'required' ? requiredDefs : advancedDefs;

  function setValue(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleRequiredDone() {
    const newErrors: Record<string, string> = {};
    for (const def of requiredDefs) {
      if (def.required && !values[def.key]?.trim()) {
        newErrors[def.key] = `${def.label} is required`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setStep('advanced');
  }

  async function handleSave() {
    const newErrors: Record<string, string> = {};
    for (const def of requiredDefs) {
      if (def.required && !values[def.key]?.trim()) {
        newErrors[def.key] = `${def.label} is required`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Collect non-empty values
    const vars: Record<string, string> = {};
    for (const def of LOGIN_ENV_VAR_DEFS) {
      const v = values[def.key]?.trim();
      if (v) vars[def.key] = v;
    }

    // Persist to .env and set on process.env
    configureEnvVars(vars);

    // Also save the auth token via the standard saveApiKey path
    const authToken = values['ANTHROPIC_AUTH_TOKEN']?.trim();
    if (authToken) {
      try {
        await saveApiKey(authToken);
      } catch {
        // Non-fatal — the .env file has the token regardless
      }
    }

    onDone(true);
  }

  // Render a single-field input step
  if (currentDefs.length === 1) {
    const def = currentDefs[0];
    const [cursorOffset, setCursorOffset] = useState(0);
    return (
      <Dialog
        title={step === 'required' ? 'Configure API Connection' : 'Advanced Settings'}
        onCancel={() => onDone(false)}
        color="permission"
      >
        <Box flexDirection="column" gap={1}>
          <Text bold={true}>{def.label}</Text>
          <Text dimColor={true}>{def.required ? '(required)' : '(optional)'}</Text>
          <TextInput
            value={values[def.key] ?? ''}
            onChange={v => setValue(def.key, v)}
            onSubmit={step === 'required' ? handleRequiredDone : handleSave}
            focus={true}
            showCursor={true}
            mask={def.key.includes('TOKEN') || def.key.includes('KEY') ? '*' : undefined}
            placeholder={def.placeholder}
            columns={70}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
          />
          {errors[def.key] && <Text color="red">{errors[def.key]}</Text>}
        </Box>
      </Dialog>
    );
  }

  // Render multi-field step (show all fields in a form)
  return (
    <Dialog
      title={step === 'required' ? 'Configure API Connection' : 'Advanced Settings'}
      onCancel={step === 'required' ? () => onDone(false) : () => setStep('required')}
      color="permission"
    >
      <Box flexDirection="column" gap={1}>
        {startingMessage && <Text>{startingMessage}</Text>}
        {currentDefs.map(def => {
          const [cursorOffset, setCursorOffset] = useState(0);
          return (
            <Box key={def.key} flexDirection="column">
              <Text>{def.label}{def.required ? ' *' : ' (optional)'}</Text>
              <TextInput
                value={values[def.key] ?? ''}
                onChange={v => setValue(def.key, v)}
                focus={false}
                showCursor={true}
                mask={def.key.includes('TOKEN') || def.key.includes('KEY') ? '*' : undefined}
                placeholder={def.placeholder}
                columns={70}
                cursorOffset={cursorOffset}
                onChangeCursorOffset={setCursorOffset}
              />
              {errors[def.key] && <Text color="red">{errors[def.key]}</Text>}
            </Box>
          );
        })}
        <Text dimColor={true}>
          {step === 'required'
            ? 'Press Enter on any field to continue to advanced settings'
            : 'Press Enter on any field to save and finish'}
        </Text>
      </Box>
    </Dialog>
  );
}
