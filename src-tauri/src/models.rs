use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct NotebookEntry {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NoteEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "notebookId")]
    pub notebook_id: String,
    #[serde(rename = "notebookName")]
    pub notebook_name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NoteSearchResult {
    pub note_path: String,
    pub note_name: String,
    pub line_number: usize,
    pub snippet: String,
    #[serde(default)]
    pub line_content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NoteMetadata {
    pub filename: String,
    pub path: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "modifiedAt")]
    pub modified_at: String,
    #[serde(rename = "editCount")]
    pub edit_count: u32,
    #[serde(rename = "lastModifiedBy")]
    pub last_modified_by: String,
    #[serde(rename = "fileSizeBytes")]
    pub file_size_bytes: u64,
}
