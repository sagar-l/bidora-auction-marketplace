export function RouteLoading() {
  return (
    <section className="route-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="route-loading-content">
        <span className="route-loading-mark" aria-hidden="true">B</span>
        <p>Opening BIDORA</p>
        <div className="route-loading-track" aria-hidden="true"><span /></div>
      </div>
    </section>
  );
}
