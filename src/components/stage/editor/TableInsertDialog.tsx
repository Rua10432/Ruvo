import React, { useEffect, useRef, useState } from "react";
import { Columns, Minus, Plus, Rows, Table as TableIcon } from "lucide-react";
import "./TableInsertDialog.css";

export interface TableInsertDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (rows: number, cols: number) => void;
  initialRows?: number;
  initialCols?: number;
}

const MIN_ROWS = 1;
const MAX_ROWS = 20;
const MIN_COLS = 1;
const MAX_COLS = 10;
const MAX_PREVIEW_BODY_ROWS = 5;

const PRESETS = [
  { label: "3 × 3", desc: "常用标准", rows: 3, cols: 3 },
  { label: "4 × 4", desc: "四维对比", rows: 4, cols: 4 },
  { label: "2 × 3", desc: "精简两行", rows: 2, cols: 3 },
  { label: "5 × 4", desc: "数据清单", rows: 5, cols: 4 },
];

export default function TableInsertDialog({
  open,
  onClose,
  onInsert,
  initialRows = 3,
  initialCols = 3,
}: TableInsertDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<number>(initialRows);
  const [cols, setCols] = useState<number>(initialCols);

  // Sync state when dialog opens
  useEffect(() => {
    if (open) {
      setRows(initialRows);
      setCols(initialCols);
    }
  }, [open, initialRows, initialCols]);

  // Sync MDUI dialog closed event (ESC or backdrop click)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClosed = () => {
      onClose();
    };
    el.addEventListener("closed", handleClosed);
    return () => {
      el.removeEventListener("closed", handleClosed);
    };
  }, [onClose]);

  const clampRows = (val: number) => Math.max(MIN_ROWS, Math.min(MAX_ROWS, val));
  const clampCols = (val: number) => Math.max(MIN_COLS, Math.min(MAX_COLS, val));

  const handleRowChange = (delta: number) => {
    setRows((prev) => clampRows(prev + delta));
  };

  const handleColChange = (delta: number) => {
    setCols((prev) => clampCols(prev + delta));
  };

  const handleRowInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      setRows(clampRows(parsed));
    } else if (e.target.value === "") {
      setRows(MIN_ROWS);
    }
  };

  const handleColInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      setCols(clampCols(parsed));
    } else if (e.target.value === "") {
      setCols(MIN_COLS);
    }
  };

  const handleSubmit = () => {
    const validRows = clampRows(rows);
    const validCols = clampCols(cols);
    onInsert(validRows, validCols);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Preview computations
  const previewBodyRowsCount = Math.min(Math.max(0, rows - 1), MAX_PREVIEW_BODY_ROWS);
  const hasHiddenRows = rows - 1 > MAX_PREVIEW_BODY_ROWS;
  const hiddenRowCount = rows - 1 - MAX_PREVIEW_BODY_ROWS;

  return (
    <mdui-dialog
      ref={dialogRef}
      open={open ? true : undefined}
      close-on-overlay-click
      close-on-esc
      headline="插入表格"
      className="table-insert-dialog"
      onKeyDown={handleKeyDown}
    >
      <div className="table-dialog-content">
        {/* Quick Presets */}
        <div>
          <div className="table-dialog-section-title">
            <TableIcon size={14} />
            快捷常用规格
          </div>
          <div className="table-presets-grid">
            {PRESETS.map((preset) => {
              const isActive = rows === preset.rows && cols === preset.cols;
              return (
                <mdui-button
                  key={preset.label}
                  variant={isActive ? "tonal" : "outlined"}
                  className={`table-preset-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setRows(preset.rows);
                    setCols(preset.cols);
                  }}
                >
                  <span className="table-preset-label">{preset.label}</span>
                  <span className="table-preset-desc">{preset.desc}</span>
                </mdui-button>
              );
            })}
          </div>
        </div>

        {/* Custom Row & Column Steppers */}
        <div className="table-stepper-group">
          <div className="table-stepper-field">
            <label className="table-stepper-label">
              <Rows size={15} />
              行数 (含表头)
            </label>
            <div className="table-stepper-control">
              <mdui-button-icon
                variant="standard"
                className="table-stepper-btn"
                onClick={() => handleRowChange(-1)}
                disabled={rows <= MIN_ROWS}
                title="减少一行"
                aria-label="减少一行"
              >
                <Minus size={14} />
              </mdui-button-icon>
              <input
                type="number"
                className="table-stepper-input"
                min={MIN_ROWS}
                max={MAX_ROWS}
                value={rows}
                onChange={handleRowInputChange}
              />
              <mdui-button-icon
                variant="standard"
                className="table-stepper-btn"
                onClick={() => handleRowChange(1)}
                disabled={rows >= MAX_ROWS}
                title="增加一行"
                aria-label="增加一行"
              >
                <Plus size={14} />
              </mdui-button-icon>
            </div>
          </div>

          <div className="table-stepper-field">
            <label className="table-stepper-label">
              <Columns size={15} />
              列数 (1~10 列)
            </label>
            <div className="table-stepper-control">
              <mdui-button-icon
                variant="standard"
                className="table-stepper-btn"
                onClick={() => handleColChange(-1)}
                disabled={cols <= MIN_COLS}
                title="减少一列"
                aria-label="减少一列"
              >
                <Minus size={14} />
              </mdui-button-icon>
              <input
                type="number"
                className="table-stepper-input"
                min={MIN_COLS}
                max={MAX_COLS}
                value={cols}
                onChange={handleColInputChange}
              />
              <mdui-button-icon
                variant="standard"
                className="table-stepper-btn"
                onClick={() => handleColChange(1)}
                disabled={cols >= MAX_COLS}
                title="增加一列"
                aria-label="增加一列"
              >
                <Plus size={14} />
              </mdui-button-icon>
            </div>
          </div>
        </div>

        {/* Live Grid Preview */}
        <div className="table-preview-card">
          <div className="table-preview-header">
            <span>表格结构预览</span>
            <span>{cols} 列模式</span>
          </div>

          <div className="table-preview-grid-wrap">
            {/* Header row */}
            <div
              className="table-preview-grid"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: cols }).map((_, cIdx) => (
                <div key={`th-${cIdx}`} className="table-preview-cell is-header">
                  表头 {cIdx + 1}
                </div>
              ))}
            </div>

            {/* Body rows */}
            {Array.from({ length: previewBodyRowsCount }).map((_, rIdx) => (
              <div
                key={`tr-${rIdx}`}
                className="table-preview-grid"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: cols }).map((_, cIdx) => (
                  <div key={`td-${rIdx}-${cIdx}`} className="table-preview-cell is-body">
                    ···
                  </div>
                ))}
              </div>
            ))}

            {hasHiddenRows && (
              <div className="table-preview-more-hint">
                + 其余 {hiddenRowCount} 行数据...
              </div>
            )}
          </div>

          <div className="table-preview-summary">
            共 <strong>{rows}</strong> 行 × <strong>{cols}</strong> 列（包含{" "}
            <strong>1</strong> 行表头与{" "}
            <strong>{Math.max(0, rows - 1)}</strong> 行数据单元格）
          </div>
        </div>
      </div>

      <mdui-button slot="action" variant="text" onClick={onClose}>
        取消
      </mdui-button>
      <mdui-button slot="action" variant="filled" onClick={handleSubmit}>
        插入表格
      </mdui-button>
    </mdui-dialog>
  );
}
