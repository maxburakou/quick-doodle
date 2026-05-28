import { getSmartAssistController, useSmartAssistStore } from "@/features/smartAssist";
import { Astroid } from "lucide-react";
import "./styles.css";

export const SmartAssistOptions = () => {
  const enabled = useSmartAssistStore((state) => state.enabled);
  const setEnabled = useSmartAssistStore((state) => state.setEnabled);

  const handleToggle = () => {
    if (enabled) {
      const controller = getSmartAssistController();
      controller.clearBatch("disabled");
      controller.finishTransitionNow();
      setEnabled(false);
      return;
    }

    setEnabled(true);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`options-button smart-assist-button ${enabled ? "--active" : ""}`}
      aria-pressed={enabled}
      aria-label="Toggle Smart Assist"
      title="Smart Assist"
    >
      <Astroid
        size={12}
        fill="currentColor"
        stroke="none"
        aria-hidden="true"
        className="smart-assist-icon"
      />
    </button>
  );
};
