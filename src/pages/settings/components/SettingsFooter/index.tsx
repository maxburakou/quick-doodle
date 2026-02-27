import "./styles.css";

interface SettingsFooterProps {
  dirty: boolean;
  saving: boolean;
  onRevertDefaults: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export const SettingsFooter = ({
  dirty,
  saving,
  onRevertDefaults,
  onCancel,
  onSave,
}: SettingsFooterProps) => {
  return (
    <footer className="settings-footer">
      <button type="button" className="settings-footer__button" onClick={onRevertDefaults}>
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
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </footer>
  );
};
