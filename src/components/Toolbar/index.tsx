import { useToolStore } from "../../store";
import { Tool } from "../../types";


export const Toolbar: React.FC = () => {
  const { tool, setTool } = useToolStore();

  return (
    <menu style={{
      position: 'fixed',
      top: 10,
      left: 100,
      display: 'flex',
      gap: '8px',
      padding: '10px',
      background: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '8px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      listStyle: 'none'
    }}>
      {Object.values(Tool).filter(value => typeof value === 'number').map((toolKey) => (
        <li key={toolKey as number}>
          <button
            onClick={() => setTool(toolKey as Tool)}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              background: tool === toolKey ? '#007bff' : '#f0f0f0',
              color: tool === toolKey ? '#fff' : '#000',
              transition: 'background 0.2s',
            }}
          >
            {Tool[toolKey as number]}
          </button>
        </li>
      ))}
    </menu>
  );
};