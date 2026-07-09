import { FormEvent, useState } from "react";

type RegisterPageProps = {
  loading: boolean;
  error: string;
  onRegister: (username: string, displayName: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
};

export default function RegisterPage({ loading, error, onRegister, onSwitchToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onRegister(username, displayName || username, password);
  }

  return (
    <form className="lg2-auth-card" onSubmit={handleSubmit}>
      <div className="lg2-auth-logo">L</div>
      <h1>LocalGramm</h1>
      <p>Создай аккаунт для новой версии интерфейса.</p>

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
        Display name
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Имя"
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
        {loading ? "Создаём..." : "Зарегистрироваться"}
      </button>

      <button className="lg2-link-button" type="button" onClick={onSwitchToLogin}>
        Уже есть аккаунт
      </button>
    </form>
  );
}
