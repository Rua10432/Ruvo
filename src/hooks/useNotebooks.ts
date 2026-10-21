import { useCallback, useEffect, useState } from "react";
import { prompt, snackbar } from "mdui";
import { fileStore, fileStoreError } from "../services/fileStore";
import { SAMPLE_NOTEBOOK_NAME, SAMPLE_NOTE_NAME, SAMPLE_NOTE_CONTENT, ensureSampleAssets } from "../utils/sampleData";
import type { Notebook } from "../types";

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);

  const loadNotebooks = useCallback(async () => {
    try {
      const list = await fileStore.listNotebooks();
      if (list.length === 0) {
        const defaultNotebook = await fileStore.createNotebook(SAMPLE_NOTEBOOK_NAME);
        try {
          await ensureSampleAssets(defaultNotebook.path);
          const sampleNote = await fileStore.createNote(defaultNotebook.path, SAMPLE_NOTE_NAME);
          await fileStore.writeNote(sampleNote.path, SAMPLE_NOTE_CONTENT);
        } catch (err) {
          console.warn("Failed to create sample note:", err);
        }
        setNotebooks([defaultNotebook]);
        setActiveNotebook(defaultNotebook);
      } else {
        setNotebooks(list);
        setActiveNotebook((prev) => prev ?? list[0] ?? null);
      }
    } catch (error) {
      const msg = fileStoreError(error);
      snackbar({ message: msg });
    }
  }, []);

  useEffect(() => {
    void loadNotebooks();
  }, [loadNotebooks]);

  const selectNotebook = useCallback((notebook: Notebook) => {
    setActiveNotebook(notebook);
  }, []);

  const createNotebook = useCallback(async () => {
    try {
      const name = await prompt({
        headline: "新建笔记本",
        confirmText: "创建",
        cancelText: "取消",
        textFieldOptions: {
          variant: "outlined",
          label: "笔记本名称",
        },
      });
      if (!name?.trim()) return null;
      const notebook = await fileStore.createNotebook(name.trim());
      setNotebooks((current) => [...current, notebook]);
      setActiveNotebook(notebook);
      snackbar({ message: `笔记本“${notebook.name}”已创建` });
      return notebook;
    } catch (error) {
      if (error && typeof error !== "undefined") {
        const msg = fileStoreError(error);
        if (msg) snackbar({ message: msg });
      }
      return null;
    }
  }, []);

  const deleteNotebook = useCallback(async (notebook: Notebook) => {
    try {
      await fileStore.deleteNotebook(notebook.path);
      const remaining = notebooks.filter((item) => item.id !== notebook.id);

      if (remaining.length === 0) {
        // 若删除后已无任何笔记本，自动重建“示例笔记本”与示例笔记，避免空库死锁
        const defaultNotebook = await fileStore.createNotebook(SAMPLE_NOTEBOOK_NAME);
        try {
          await ensureSampleAssets(defaultNotebook.path);
          const sampleNote = await fileStore.createNote(defaultNotebook.path, SAMPLE_NOTE_NAME);
          await fileStore.writeNote(sampleNote.path, SAMPLE_NOTE_CONTENT);
        } catch {}
        setNotebooks([defaultNotebook]);
        setActiveNotebook(defaultNotebook);
      } else {
        setNotebooks(remaining);
        if (activeNotebook?.id === notebook.id) {
          setActiveNotebook(remaining[0]);
        }
      }

      snackbar({ message: `笔记本“${notebook.name}”已移至系统回收站` });
      return true;
    } catch (error) {
      if (error && typeof error !== "undefined") {
        const msg = fileStoreError(error);
        if (msg) snackbar({ message: msg });
      }
      return false;
    }
  }, [activeNotebook, notebooks]);

  return {
    notebooks,
    activeNotebook,
    selectNotebook,
    createNotebook,
    deleteNotebook,
    loadNotebooks,
  };
}
