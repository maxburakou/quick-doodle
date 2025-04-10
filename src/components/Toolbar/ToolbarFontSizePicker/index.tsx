import { useFontSize, useUpdateFontSize } from "@/store";
import { useState } from "react";
import "../styles.css";
import { useDebouncedCallback } from "use-debounce";

export const ToolbarFontSizePicker: React.FC = () => {
  const fontSize = useFontSize();
  const updateFontSize = useUpdateFontSize();
  const [tempFontSize, setTempFontSize] = useState<string>(fontSize.toString());

  const debouncedUpdateFontSize = useDebouncedCallback(
    (newFontSize: number) => {
      updateFontSize(newFontSize);
    },
    300
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const isValid = /^$|^[1-9][0-9]?$/.test(value);
    if (!isValid) return;
    setTempFontSize(value);

    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      debouncedUpdateFontSize(parsed);
    }
  };

  return (
    <section className="fontsize-picker">
      <input
        type="text"
        inputMode="numeric"
        value={tempFontSize}
        onChange={handleInputChange}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className={"fontsize-input"}
      />
      <div className="fontsize-arrows">
        <button>▲</button>
        <button>▼</button>
      </div>
    </section>
  );
};
