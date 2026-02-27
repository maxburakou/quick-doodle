import { formatBinding } from "../../helpers/shortcuts";
import { ShortcutRowModel, ShortcutScopeKey } from "../../types";
import "./styles.css";

interface ShortcutRowProps {
  row: ShortcutRowModel;
  recording: boolean;
  onRecordStart: (scope: ShortcutScopeKey, actionId: string) => void;
  onReset: (scope: ShortcutScopeKey, actionId: string) => void;
}

const IS_MAC_OS = navigator.platform.toLowerCase().includes("mac");

export const ShortcutRow = ({ row, recording, onRecordStart, onReset }: ShortcutRowProps) => {
  const bindingLabel = recording ? "..." : formatBinding(row.binding, IS_MAC_OS);

  return (
    <tr className={row.issue ? "shortcut-row shortcut-row--error" : "shortcut-row"}>
      <td>{row.label}</td>
      <td>
        <div
          className={
            recording
              ? "shortcut-row__binding shortcut-row__binding--recording"
              : "shortcut-row__binding"
          }
          title={row.issue?.message ?? ""}
        >
          {bindingLabel}
        </div>
        {row.issue ? <div className="shortcut-row__issue">{row.issue.message}</div> : null}
      </td>
      <td>
        <button
          type="button"
          className={
            recording
              ? "shortcut-row__record-button shortcut-row__record-button--active"
              : "shortcut-row__record-button"
          }
          onClick={() => onRecordStart(row.scope, row.actionId)}
        >
          {recording ? "Recording..." : "Record"}
        </button>
      </td>
      <td>
        <button
          type="button"
          className="shortcut-row__reset-button"
          onClick={() => onReset(row.scope, row.actionId)}
        >
          Clear
        </button>
      </td>
    </tr>
  );
};
