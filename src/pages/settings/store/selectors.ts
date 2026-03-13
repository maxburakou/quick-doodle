export const selectErrorStripMessage = (
  validationIssueCount: number,
  runtimeError: string | null
): string | null => {
  const validationSummary =
    validationIssueCount > 0 ? `${validationIssueCount} validation issue(s).` : null;

  return validationSummary ?? runtimeError;
};

export const selectSaveDisabled = (validationIssueCount: number) => {
  return validationIssueCount > 0;
};
