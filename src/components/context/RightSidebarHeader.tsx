export type RightSidebarHeaderProps = {
  onClose?: () => void;
};

export default function RightSidebarHeader({ onClose: _onClose }: RightSidebarHeaderProps) {
  return (
    <header className="right-sidebar-header">
      <div className="right-sidebar-title-group">
        <h2 className="right-sidebar-title">辅助信息</h2>
      </div>
    </header>
  );
}

