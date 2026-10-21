type BrandHeaderProps = {
  onCollapse?: () => void;
};

export default function BrandHeader({ onCollapse: _ }: BrandHeaderProps) {
  return (
    <header className="sidebar-header">
      <div className="brand-lockup" aria-label="Ruvo">
        <img
          src="/app-icon.png"
          alt="Ruvo"
          aria-hidden="true"
          className="brand-logo-img"
        />
        <span>Ruvo</span>
      </div>
    </header>
  );
}
