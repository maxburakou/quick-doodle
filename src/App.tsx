import "./App.css";
import { Canvas, TextEditor, Toolbar } from "./components";
import { useMainWindowVisibility } from "./hooks/useMainWindowVisibility";

function App() {
  const { isVisible } = useMainWindowVisibility();

  return (
    <main className={`app-container ${!isVisible ? "--hidden" : ""}`}>
      <Toolbar />
      <TextEditor />
      <Canvas />
    </main>
  );
}

export default App;
