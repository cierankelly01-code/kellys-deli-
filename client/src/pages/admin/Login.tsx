import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, auth } from "../../lib/admin";

const DEMO = { email: "demo@kellysdeli.co.uk", password: "demo1234" };

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.isAuthed) navigate("/admin", { replace: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(email.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="login-card card">
        <div className="center">
          <span className="brand-mark">Kelly&apos;s Deli</span>
          <p className="admin-tag">Staff sign in</p>
        </div>
        {error && <div className="notice danger">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={busy || !email || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {import.meta.env.DEV && (
          <div className="demo-box">
            <p className="muted" style={{ margin: "0 0 8px" }}>
              Just exploring? Use the demo account:
            </p>
            <code className="demo-creds">{DEMO.email} · {DEMO.password}</code>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 10 }}
              onClick={() => { setEmail(DEMO.email); setPassword(DEMO.password); }}
            >
              Fill demo login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
