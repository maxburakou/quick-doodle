import { useSettingsStore } from "@/store";
import { selectErrorStripMessage, useSettingsPageStore } from "../../store";
import "./styles.css";

export const ErrorSection = () => {
  const validationIssueCount = useSettingsStore((state) => state.validationIssues.length);
  const runtimeError = useSettingsPageStore((state) => state.runtimeError);
  const message = selectErrorStripMessage(validationIssueCount, runtimeError);

  if (!message) return null;

  return (
    <section className="settings-error-section" aria-live="polite">
      <p className="settings-error-section__text">{message}</p>
    </section>
  );
};
