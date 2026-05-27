import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login: storeToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await login(email, password);
      storeToken(response.access_token);
      navigate("/app/command-center");
    } catch (err: any) {
      setError(err?.message ?? "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Secure Access</p>
        <h2 className="mt-2 text-2xl font-semibold text-white font-display">Verification Command Center Login</h2>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to review live deliveries, anomalies, evidence, and audit replay.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-white placeholder:text-slate-500"
            placeholder="name@company.com"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-white placeholder:text-slate-500"
            placeholder="Enter password"
            required
          />
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
};

export default LoginPage;
