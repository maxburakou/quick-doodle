import { Fragment } from "react";
import { ToolbarSettingDefinition } from "../types";

interface ToolbarSettingsPanelProps {
  visibleSettings: ToolbarSettingDefinition[];
}

export const ToolbarSettingsPanel: React.FC<ToolbarSettingsPanelProps> = ({
  visibleSettings,
}) => {
  if (visibleSettings.length === 0) return null;

  return (
    <>
      <hr className="toolbar-divider" />
      <div className="toolbar-settings">
        {visibleSettings.map((setting, index) => (
          <Fragment key={setting.id}>
            {index > 0 ? <hr className="toolbar-divider --vertical" /> : null}
            {setting.component}
          </Fragment>
        ))}
      </div>
    </>
  );
};
