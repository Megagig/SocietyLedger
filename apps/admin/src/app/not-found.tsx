export default function NotFound() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <h2>404 — Not Found</h2>
      <p style={{ color: 'var(--mantine-color-dimmed)' }}>The page you are looking for does not exist.</p>
      <a href="/" style={{ marginTop: '1rem', color: 'var(--mantine-color-anchor)' }}>Go to dashboard</a>
    </div>
  );
}
