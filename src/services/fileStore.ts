import { invoke } from "@tauri-apps/api/core";

import type { Notebook, FileNote, NoteSearchResult, NoteMetadata } from "../types";
export type { Notebook, FileNote, NoteSearchResult, NoteMetadata };

export const fileStore = {
  getAppRoot: () => invoke<string>("get_app_root"),
  listNotebooks: () => invoke<Notebook[]>("list_notebooks"),
  createNotebook: (name: string) => invoke<Notebook>("create_notebook", { name }),
  deleteNotebook: (path: string) => invoke<void>("delete_notebook", { path }),
  listNotes: (notebookPath: string) => invoke<FileNote[]>("list_notes", { notebookPath }),
  readNote: (path: string) => invoke<string>("read_note", { path }),
  writeNote: (path: string, content: string) => invoke<void>("write_note", { path, content }),
  createNote: (notebookPath: string, requestedName?: string) => invoke<FileNote>("create_note", { notebookPath, requestedName }),
  renameNote: (path: string, newName: string) => invoke<FileNote>("rename_note", { path, newName }),
  deleteNote: (path: string) => invoke<void>("delete_note", { path }),
  saveImageAsset: (notebookPath: string, filename: string, base64Data: string) =>
    invoke<string>("save_image_asset", { notebookPath, filename, base64Data }),
  searchNotesContent: (notebookPath: string, query: string) =>
    invoke<NoteSearchResult[]>("search_notes_content", { notebookPath, query }),
  pickSavePath: (defaultName: string, ext: string, filterName: string) =>
    invoke<string | null>("pick_save_path", { defaultName, ext, extension: ext, filterName }),
  writeBinaryFile: (filePath: string, base64Data: string) =>
    invoke<void>("write_binary_file", { path: filePath, filePath, base64Data }),
  getNoteMetadata: (path: string) =>
    invoke<NoteMetadata>("get_note_metadata", { path }),
  openStickyNoteWindow: (notePath: string, noteTitle: string) =>
    invoke<void>("open_sticky_note_window", { notePath, noteTitle }),
  setWindowAlwaysOnTop: (alwaysOnTop: boolean) =>
    invoke<void>("set_window_always_on_top", { alwaysOnTop }),
  focusMainWindow: () =>
    invoke<void>("focus_main_window"),
};

export function fileStoreError(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : "本地文件操作失败";
}
