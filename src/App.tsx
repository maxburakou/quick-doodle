import "./App.css";
import { Canvas, TextEditor, Toolbar } from "./components";

function App() {
  return (
    <main className="app-container">
      <Toolbar />
      <TextEditor />
      <Canvas />
    </main>
  );
}

export default App;
