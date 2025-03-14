import { useToolStore } from "../../store";
import { Tool } from "../../types";

export const Toolbar: React.FC = () => {
  const { tool, setTool } = useToolStore();

  return (
    <menu
      style={{
        position: "fixed",
        top: 10,
        left: 100,
        display: "flex",
        gap: "8px",
        padding: "10px",
        background: "rgba(255, 255, 255, 0.8)",
        borderRadius: "8px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        listStyle: "none",
        zIndex: 7,
      }}
    >
      {Object.entries(Tool).map(([key, value]) => (
        <li key={value}>
          <button
            onClick={() => setTool(value as Tool)}
            style={{
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: value === tool ? "#007bff" : "#f0f0f0",
              color: value === tool ? "#fff" : "#000",
              transition: "background 0.2s",
            }}
            aria-pressed={value === tool} // ✅ Improves accessibility
          >
            {key} {/* ✅ Now displays "Pen", "Highlighter", etc. correctly */}
          </button>
        </li>
      ))}
    </menu>
  );
};
