import { useSettingsStore } from "@/store";
import { SHORTCUT_SECTIONS } from "../../constants/shortcutActions";
import { ShortcutSection } from "../ShortcutSection";
import { AutostartSection } from "../AutostartSection";
import { TraySection } from "../TraySection";
import "./styles.css";

export const SettingsContent = () => {
  const draft = useSettingsStore((state) => state.draft);
  if (!draft) return null;

  return (
    <section className="settings-content" aria-label="Shortcuts settings content">
      <header className="settings-content__header">
        <h1 className="settings-content__title">Shortcuts</h1>
      </header>

      <div className="settings-content__sections">
        {SHORTCUT_SECTIONS.map((section) => (
          <ShortcutSection key={section.id} section={section} />
        ))}
      </div>

      <div className="settings-content__divider" />

      <AutostartSection />
      <TraySection />
    </section>
  );
};
