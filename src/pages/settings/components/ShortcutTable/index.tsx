import { ShortcutRowModel, ShortcutScopeKey } from "../../types";
import { ShortcutRow } from "../ShortcutRow";
import "./styles.css";

interface ShortcutTableProps {
  rows: ShortcutRowModel[];
  recordingRowKey: string | null;
  onRecordStart: (scope: ShortcutScopeKey, actionId: string) => void;
  onReset: (scope: ShortcutScopeKey, actionId: string) => void;
}

export const ShortcutTable = ({
  rows,
  recordingRowKey,
  onRecordStart,
  onReset,
}: ShortcutTableProps) => {
  return (
    <div className="shortcut-table__wrap">
      <table className="shortcut-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Shortcut</th>
            <th scope="col">Record</th>
            <th scope="col">Reset</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ShortcutRow
              key={row.key}
              row={row}
              recording={recordingRowKey === row.key}
              onRecordStart={onRecordStart}
              onReset={onReset}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
