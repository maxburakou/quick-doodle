import { ShortcutSectionModel, ShortcutScopeKey } from "../../types";
import { ShortcutSection } from "../ShortcutSection";
import { AutostartSection } from "../AutostartSection";
import "./styles.css";

interface SettingsContentProps {
  sections: ShortcutSectionModel[];
  autostartEnabled: boolean;
  recordingRowKey: string | null;
  onRecordStart: (scope: ShortcutScopeKey, actionId: string) => void;
  onReset: (scope: ShortcutScopeKey, actionId: string) => void;
  onAutostartChange: (enabled: boolean) => void;
}

export const SettingsContent = ({
  sections,
  autostartEnabled,
  recordingRowKey,
  onRecordStart,
  onReset,
  onAutostartChange,
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

      <div className="settings-content__divider" />

      <AutostartSection enabled={autostartEnabled} onChange={onAutostartChange} />
    </section>
  );
};
