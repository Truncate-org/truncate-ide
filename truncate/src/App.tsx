import { useEffect } from "react";
import ResizableLayout from "./components/Layout/ResizableLayout";
import { useUiStore } from "./store/uiStore";

function App() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ResizableLayout />
  );
}

export default App;
