"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initializeDatabase = initializeDatabase;
exports.listGenres = listGenres;
exports.listMovies = listMovies;
exports.getMovieImage = getMovieImage;
exports.getUserByUsername = getUserByUsername;
exports.createRegisteredUser = createRegisteredUser;
exports.verifyUser = verifyUser;
exports.createMovie = createMovie;
exports.deleteMovie = deleteMovie;
exports.addVote = addVote;
exports.getDashboardStats = getDashboardStats;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dataDir = node_path_1.default.join(process.cwd(), "data");
node_fs_1.default.mkdirSync(dataDir, { recursive: true });
const dbPath = node_path_1.default.join(dataDir, "movie-gallery.db");
exports.db = new better_sqlite3_1.default(dbPath);
exports.db.pragma("journal_mode = WAL");
exports.db.pragma("foreign_keys = ON");
function initializeDatabase() {
    exports.db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role = 'registered'),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      genre TEXT NOT NULL,
      release_year INTEGER NOT NULL,
      image_blob BLOB NOT NULL,
      image_mime_type TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL,
      voter_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(movie_id, voter_key),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
  `);
    seedRegisteredUser();
    seedMovies();
}
function seedRegisteredUser() {
    const existingUser = exports.db.prepare("SELECT id FROM users WHERE username = ?").get("curator");
    if (existingUser) {
        return;
    }
    const passwordHash = bcryptjs_1.default.hashSync("demo1234", 10);
    exports.db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'registered')").run("curator", passwordHash);
}
function seedMovies() {
    const countRow = exports.db.prepare("SELECT COUNT(*) AS count FROM movies").get();
    if (countRow.count > 0) {
        return;
    }
    const user = exports.db.prepare("SELECT id FROM users WHERE username = ?").get("curator");
    const seedEntries = [
        {
            title: "Neon Run",
            description: "A courier races through a flooded megacity to deliver the one reel that can expose a political machine.",
            genre: "Action",
            releaseYear: 2024,
            color: "#d1495b",
        },
        {
            title: "Quiet Pines",
            description: "A village choir fights to preserve its last season together as a wildfire closes in around their mountain home.",
            genre: "Drama",
            releaseYear: 2023,
            color: "#3f7d20",
        },
        {
            title: "Paper Moons",
            description: "An inventive animator discovers that her sketches begin rewriting the memories of everyone who watches them.",
            genre: "Animation",
            releaseYear: 2025,
            color: "#2b50aa",
        },
    ];
    const insertMovie = exports.db.prepare(`
    INSERT INTO movies (title, description, genre, release_year, image_blob, image_mime_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    const insertVote = exports.db.prepare("INSERT INTO votes (movie_id, voter_key) VALUES (?, ?)");
    const transaction = exports.db.transaction(() => {
        for (const [index, movie] of seedEntries.entries()) {
            const imageBuffer = createPoster(movie.title, movie.genre, movie.color);
            const result = insertMovie.run(movie.title, movie.description, movie.genre, movie.releaseYear, imageBuffer, "image/svg+xml", user.id);
            const movieId = Number(result.lastInsertRowid);
            for (let voteIndex = 0; voteIndex <= index; voteIndex += 1) {
                insertVote.run(movieId, `seed-voter-${index}-${voteIndex}`);
            }
        }
    });
    transaction();
}
function createPoster(title, genre, accent) {
    const escapedTitle = escapeXml(title);
    const escapedGenre = escapeXml(genre.toUpperCase());
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#101820" />
        </linearGradient>
      </defs>
      <rect width="480" height="720" fill="url(#bg)" rx="32" />
      <circle cx="384" cy="124" r="88" fill="rgba(255,255,255,0.14)" />
      <rect x="44" y="56" width="132" height="36" rx="18" fill="rgba(255,255,255,0.18)" />
      <text x="68" y="80" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#f5f7fa">MOVIE GALLERY</text>
      <text x="44" y="500" font-family="Georgia, serif" font-size="52" font-weight="700" fill="#ffffff">${escapedTitle}</text>
      <text x="44" y="556" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#e6eaf0">${escapedGenre}</text>
      <rect x="44" y="598" width="200" height="6" rx="3" fill="#ffffff" opacity="0.7" />
      <rect x="44" y="620" width="124" height="6" rx="3" fill="#ffffff" opacity="0.4" />
    </svg>
  `;
    return Buffer.from(svg.trim(), "utf8");
}
function escapeXml(value) {
    return value.replace(/[<>&"']/g, (char) => {
        switch (char) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case '"':
                return "&quot;";
            default:
                return "&#39;";
        }
    });
}
function listGenres() {
    const rows = exports.db.prepare("SELECT DISTINCT genre FROM movies ORDER BY genre ASC").all();
    return rows.map((row) => row.genre);
}
function listMovies(genre) {
    const statement = genre
        ? exports.db.prepare(`
        SELECT m.id, m.title, m.description, m.genre, m.release_year AS releaseYear,
               COUNT(v.id) AS voteCount, u.username AS createdByName
        FROM movies m
        LEFT JOIN votes v ON v.movie_id = m.id
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.genre = ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `)
        : exports.db.prepare(`
        SELECT m.id, m.title, m.description, m.genre, m.release_year AS releaseYear,
               COUNT(v.id) AS voteCount, u.username AS createdByName
        FROM movies m
        LEFT JOIN votes v ON v.movie_id = m.id
        LEFT JOIN users u ON u.id = m.created_by
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `);
    return genre ? statement.all(genre) : statement.all();
}
function getMovieImage(movieId) {
    return exports.db
        .prepare("SELECT image_blob AS imageBlob, image_mime_type AS imageMimeType FROM movies WHERE id = ?")
        .get(movieId);
}
function getUserByUsername(username) {
    return exports.db
        .prepare("SELECT id, username, password_hash AS passwordHash, role FROM users WHERE username = ?")
        .get(username);
}
function createRegisteredUser(username, password) {
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const result = exports.db
        .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'registered')")
        .run(username, passwordHash);
    return {
        userId: Number(result.lastInsertRowid),
        username,
        role: "registered",
    };
}
function verifyUser(username, password) {
    const user = getUserByUsername(username);
    if (!user) {
        return undefined;
    }
    const passwordMatches = bcryptjs_1.default.compareSync(password, user.passwordHash);
    if (!passwordMatches) {
        return undefined;
    }
    return {
        userId: user.id,
        username: user.username,
        role: user.role,
    };
}
function createMovie(input) {
    exports.db.prepare(`
    INSERT INTO movies (title, description, genre, release_year, image_blob, image_mime_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.title, input.description, input.genre, input.releaseYear, input.imageBuffer, input.imageMimeType, input.createdBy);
}
function deleteMovie(movieId) {
    exports.db.prepare("DELETE FROM movies WHERE id = ?").run(movieId);
}
function addVote(movieId, voterKey) {
    const insert = exports.db.prepare("INSERT OR IGNORE INTO votes (movie_id, voter_key) VALUES (?, ?)");
    const result = insert.run(movieId, voterKey);
    const voteCountRow = exports.db.prepare("SELECT COUNT(*) AS count FROM votes WHERE movie_id = ?").get(movieId);
    return {
        added: result.changes > 0,
        voteCount: voteCountRow.count,
    };
}
function getDashboardStats() {
    const movieCountRow = exports.db.prepare("SELECT COUNT(*) AS count FROM movies").get();
    const totalVotesRow = exports.db.prepare("SELECT COUNT(*) AS count FROM votes").get();
    const topMovies = exports.db.prepare(`
    SELECT m.id, m.title, m.genre, COUNT(v.id) AS votes
    FROM movies m
    LEFT JOIN votes v ON v.movie_id = m.id
    GROUP BY m.id
    ORDER BY votes DESC, m.title ASC
    LIMIT 5
  `).all();
    return {
        movieCount: movieCountRow.count,
        totalVotes: totalVotesRow.count,
        topMovies,
    };
}
