import { ShortcutSectionModel, ShortcutScopeKey } from "../../types";
import { ShortcutTable } from "../ShortcutTable";
import "./styles.css";

interface ShortcutSectionProps {
  section: ShortcutSectionModel;
  recordingRowKey: string | null;
  onRecordStart: (scope: ShortcutScopeKey, actionId: string) => void;
  onReset: (scope: ShortcutScopeKey, actionId: string) => void;
}

export const ShortcutSection = ({
  section,
  recordingRowKey,
  onRecordStart,
  onReset,
}: ShortcutSectionProps) => {
  return (
    <section className="shortcut-section" aria-label={section.title}>
      <h2 className="shortcut-section__title">{section.title}</h2>
      <ShortcutTable
        rows={section.rows}
        recordingRowKey={recordingRowKey}
        onRecordStart={onRecordStart}
        onReset={onReset}
      />
    </section>
  );
};
