import { useSettingsStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { formatBinding, getIssueMessage } from "../../helpers/shortcuts";
import { ShortcutScopeKey } from "../../types";
import { useSettingsPageStore } from "../../store";
import {
  buildIssuePath,
  buildRowKey,
  getPrimaryBinding,
  getScopeActions,
  resolveIssueForPath,
} from "../../helpers/shortcuts";
import "./styles.css";

interface ShortcutRowProps {
  scope: ShortcutScopeKey;
  actionId: string;
  label: string;
}

const IS_MAC_OS = navigator.platform.toLowerCase().includes("mac");

export const ShortcutRow = ({ scope, actionId, label }: ShortcutRowProps) => {
  const rowKey = buildRowKey(scope, actionId);
  const { recordingRowKey, onRecordStart, onReset } = useSettingsPageStore(
    useShallow((state) => ({
      recordingRowKey: state.recordingRowKey,
      onRecordStart: state.startRecording,
      onReset: state.resetShortcut,
    }))
  );
  const recording = recordingRowKey === rowKey;
  const { binding, issue } = useSettingsStore(
    useShallow((state) => {
      const path = buildIssuePath(scope, actionId);

      if (!state.draft) {
        return {
          binding: null,
          issue: resolveIssueForPath(state.validationIssues, path),
        };
      }

      const actions = getScopeActions(state.draft, scope);

      return {
        binding: getPrimaryBinding(actions[actionId]),
        issue: resolveIssueForPath(state.validationIssues, path),
      };
    })
  );

  const bindingLabel = recording ? "..." : formatBinding(binding, IS_MAC_OS);
  const issueMessage = getIssueMessage(issue);

  return (
    <tr className={issue ? "shortcut-row shortcut-row--error" : "shortcut-row"}>
      <td>{label}</td>
      <td>
        <div
          className={
            recording
              ? "shortcut-row__binding shortcut-row__binding--recording"
              : "shortcut-row__binding"
          }
          title={issueMessage}
        >
          {bindingLabel}
        </div>
        {issue ? <div className="shortcut-row__issue">{issueMessage}</div> : null}
      </td>
      <td>
        <button
          type="button"
          className={
            recording
              ? "shortcut-row__record-button shortcut-row__record-button--active"
              : "shortcut-row__record-button"
          }
          onClick={() => onRecordStart(scope, actionId)}
        >
          {recording ? "Recording..." : "Record"}
        </button>
      </td>
      <td>
        <button
          type="button"
          className="shortcut-row__reset-button"
          onClick={() => onReset(scope, actionId)}
        >
          Clear
        </button>
      </td>
    </tr>
  );
};
