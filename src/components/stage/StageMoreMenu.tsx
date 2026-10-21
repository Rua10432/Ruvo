import { useRef } from "react";
import { Copy, Download, FileText, MoreHorizontal, StickyNote, X } from "lucide-react";
import type { LocalNote } from "../../types";

type StageMoreMenuProps = {
  activeNote: LocalNote | null;
  tabsCount: number;
  onCopyName: () => void;
  onCloseOtherTabs: () => void;
  onOpenStickyNote?: () => void;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
};

export default function StageMoreMenu({
  activeNote,
  tabsCount,
  onCopyName,
  onCloseOtherTabs,
  onOpenStickyNote,
  onExportDocx,
  onExportPdf,
}: StageMoreMenuProps) {
  const dropdownRef = useRef<any>(null);

  return (
    <div className="stage-topbar-actions">
      <mdui-dropdown placement="bottom-end" ref={dropdownRef}>
        <mdui-button-icon
          slot="trigger"
          className="stage-topbar-btn"
          variant="standard"
          aria-label="更多操作"
          title="更多操作"
        >
          <MoreHorizontal size={16} />
        </mdui-button-icon>
        <mdui-menu className="stage-menu" dense>
          <mdui-menu-item
            onClick={() => {
              if (activeNote) {
                onExportDocx?.();
                if (dropdownRef.current) dropdownRef.current.open = false;
              }
            }}
            disabled={!activeNote}
          >
            <FileText size={15} slot="icon" />
            导出为 Word (.docx)
          </mdui-menu-item>
          <mdui-menu-item
            onClick={() => {
              if (activeNote) {
                onExportPdf?.();
                if (dropdownRef.current) dropdownRef.current.open = false;
              }
            }}
            disabled={!activeNote}
          >
            <Download size={15} slot="icon" />
            导出为 PDF (.pdf)
          </mdui-menu-item>
          <mdui-menu-item
            onClick={() => {
              if (activeNote) {
                onOpenStickyNote?.();
                if (dropdownRef.current) dropdownRef.current.open = false;
              }
            }}
            disabled={!activeNote}
          >
            <StickyNote size={15} slot="icon" />
            以便签查看
          </mdui-menu-item>
          <mdui-menu-item
            onClick={() => {
              if (activeNote) {
                onCopyName();
                if (dropdownRef.current) dropdownRef.current.open = false;
              }
            }}
            disabled={!activeNote}
          >
            <Copy size={15} slot="icon" />
            复制笔记名称
          </mdui-menu-item>
          <mdui-menu-item
            onClick={() => {
              if (activeNote && tabsCount >= 2) {
                onCloseOtherTabs();
                if (dropdownRef.current) dropdownRef.current.open = false;
              }
            }}
            disabled={!activeNote || tabsCount < 2}
          >
            <X size={15} slot="icon" />
            关闭其他标签
          </mdui-menu-item>
        </mdui-menu>
      </mdui-dropdown>
    </div>
  );
}
