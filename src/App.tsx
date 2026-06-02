import "./App.css";
import { ActivationFrame, Canvas, TextEditor, Toolbar } from "./components";
import { useMainWindowVisibility } from "./hooks/useMainWindowVisibility";
import { useThemeBootstrap } from "./hooks/useThemeBootstrap";

function App() {
  const { isVisible } = useMainWindowVisibility();
  useThemeBootstrap();

  return (
    <main className={`app-container ${!isVisible ? "--hidden" : ""}`}>
      <ActivationFrame isAppVisible={isVisible} />
      <Toolbar />
      <TextEditor />
      <Canvas />
    </main>
  );
}

export default App;
