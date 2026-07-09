# LocalGramm Desktop Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

LocalGramm is a desktop messenger prototype built with a React/Vite frontend, a Tauri shell, and a FastAPI backend. It focuses on the mechanics of a private chat product: accounts, chats, messages, reactions, uploads, group management, and local desktop packaging.

The repository is a source-only public version. Runtime data, uploaded media, local SQLite databases, Python virtual environments, and Tauri/Rust build output are intentionally excluded.

Portfolio: [lu3x.duckdns.org](https://lu3x.duckdns.org/)

## What is included

- React 19 + TypeScript messenger interface
- Tauri 2 desktop wrapper
- FastAPI backend with SQLAlchemy models
- JWT-based authentication
- Private chats, group chats, reactions, pinned/muted/hidden chat states
- File upload endpoints for avatars and message attachments
- Local SQLite development setup

## Stack

- Frontend: React, TypeScript, Vite, lucide-react
- Desktop: Tauri 2, Rust
- Backend: FastAPI, SQLAlchemy, python-jose, passlib, bcrypt
- Storage: SQLite by default, configurable through `LOCALGRAMM_DATABASE_URL`

## Repository layout

```text
backend/      FastAPI API, auth, database models, schemas
src/          React application source
src-tauri/    Tauri desktop shell
public/       Minimal public assets required by Vite/Tauri
```

## Local development

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Set local configuration. Use `config.sample` as the reference, but do not commit real local secrets.

Run the backend:

```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri dev
```

## Notes

- Uploaded files are written to `backend/uploads` by default and are ignored by Git.
- The public version does not include the previous local SQLite database or uploaded chat media.
- Sticker/media dumps are excluded to keep the repository source-focused and avoid publishing runtime assets.

## License

MIT. See [LICENSE](LICENSE).
