import { useSettingsStore } from "@/store";
import { selectSaveDisabled, useSettingsPageStore } from "../../store";
import "./styles.css";

export const SettingsFooter = () => {
  const dirty = useSettingsStore((state) => state.dirty);
  const validationIssueCount = useSettingsStore((state) => state.validationIssues.length);
  const saving = useSettingsPageStore((state) => state.saving);
  const onRevertDefaults = useSettingsPageStore((state) => state.revertDefaults);
  const onCancel = useSettingsPageStore((state) => state.cancelChanges);
  const onSave = useSettingsPageStore((state) => state.saveAndClose);
  const saveDisabled = selectSaveDisabled(validationIssueCount);

  return (
    <footer className="settings-footer">
      <button
        type="button"
        className="settings-footer__button"
        onClick={() => {
          void onRevertDefaults();
        }}
      >
        Revert to default
      </button>

      <div className="settings-footer__actions">
        <button
          type="button"
          className="settings-footer__button"
          onClick={onCancel}
          disabled={!dirty}
        >
          Cancel
        </button>
        <button
          type="button"
          className="settings-footer__button settings-footer__button--primary"
          onClick={() => {
            void onSave();
          }}
          disabled={!dirty || saving || saveDisabled}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </footer>
  );
};
