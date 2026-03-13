import { Fragment } from "react";
import { ToolbarSettingDefinition } from "../../types";
import "./styles.css";

interface ToolbarSettingsPanelProps {
  visibleSettings: ToolbarSettingDefinition[];
}

export const ToolbarSettingsPanel: React.FC<ToolbarSettingsPanelProps> = ({
  visibleSettings,
}) => {
  const hasSettings = visibleSettings.length > 0;

  return (
    <div className={`toolbar-settings-section ${hasSettings ? "--open" : ""}`}>
      <div className="toolbar-settings-section-inner">
        <hr className="toolbar-divider" />
        <div className="toolbar-settings">
          {visibleSettings.map((setting, index) => (
            <Fragment key={setting.id}>
              {index > 0 ? <hr className="toolbar-divider --vertical" /> : null}
              {setting.component}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
