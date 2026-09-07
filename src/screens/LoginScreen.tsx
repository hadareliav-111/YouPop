import { useState, type FormEvent } from "react";

interface LoginScreenProps {
  onSignIn: (username: string, password: string) => Promise<{ error: string | null }>;
}

// Username + password only — there is no email field anywhere on this
// screen, and no copy or error message ever mentions email. See
// useAuth.signIn for the internal (Supabase-only) email construction.
export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await onSignIn(username, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="login-screen">
      <form className="login-screen__form" onSubmit={handleSubmit}>
        <h1 className="login-screen__title">Ready to Pop?</h1>

        <div className="details-form__field">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="details-form__field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="search-step__status search-step__status--error">{error}</p>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
