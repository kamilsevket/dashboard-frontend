import { useState } from 'react';
import { API_BASE } from '../config';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('dashboard_token', token);
        onLogin(token);
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🚀 Dashboard</h1>
        <p>Enter password to continue</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }
        .login-card {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 1rem;
          padding: 2rem;
          width: 100%;
          max-width: 320px;
          text-align: center;
        }
        .login-card h1 {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
        }
        .login-card p {
          color: #888;
          margin-bottom: 1.5rem;
        }
        .login-card input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 0.5rem;
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 1rem;
          margin-bottom: 1rem;
        }
        .login-card input:focus {
          outline: none;
          border-color: #667eea;
        }
        .login-card button {
          width: 100%;
          padding: 0.75rem;
          border: none;
          border-radius: 0.5rem;
          background: #667eea;
          color: white;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .login-card button:hover {
          background: #5a6fd6;
        }
        .login-card button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .error {
          color: #ff6b6b;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
