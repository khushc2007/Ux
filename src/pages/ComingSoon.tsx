export default function ComingSoon({ page, icon, sub }: { page: string; icon: string; sub: string }) {
  return (
    <div className="coming-soon anim-fade-in">
      <div className="coming-soon__icon">
        <span style={{ fontSize: 24, color: "var(--cyan)" }}>{icon}</span>
      </div>
      <div className="coming-soon__title">{page.toUpperCase()}</div>
      <div className="coming-soon__sub">{sub}</div>
      <div style={{ marginTop: 8 }}>
        <span className="badge badge-cyan">WILL BUILD SOON</span>
      </div>
    </div>
  );
}
