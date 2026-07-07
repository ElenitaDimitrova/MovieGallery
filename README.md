# Movie Gallery PoC

Minimal proof of concept for a local collaborative movie gallery built with Node.js, TypeScript, SQLite, HTML, CSS, and browser JavaScript.

## Included in this PoC

- guest browsing and voting
- registered-user login and registration
- registered-user movie upload and deletion
- SQLite-backed movie catalogue and vote counts
- image storage in SQLite BLOB fields
- server-side sessions stored in SQLite
- responsive gallery and statistics dashboard

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

Demo registered user:

- username: `curator`
- password: `demo1234`

## Build

```bash
npm run build
npm start
```