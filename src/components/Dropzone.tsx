import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { SUBTITLE_ACCEPT } from "../lib/file";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  children: (state: { dragging: boolean; open: () => void }) => ReactNode;
  className?: string;
  multiple?: boolean;
}

/** Headless-ish drag-and-drop + click-to-open wrapper. Renders via a child function. */
export function Dropzone({
  onFiles,
  children,
  className,
  multiple = false,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const open = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    },
    [onFiles, multiple],
  );

  return (
    <div
      className={cn(className)}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SUBTITLE_ACCEPT}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {/* `open` only reads inputRef.current when invoked from a click handler, never during
          render — the strict refs rule can't prove that through the render prop. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {children({ dragging, open })}
    </div>
  );
}
