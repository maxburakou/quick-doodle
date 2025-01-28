import { ReactSketchCanvas } from "react-sketch-canvas";
import "./App.css";
const styles = {
  border: 'none'
};
function App() {
  return (
    <section className="app-container">
      <ReactSketchCanvas
        canvasColor="transparent"
        strokeColor="#a855f7"
        style={styles}
      />
    </section>
  );
}

export default App;
