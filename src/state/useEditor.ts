import { useCallback, useMemo, useReducer } from "react";
import type { ParseWarning, Subtitle, SubtitleFormat } from "../core/types";
import { parse } from "../core/parsers";
import { detectAndDecode, decodeText } from "../core/detect";

const MAX_HISTORY = 100;

/**
 * Undo depth, scaled down for large documents. Timing transforms allocate a fresh object
 * per cue, so retaining 100 snapshots of a multi-thousand-cue file would waste memory.
 */
export function historyLimit(doc: Subtitle | null): number {
  const n = doc?.cues.length ?? 0;
  if (n > 5000) return 10;
  if (n > 1500) return 30;
  return MAX_HISTORY;
}

export interface EditorState {
  doc: Subtitle | null;
  past: Subtitle[];
  future: Subtitle[];
  fileName: string | null;
  rawBytes: Uint8Array | null;
  encoding: string;
  encodingConfidence: number;
  exportFormat: SubtitleFormat;
  warnings: ParseWarning[];
  selection: string[];
  anchorIndex: number | null;
  /** Human-readable label of the last applied operation (for the status bar). */
  lastOp: string | null;
}

export const initialState: EditorState = {
  doc: null,
  past: [],
  future: [],
  fileName: null,
  rawBytes: null,
  encoding: "utf-8",
  encodingConfidence: 0,
  exportFormat: "srt",
  warnings: [],
  selection: [],
  anchorIndex: null,
  lastOp: null,
};

type Action =
  | {
      type: "LOAD";
      doc: Subtitle;
      fileName: string | null;
      rawBytes: Uint8Array | null;
      encoding: string;
      confidence: number;
      warnings: ParseWarning[];
    }
  | { type: "COMMIT"; doc: Subtitle; label: string }
  | { type: "APPLY"; fn: (doc: Subtitle) => Subtitle; label: string }
  | { type: "REDECODE"; encoding: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SELECT"; ids: string[]; anchorIndex: number | null }
  | { type: "SET_EXPORT_FORMAT"; format: SubtitleFormat }
  | { type: "CLEAR" };

/** Exported for unit testing — a pure (state, action) => state function. */
export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "LOAD":
      return {
        ...initialState,
        doc: action.doc,
        fileName: action.fileName,
        rawBytes: action.rawBytes,
        encoding: action.encoding,
        encodingConfidence: action.confidence,
        exportFormat: action.doc.format,
        warnings: action.warnings,
        lastOp: "Loaded file",
      };
    case "COMMIT": {
      if (!state.doc) return state;
      const past = [...state.past, state.doc].slice(-historyLimit(state.doc));
      return {
        ...state,
        doc: action.doc,
        past,
        future: [],
        lastOp: action.label,
      };
    }
    case "APPLY": {
      // Compute the transform against the live document inside the reducer — no refs needed.
      if (!state.doc) return state;
      const next = action.fn(state.doc);
      const past = [...state.past, state.doc].slice(-historyLimit(state.doc));
      return { ...state, doc: next, past, future: [], lastOp: action.label };
    }
    case "REDECODE": {
      // Re-decoding the original bytes replaces the document and resets history. The
      // encoding is always an explicit override here, so decode synchronously — jschardet
      // is never needed and the reducer stays pure (no async).
      if (!state.rawBytes) return state;
      const text = decodeText(state.rawBytes, action.encoding);
      const { subtitle, warnings } = parse(
        text,
        undefined,
        state.fileName ?? undefined,
      );
      return {
        ...state,
        doc: subtitle,
        encoding: action.encoding,
        warnings,
        past: [],
        future: [],
        selection: [],
        anchorIndex: null,
        exportFormat: subtitle.format,
        lastOp: `Re-decoded as ${action.encoding}`,
      };
    }
    case "UNDO": {
      if (state.past.length === 0 || !state.doc) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, historyLimit(state.doc)),
        lastOp: "Undo",
      };
    }
    case "REDO": {
      if (state.future.length === 0 || !state.doc) return state;
      const next = state.future[0];
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc].slice(-historyLimit(state.doc)),
        future: state.future.slice(1),
        lastOp: "Redo",
      };
    }
    case "SELECT":
      return {
        ...state,
        selection: action.ids,
        anchorIndex: action.anchorIndex,
      };
    case "SET_EXPORT_FORMAT":
      return { ...state, exportFormat: action.format };
    case "CLEAR":
      return initialState;
    default:
      return state;
  }
}

export interface EditorApi {
  state: EditorState;
  canUndo: boolean;
  canRedo: boolean;
  selectedIds: Set<string>;
  /** Load file bytes (with encoding detection) and parse. */
  loadBytes: (
    bytes: Uint8Array,
    fileName: string,
    encodingOverride?: string,
  ) => Promise<void>;
  /** Load plain text (e.g. the built-in demo) directly. */
  loadText: (text: string, fileName: string, format?: SubtitleFormat) => void;
  /** Apply a pure transform to the current document, recording one undo step. */
  apply: (fn: (doc: Subtitle) => Subtitle, label: string) => void;
  /** Replace the entire document (e.g. a merge result), recording one undo step. */
  setDoc: (doc: Subtitle, label: string) => void;
  /** Re-decode the original bytes with a different encoding and re-parse. */
  redecode: (encoding: string) => void;
  setExportFormat: (format: SubtitleFormat) => void;
  setSelection: (ids: string[], anchorIndex?: number | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export function useEditor(): EditorApi {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadBytes = useCallback(
    async (bytes: Uint8Array, fileName: string, encodingOverride?: string) => {
      const decoded = await detectAndDecode(bytes, encodingOverride);
      const { subtitle, warnings } = parse(decoded.text, undefined, fileName);
      dispatch({
        type: "LOAD",
        doc: subtitle,
        fileName,
        rawBytes: bytes,
        encoding: decoded.encoding,
        confidence: decoded.confidence,
        warnings,
      });
    },
    [],
  );

  const loadText = useCallback(
    (text: string, fileName: string, format?: SubtitleFormat) => {
      const { subtitle, warnings } = parse(text, format, fileName);
      dispatch({
        type: "LOAD",
        doc: subtitle,
        fileName,
        rawBytes: null,
        encoding: "utf-8",
        confidence: 1,
        warnings,
      });
    },
    [],
  );

  const apply = useCallback(
    (fn: (doc: Subtitle) => Subtitle, label: string) => {
      dispatch({ type: "APPLY", fn, label });
    },
    [],
  );

  const setDoc = useCallback((doc: Subtitle, label: string) => {
    dispatch({ type: "COMMIT", doc, label });
  }, []);

  const redecode = useCallback((encoding: string) => {
    dispatch({ type: "REDECODE", encoding });
  }, []);

  const setExportFormat = useCallback((format: SubtitleFormat) => {
    dispatch({ type: "SET_EXPORT_FORMAT", format });
  }, []);

  const setSelection = useCallback(
    (ids: string[], anchorIndex: number | null = null) => {
      dispatch({ type: "SELECT", ids, anchorIndex });
    },
    [],
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const selectedIds = useMemo(
    () => new Set(state.selection),
    [state.selection],
  );

  // Memoize the API object so its identity is stable whenever neither `state` nor the
  // selection changed (e.g. a no-op dispatch that returns the same state reference). All
  // the members are already stable useCallbacks; this lets consumers bail out of re-renders
  // and avoids re-subscribing effects that depend on the editor object.
  return useMemo(
    () => ({
      state,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      selectedIds,
      loadBytes,
      loadText,
      apply,
      setDoc,
      redecode,
      setExportFormat,
      setSelection,
      undo,
      redo,
      clear,
    }),
    [
      state,
      selectedIds,
      loadBytes,
      loadText,
      apply,
      setDoc,
      redecode,
      setExportFormat,
      setSelection,
      undo,
      redo,
      clear,
    ],
  );
}
