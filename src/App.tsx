import "./App.css";
import { Canvas, TextEditor, Toolbar } from "./components";
import { useMainWindowVisibility } from "./hooks/useMainWindowVisibility";
import { useThemeBootstrap } from "./hooks/useThemeBootstrap";

function App() {
  const { isVisible } = useMainWindowVisibility();
  useThemeBootstrap();

  return (
    <main className={`app-container ${!isVisible ? "--hidden" : ""}`}>
      <Toolbar />
      <TextEditor />
      <Canvas />
    </main>
  );
}

export default App;
