"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const db_1 = require("./db");
const html_1 = require("./html");
const SqliteStore = require("better-sqlite3-session-store")(express_session_1.default);
(0, db_1.initializeDatabase)();
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const port = Number(process.env.PORT ?? 3000);
app.set("trust proxy", 1);
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
    store: new SqliteStore({
        client: db_1.db,
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
}));
app.use(express_1.default.static(node_path_1.default.join(process.cwd(), "public")));
app.get("/", (_req, res) => {
    res.redirect("/gallery");
});
app.get("/gallery", (req, res) => {
    const genre = getSingleValue(req.query.genre);
    const body = (0, html_1.renderGallery)({
        movies: (0, db_1.listMovies)(genre),
        genres: (0, db_1.listGenres)(),
        selectedGenre: genre,
        auth: req.session.auth,
    });
    res.send((0, html_1.renderLayout)({
        title: "Gallery",
        currentPath: "/gallery",
        body,
        auth: req.session.auth,
        flash: consumeFlash(req),
    }));
});
app.get("/dashboard", (req, res) => {
    res.send((0, html_1.renderLayout)({
        title: "Dashboard",
        currentPath: "/dashboard",
        body: (0, html_1.renderDashboard)((0, db_1.getDashboardStats)()),
        auth: req.session.auth,
        flash: consumeFlash(req),
    }));
});
app.get("/api/dashboard-stats", (_req, res) => {
    res.json((0, db_1.getDashboardStats)());
});
app.get("/auth", (req, res) => {
    res.send((0, html_1.renderLayout)({
        title: "Auth",
        currentPath: "/auth",
        body: (0, html_1.renderAuthPage)(),
        auth: req.session.auth,
        flash: consumeFlash(req),
    }));
});
app.post("/register", (req, res) => {
    const username = normalizeText(req.body.username);
    const password = normalizeText(req.body.password);
    if (username.length < 3 || password.length < 6) {
        setFlash(req, "error", "Username must be at least 3 characters and password at least 6 characters.");
        res.redirect("/auth");
        return;
    }
    if ((0, db_1.getUserByUsername)(username)) {
        setFlash(req, "error", "That username is already taken.");
        res.redirect("/auth");
        return;
    }
    req.session.auth = (0, db_1.createRegisteredUser)(username, password);
    setFlash(req, "success", "Account created. You can now manage the gallery.");
    res.redirect("/manage");
});
app.post("/login", (req, res) => {
    const username = normalizeText(req.body.username);
    const password = normalizeText(req.body.password);
    const user = (0, db_1.verifyUser)(username, password);
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
    res.send((0, html_1.renderLayout)({
        title: "Manage",
        currentPath: "/manage",
        body: (0, html_1.renderManagePage)(req.session.auth),
        auth: req.session.auth,
        flash: consumeFlash(req),
    }));
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
    (0, db_1.createMovie)({
        title,
        genre,
        description,
        releaseYear,
        imageBuffer: file.buffer,
        imageMimeType: file.mimetype || "application/octet-stream",
        createdBy: req.session.auth.userId,
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
    (0, db_1.deleteMovie)(movieId);
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
    const result = (0, db_1.addVote)(movieId, voterKey);
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
    const image = (0, db_1.getMovieImage)(movieId);
    if (!image) {
        res.status(404).send("Not found");
        return;
    }
    res.setHeader("Content-Type", image.imageMimeType);
    res.send(image.imageBlob);
});
app.use((error, req, res, _next) => {
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
function requireRegisteredUser(req, res, next) {
    if (!req.session.auth) {
        setFlash(req, "error", "Please log in as a registered user.");
        res.redirect("/auth");
        return;
    }
    next();
}
function setFlash(req, type, message) {
    req.session.flash = { type, message };
}
function consumeFlash(req) {
    const flash = req.session.flash;
    delete req.session.flash;
    return flash;
}
function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}
function ensureGuestId(req) {
    if (!req.session.guestId) {
        req.session.guestId = (0, node_crypto_1.randomUUID)();
    }
    return req.session.guestId;
}
function wantsJson(req) {
    const acceptHeader = req.headers.accept || "";
    return acceptHeader.includes("application/json") || req.headers["x-requested-with"] === "fetch";
}
function getSingleValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
