import express, { Request, Response } from "express";
import session from "express-session";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  addVote,
  createMovie,
  createRegisteredUser,
  db,
  deleteMovie,
  getDashboardStats,
  getMovieImage,
  getUserByUsername,
  initializeDatabase,
  listGenres,
  listMovies,
  verifyUser,
} from "./db";
import { renderAuthPage, renderDashboard, renderGallery, renderLayout, renderManagePage } from "./html";

const SqliteStore = require("better-sqlite3-session-store")(session);

initializeDatabase();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const port = Number(process.env.PORT ?? 3000);

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    store: new SqliteStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 15 * 60 * 1000,
      },
    }),
    secret: process.env.SESSION_SECRET ?? "movie-gallery-poc-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);

app.use(express.static(path.join(process.cwd(), "public")));

app.get("/", (_req, res) => {
  res.redirect("/gallery");
});

app.get("/gallery", (req, res) => {
  const genre = getSingleValue(req.query.genre);
  const body = renderGallery({
    movies: listMovies(genre),
    genres: listGenres(),
    selectedGenre: genre,
    auth: req.session.auth,
  });

  res.send(
    renderLayout({
      title: "Gallery",
      currentPath: "/gallery",
      body,
      auth: req.session.auth,
      flash: consumeFlash(req),
    }),
  );
});

app.get("/dashboard", (req, res) => {
  res.send(
    renderLayout({
      title: "Dashboard",
      currentPath: "/dashboard",
      body: renderDashboard(getDashboardStats()),
      auth: req.session.auth,
      flash: consumeFlash(req),
    }),
  );
});

app.get("/api/dashboard-stats", (_req, res) => {
  res.json(getDashboardStats());
});

app.get("/auth", (req, res) => {
  res.send(
    renderLayout({
      title: "Auth",
      currentPath: "/auth",
      body: renderAuthPage(),
      auth: req.session.auth,
      flash: consumeFlash(req),
    }),
  );
});

app.post("/register", (req, res) => {
  const username = normalizeText(req.body.username);
  const password = normalizeText(req.body.password);

  if (username.length < 3 || password.length < 6) {
    setFlash(req, "error", "Username must be at least 3 characters and password at least 6 characters.");
    res.redirect("/auth");
    return;
  }

  if (getUserByUsername(username)) {
    setFlash(req, "error", "That username is already taken.");
    res.redirect("/auth");
    return;
  }

  req.session.auth = createRegisteredUser(username, password);
  setFlash(req, "success", "Account created. You can now manage the gallery.");
  res.redirect("/manage");
});

app.post("/login", (req, res) => {
  const username = normalizeText(req.body.username);
  const password = normalizeText(req.body.password);
  const user = verifyUser(username, password);

  if (!user) {
    setFlash(req, "error", "Invalid username or password.");
    res.redirect("/auth");
    return;
  }

  req.session.auth = user;
  setFlash(req, "success", "Logged in successfully.");
  res.redirect("/manage");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/gallery");
  });
});

app.get("/manage", (req, res) => {
  res.send(
    renderLayout({
      title: "Manage",
      currentPath: "/manage",
      body: renderManagePage(req.session.auth),
      auth: req.session.auth,
      flash: consumeFlash(req),
    }),
  );
});

app.post("/movies", requireRegisteredUser, upload.single("poster"), (req, res) => {
  const title = normalizeText(req.body.title);
  const genre = normalizeText(req.body.genre);
  const description = normalizeText(req.body.description);
  const releaseYear = Number(req.body.releaseYear);
  const file = req.file;

  if (!title || !genre || !description || !Number.isInteger(releaseYear) || !file) {
    setFlash(req, "error", "All movie fields, including the poster image, are required.");
    res.redirect("/manage");
    return;
  }

  createMovie({
    title,
    genre,
    description,
    releaseYear,
    imageBuffer: file.buffer,
    imageMimeType: file.mimetype || "application/octet-stream",
    createdBy: req.session.auth!.userId,
  });

  setFlash(req, "success", "Movie added to the gallery.");
  res.redirect("/gallery");
});

app.post("/movies/:id/delete", requireRegisteredUser, (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isInteger(movieId)) {
    res.status(400).send("Invalid movie id");
    return;
  }

  deleteMovie(movieId);
  setFlash(req, "success", "Movie deleted.");
  res.redirect("/gallery");
});

app.post("/movies/:id/vote", (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isInteger(movieId)) {
    res.status(400).send("Invalid movie id");
    return;
  }

  const voterKey = req.session.auth ? `user:${req.session.auth.userId}` : `guest:${ensureGuestId(req)}`;
  const result = addVote(movieId, voterKey);

  if (wantsJson(req)) {
    res.json(result);
    return;
  }

  setFlash(req, result.added ? "success" : "error", result.added ? "Vote recorded." : "You already voted for that movie in this session.");
  res.redirect("/gallery");
});

app.get("/images/:id", (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isInteger(movieId)) {
    res.status(400).send("Invalid movie id");
    return;
  }

  const image = getMovieImage(movieId);
  if (!image) {
    res.status(404).send("Not found");
    return;
  }

  res.setHeader("Content-Type", image.imageMimeType);
  res.send(image.imageBlob);
});

app.use((error: unknown, req: Request, res: Response, _next: () => void) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (message.includes("UNIQUE constraint failed: votes.movie_id, votes.voter_key")) {
    if (wantsJson(req)) {
      res.status(409).json({ added: false, voteCount: 0, error: "Duplicate vote" });
      return;
    }

    setFlash(req, "error", "You already voted for that movie in this session.");
    res.redirect("/gallery");
    return;
  }

  res.status(500).send(message);
});

app.listen(port, () => {
  console.log(`Movie Gallery PoC running at http://localhost:${port}`);
});

function requireRegisteredUser(req: Request, res: Response, next: () => void): void {
  if (!req.session.auth) {
    setFlash(req, "error", "Please log in as a registered user.");
    res.redirect("/auth");
    return;
  }

  next();
}

function setFlash(req: Request, type: "error" | "success", message: string): void {
  req.session.flash = { type, message };
}

function consumeFlash(req: Request): { type: "error" | "success"; message: string } | undefined {
  const flash = req.session.flash;
  delete req.session.flash;
  return flash;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureGuestId(req: Request): string {
  if (!req.session.guestId) {
    req.session.guestId = randomUUID();
  }

  return req.session.guestId;
}

function wantsJson(req: Request): boolean {
  const acceptHeader = req.headers.accept || "";
  return acceptHeader.includes("application/json") || req.headers["x-requested-with"] === "fetch";
}

function getSingleValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}