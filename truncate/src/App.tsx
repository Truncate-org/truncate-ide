import { useEffect } from "react";
import ResizableLayout from "./components/Layout/ResizableLayout";
import { useUiStore } from "./store/uiStore";
import { useAiStore } from "./store/aiStore";
import EngineSetupScreen from "./components/Modals/EngineSetupScreen";
import SettingsModal from "./components/Modals/SettingsModal";

import ConfirmationModal from "./components/Modals/ConfirmationModal";

function App() {
  const theme = useUiStore((state) => state.theme);
  const listenToEvents = useAiStore((state) => state.listenToEvents);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListeners = async () => {
      unlisten = await listenToEvents();
    };

    setupListeners();

    return () => {
      if (unlisten) unlisten();
    };
  }, [listenToEvents]);

  return (
    <>
      <ResizableLayout />
      <EngineSetupScreen />
      <SettingsModal />
      <ConfirmationModal />
    </>
  );
}

export default App;
