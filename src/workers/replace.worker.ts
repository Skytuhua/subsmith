// Runs a user-supplied regular-expression find&replace off the main thread, so a
// catastrophically-backtracking pattern can be abandoned (worker.terminate) without
// freezing the UI. Literal (non-regex) replace runs on the main thread — it is linear
// and safe — so this worker is only used for the regex path.
import { findReplace } from "../core/transforms/text";
import type { Subtitle } from "../core/types";

interface ReplaceRequest {
  doc: Subtitle;
  find: string;
  replace: string;
  caseSensitive: boolean;
  selectionIds: string[] | null;
}

self.onmessage = (e: MessageEvent<ReplaceRequest>) => {
  const { doc, find, replace, caseSensitive, selectionIds } = e.data;
  const sel = selectionIds ? new Set(selectionIds) : null;
  const predicate = sel ? (c: { id: string }) => sel.has(c.id) : undefined;
  const result = findReplace(doc, find, replace, {
    regex: true,
    caseSensitive,
    predicate,
  });
  postMessage(result);
};
