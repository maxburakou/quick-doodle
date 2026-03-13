import { ShortcutActionDefinition, ShortcutScopeKey } from "../../types";
import { ShortcutRow } from "../ShortcutRow";
import "./styles.css";

interface ShortcutTableProps {
  scope: ShortcutScopeKey;
  actions: ShortcutActionDefinition[];
}

export const ShortcutTable = ({ scope, actions }: ShortcutTableProps) => {
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
          {actions.map((action) => (
            <ShortcutRow
              key={`${scope}::${action.actionId}`}
              scope={scope}
              actionId={action.actionId}
              label={action.label}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
