export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 360, padding: '2rem', border: '1px solid #dee2e6', borderRadius: 8 }}>
        <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Admin Login</h2>
        <p style={{ color: '#868e96', textAlign: 'center', fontSize: 14 }}>
          Login UI ships in A1.6
        </p>
      </div>
    </div>
  );
}
