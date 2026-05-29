import { useCallback, useEffect } from "react";
import { useEditor } from "./state/useEditor";
import { readFileBytes, isSubtitleFile } from "./lib/file";
import { ToastProvider } from "./components/Toast";
import { useToast } from "./components/toast-context";
import { Landing } from "./components/Landing";
import { EditorView } from "./components/EditorView";
import { DEMO_SRT, DEMO_FILENAME } from "./data/samples";

function Workbench() {
  const editor = useEditor();
  const { notify } = useToast();

  const openFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (!isSubtitleFile(file)) {
        notify(
          "That doesn’t look like a subtitle file (.srt, .vtt, .ass).",
          "error",
        );
        return;
      }
      try {
        const bytes = await readFileBytes(file);
        await editor.loadBytes(bytes, file.name);
      } catch {
        notify("Could not read that file.", "error");
      }
    },
    [editor, notify],
  );

  const loadDemo = useCallback(() => {
    editor.loadText(DEMO_SRT, DEMO_FILENAME, "srt");
  }, [editor]);

  // Global undo/redo keyboard shortcuts. undo/redo are stable useCallbacks, so the listener
  // is attached once for the session instead of being torn down and re-added on every
  // editor state change.
  const { undo, redo } = editor;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  if (!editor.state.doc) {
    return <Landing onFiles={openFiles} onDemo={loadDemo} />;
  }
  return <EditorView editor={editor} onFiles={openFiles} />;
}

export default function App() {
  return (
    <ToastProvider>
      <Workbench />
    </ToastProvider>
  );
}
