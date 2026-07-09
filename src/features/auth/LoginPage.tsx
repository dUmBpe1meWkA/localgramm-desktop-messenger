import { FormEvent, useState } from "react";

type LoginPageProps = {
  loading: boolean;
  error: string;
  onLogin: (username: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
};

export default function LoginPage({ loading, error, onLogin, onSwitchToRegister }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(username, password);
  }

  return (
    <form className="lg2-auth-card" onSubmit={handleSubmit}>
      <div className="lg2-auth-logo">L</div>
      <h1>LocalGramm</h1>
      <p>Войди в локальный мессенджер.</p>

      <label>
        Username
        <input
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          required
        />
      </label>

      <label>
        Password
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="password"
          required
          type="password"
        />
      </label>

      {error && <div className="lg2-auth-error">{error}</div>}

      <button className="lg2-primary-button" disabled={loading} type="submit">
        {loading ? "Входим..." : "Войти"}
      </button>

      <button className="lg2-link-button" type="button" onClick={onSwitchToRegister}>
        Создать аккаунт
      </button>
    </form>
  );
}
