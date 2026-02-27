import { ShortcutSectionModel, ShortcutScopeKey } from "../../types";
import { ShortcutSection } from "../ShortcutSection";
import "./styles.css";

interface SettingsContentProps {
  sections: ShortcutSectionModel[];
  recordingRowKey: string | null;
  onRecordStart: (scope: ShortcutScopeKey, actionId: string) => void;
  onReset: (scope: ShortcutScopeKey, actionId: string) => void;
}

export const SettingsContent = ({
  sections,
  recordingRowKey,
  onRecordStart,
  onReset,
}: SettingsContentProps) => {
  return (
    <section className="settings-content" aria-label="Shortcuts settings content">
      <header className="settings-content__header">
        <h1 className="settings-content__title">Shortcuts</h1>
      </header>

      <div className="settings-content__sections">
        {sections.map((section) => (
          <ShortcutSection
            key={section.id}
            section={section}
            recordingRowKey={recordingRowKey}
            onRecordStart={onRecordStart}
            onReset={onReset}
          />
        ))}
      </div>
    </section>
  );
};
