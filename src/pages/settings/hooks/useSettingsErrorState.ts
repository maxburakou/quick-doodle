import { useMemo, useState } from "react";

interface UseSettingsErrorStateResult {
  runtimeError: string | null;
  setRuntimeError: (value: string | null) => void;
  setRuntimeErrorFromUnknown: (error: unknown) => void;
  clearRuntimeError: () => void;
  validationSummary: string | null;
  errorStripMessage: string | null;
  saveDisabled: boolean;
}

export const useSettingsErrorState = (
  validationIssueCount: number
): UseSettingsErrorStateResult => {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const validationSummary =
    validationIssueCount > 0 ? `${validationIssueCount} validation issue(s).` : null;

  const errorStripMessage = useMemo(() => {
    return validationSummary ?? runtimeError;
  }, [runtimeError, validationSummary]);

  return {
    runtimeError,
    setRuntimeError,
    setRuntimeErrorFromUnknown: (error) => {
      setRuntimeError(String(error));
    },
    clearRuntimeError: () => {
      setRuntimeError(null);
    },
    validationSummary,
    errorStripMessage,
    saveDisabled: validationIssueCount > 0,
  };
};
