import { BookOpen, ChevronDown, Folder, Plus, Trash2 } from "lucide-react";
import { confirm } from "mdui";
import type { Notebook } from "../../types";

type NotebookSwitcherProps = {
  notebooks: Notebook[];
  activeNotebookId?: string | null;
  onSelectNotebook?: (notebook: Notebook) => void;
  onCreateNotebook?: () => void;
  onDeleteNotebook?: (notebook: Notebook) => Promise<void> | void;
};

export default function NotebookSwitcher({
  notebooks,
  activeNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onDeleteNotebook,
}: NotebookSwitcherProps) {
  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId);

  const handleDelete = async (e: React.MouseEvent, notebook: Notebook) => {
    e.stopPropagation();
    try {
      await confirm({
        headline: "删除笔记本",
        description: `确定将笔记本“${notebook.name}”移至系统回收站吗？包含的所有笔记也会一同移入回收站。`,
        confirmText: "移至回收站",
        cancelText: "取消",
      });
      await onDeleteNotebook?.(notebook);
    } catch {
      // 用户取消删除
    }
  };

  return (
    <div className="vault-control">
      <mdui-dropdown className="vault-dropdown" placement="bottom-start">
        <mdui-button
          slot="trigger"
          variant="outlined"
          full-width
          className="vault-switcher-btn"
        >
          <BookOpen size={16} slot="icon" />
          <span className="vault-title-text">{activeNotebook?.name ?? "选择笔记本"}</span>
          <ChevronDown size={14} slot="end-icon" />
        </mdui-button>
        <mdui-menu selects="single" value={activeNotebookId ?? ""} className="vault-menu">
          {notebooks.map((notebook) => (
            <mdui-menu-item
              key={notebook.id}
              value={notebook.id}
              onClick={() => onSelectNotebook?.(notebook)}
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                void handleDelete(e, notebook);
              }}
            >
              <Folder size={15} slot="icon" />
              {notebook.name}
              <span slot="end-icon" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {notebook.id === activeNotebookId && (
                  <span style={{ color: "var(--md-sys-color-primary)", fontWeight: "bold", fontSize: 13 }}>✓</span>
                )}
                {onDeleteNotebook && (
                  <span
                    role="button"
                    tabIndex={0}
                    title={`删除笔记本“${notebook.name}”`}
                    className="vault-item-delete-icon"
                    onClick={(e) => void handleDelete(e, notebook)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleDelete(e as any, notebook);
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </span>
                )}
              </span>
            </mdui-menu-item>
          ))}
          {onCreateNotebook && (
            <>
              {notebooks.length > 0 && <mdui-divider />}
              <mdui-menu-item onClick={onCreateNotebook}>
                <Plus size={15} slot="icon" />
                新建笔记本
              </mdui-menu-item>
            </>
          )}
          {notebooks.length === 0 && <mdui-menu-item disabled>暂无笔记本</mdui-menu-item>}
        </mdui-menu>
      </mdui-dropdown>
    </div>
  );
}
