import { useCallback, useEffect, useState } from "react";
import { snackbar } from "mdui";
import { fileStore, fileStoreError } from "../services/fileStore";
import { SAMPLE_NOTEBOOK_NAME, SAMPLE_NOTE_NAME, SAMPLE_NOTE_CONTENT, ensureSampleAssets } from "../utils/sampleData";
import type { FileNote, Notebook } from "../types";

export function useNotes(activeNotebook: Notebook | null) {
  const [fileNotes, setFileNotes] = useState<FileNote[]>([]);

  const loadNotes = useCallback(async (notebookPath: string) => {
    try {
      let notes = await fileStore.listNotes(notebookPath);
      if (notes.length === 0 && (activeNotebook?.name === SAMPLE_NOTEBOOK_NAME || activeNotebook?.name === "示例笔记本")) {
        try {
          await ensureSampleAssets(notebookPath);
          const sampleNote = await fileStore.createNote(notebookPath, SAMPLE_NOTE_NAME);
          await fileStore.writeNote(sampleNote.path, SAMPLE_NOTE_CONTENT);
          notes = [sampleNote];
        } catch (err) {
          console.warn("Failed to create sample note in notebook:", err);
        }
      }
      setFileNotes(notes);
    } catch (error) {
      const msg = fileStoreError(error);
      snackbar({ message: msg });
    }
  }, [activeNotebook?.name]);

  useEffect(() => {
    if (activeNotebook) {
      void loadNotes(activeNotebook.path);
    } else {
      setFileNotes([]);
    }
  }, [activeNotebook, loadNotes]);

  const createNote = useCallback(async (requestedName?: string) => {
    if (!activeNotebook) {
      snackbar({ message: "请先选择或创建一个笔记本" });
      return null;
    }
    try {
      const note = await fileStore.createNote(activeNotebook.path, requestedName);
      setFileNotes((current) => [...current, note]);
      snackbar({ message: `已创建 ${note.name}` });
      return note;
    } catch (error) {
      const msg = fileStoreError(error);
      snackbar({ message: msg });
      return null;
    }
  }, [activeNotebook]);

  const renameNote = useCallback(
    async (notePath: string, newName: string) => {
      try {
        const updated = await fileStore.renameNote(notePath, newName);
        setFileNotes((current) =>
          current.map((item) => (item.path === notePath ? updated : item))
        );
        snackbar({ message: `已重命名为“${updated.name}”` });
        return updated;
      } catch (error) {
        const msg = fileStoreError(error);
        snackbar({ message: msg });
        return null;
      }
    },
    []
  );

  const deleteNote = useCallback(
    async (notePath: string, noteName: string) => {
      try {
        await fileStore.deleteNote(notePath);
        setFileNotes((current) => current.filter((item) => item.path !== notePath));
        snackbar({ message: `“${noteName}”已移至系统回收站` });
        return true;
      } catch (error) {
        const msg = fileStoreError(error);
        snackbar({ message: msg });
        return false;
      }
    },
    []
  );

  return {
    fileNotes,
    createNote,
    renameNote,
    deleteNote,
    loadNotes,
  };
}
