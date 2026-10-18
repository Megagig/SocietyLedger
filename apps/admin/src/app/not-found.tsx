export default function NotFound() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <h2>404 — Not Found</h2>
      <p style={{ color: '#868e96' }}>The page you are looking for does not exist.</p>
      <a href="/" style={{ marginTop: '1rem', color: '#228be6' }}>Go to dashboard</a>
    </div>
  );
}
