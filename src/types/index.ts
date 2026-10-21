export type Notebook = {
  id: string;
  name: string;
  path: string;
};

export type FileNote = {
  id: string;
  name: string;
  path: string;
  notebookId: string;
  notebookName: string;
};

export type RenamedNote = {
  oldPath: string;
  newNote: FileNote;
};

export type LocalNote = {
  id: string;
  name: string;
  path?: string;
  content: string;
  savedContent?: string;
  notebookId?: string;
};

export type TreeItem = {
  id: string;
  label: string;
  type: "file";
  path?: string;
  content?: string;
  snippet?: string;
  snippetLine?: number;
};

export type NoteSearchResult = {
  note_path: string;
  note_name: string;
  line_number: number;
  snippet: string;
  line_content?: string;
  notePath?: string;
  noteName?: string;
  lineNumber?: number;
};

export type RequestedNote = {
  id: string;
  name: string;
  path?: string;
};

export type RequestedHeading = {
  label: string;
};

export type StageStatus = {
  noteName: string | null;
  notePath: string | null;
  wordCount: number;
  isDirty: boolean;
  message: string;
  saveState?: "saved" | "saving" | "unsaved";
};

export type OutlineItem = {
  id: string;
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
};

export type Backlink = {
  id: string;
  title: string;
  excerpt: string;
  meta: string;
};

export type ViewMode = "read" | "edit";
export type ContextMode = "outline" | "backlinks";

export type ActivityBarTab = "notes" | "search";
export type ThemeMode = "arona" | "plana";

export type NoteMetadata = {
  filename: string;
  path: string;
  createdAt: string;
  modifiedAt: string;
  editCount: number;
  lastModifiedBy: string;
  fileSizeBytes: number;
};

