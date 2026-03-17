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
