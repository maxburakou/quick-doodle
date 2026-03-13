import { ShortcutSectionDefinition } from "../../types";
import { ShortcutTable } from "../ShortcutTable";
import "./styles.css";

interface ShortcutSectionProps {
  section: ShortcutSectionDefinition;
}

export const ShortcutSection = ({ section }: ShortcutSectionProps) => {
  return (
    <section className="shortcut-section" aria-label={section.title}>
      <h2 className="shortcut-section__title">{section.title}</h2>
      <ShortcutTable scope={section.scope} actions={section.actions} />
    </section>
  );
};
