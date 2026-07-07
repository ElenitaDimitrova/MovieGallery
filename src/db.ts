import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type UserRole = "registered";

export type SessionUser = {
  userId: number;
  username: string;
  role: UserRole;
};

export type MovieRow = {
  id: number;
  title: string;
  description: string;
  genre: string;
  releaseYear: number;
  voteCount: number;
  createdByName: string | null;
};

export type MovieDetails = MovieRow & {
  imageMimeType: string;
};

export type DashboardStats = {
  movieCount: number;
  totalVotes: number;
  topMovies: Array<{
    id: number;
    title: string;
    genre: string;
    votes: number;
  }>;
};

export type NewMovieInput = {
  title: string;
  description: string;
  genre: string;
  releaseYear: number;
  imageBuffer: Buffer;
  imageMimeType: string;
  createdBy: number;
};

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "movie-gallery.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initializeDatabase(): void {
  db.exec(`
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

function seedRegisteredUser(): void {
  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get("curator") as { id: number } | undefined;
  if (existingUser) {
    return;
  }

  const passwordHash = bcrypt.hashSync("demo1234", 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'registered')",
  ).run("curator", passwordHash);
}

function seedMovies(): void {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM movies").get() as { count: number };
  if (countRow.count > 0) {
    return;
  }

  const user = db.prepare("SELECT id FROM users WHERE username = ?").get("curator") as { id: number };

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

  const insertMovie = db.prepare(`
    INSERT INTO movies (title, description, genre, release_year, image_blob, image_mime_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVote = db.prepare("INSERT INTO votes (movie_id, voter_key) VALUES (?, ?)");

  const transaction = db.transaction(() => {
    for (const [index, movie] of seedEntries.entries()) {
      const imageBuffer = createPoster(movie.title, movie.genre, movie.color);
      const result = insertMovie.run(
        movie.title,
        movie.description,
        movie.genre,
        movie.releaseYear,
        imageBuffer,
        "image/svg+xml",
        user.id,
      );

      const movieId = Number(result.lastInsertRowid);
      for (let voteIndex = 0; voteIndex <= index; voteIndex += 1) {
        insertVote.run(movieId, `seed-voter-${index}-${voteIndex}`);
      }
    }
  });

  transaction();
}

function createPoster(title: string, genre: string, accent: string): Buffer {
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

function escapeXml(value: string): string {
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

export function listGenres(): string[] {
  const rows = db.prepare("SELECT DISTINCT genre FROM movies ORDER BY genre ASC").all() as Array<{ genre: string }>;
  return rows.map((row) => row.genre);
}

export function listMovies(genre?: string): MovieRow[] {
  const statement = genre
    ? db.prepare(`
        SELECT m.id, m.title, m.description, m.genre, m.release_year AS releaseYear,
               COUNT(v.id) AS voteCount, u.username AS createdByName
        FROM movies m
        LEFT JOIN votes v ON v.movie_id = m.id
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.genre = ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `)
    : db.prepare(`
        SELECT m.id, m.title, m.description, m.genre, m.release_year AS releaseYear,
               COUNT(v.id) AS voteCount, u.username AS createdByName
        FROM movies m
        LEFT JOIN votes v ON v.movie_id = m.id
        LEFT JOIN users u ON u.id = m.created_by
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `);

  return genre ? (statement.all(genre) as MovieRow[]) : (statement.all() as MovieRow[]);
}

export function getMovieImage(movieId: number): { imageBlob: Buffer; imageMimeType: string } | undefined {
  return db
    .prepare("SELECT image_blob AS imageBlob, image_mime_type AS imageMimeType FROM movies WHERE id = ?")
    .get(movieId) as { imageBlob: Buffer; imageMimeType: string } | undefined;
}

export function getUserByUsername(username: string): { id: number; username: string; passwordHash: string; role: UserRole } | undefined {
  return db
    .prepare("SELECT id, username, password_hash AS passwordHash, role FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; passwordHash: string; role: UserRole } | undefined;
}

export function createRegisteredUser(username: string, password: string): SessionUser {
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'registered')")
    .run(username, passwordHash);

  return {
    userId: Number(result.lastInsertRowid),
    username,
    role: "registered",
  };
}

export function verifyUser(username: string, password: string): SessionUser | undefined {
  const user = getUserByUsername(username);
  if (!user) {
    return undefined;
  }

  const passwordMatches = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordMatches) {
    return undefined;
  }

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
  };
}

export function createMovie(input: NewMovieInput): void {
  db.prepare(`
    INSERT INTO movies (title, description, genre, release_year, image_blob, image_mime_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.title,
    input.description,
    input.genre,
    input.releaseYear,
    input.imageBuffer,
    input.imageMimeType,
    input.createdBy,
  );
}

export function deleteMovie(movieId: number): void {
  db.prepare("DELETE FROM movies WHERE id = ?").run(movieId);
}

export function addVote(movieId: number, voterKey: string): { added: boolean; voteCount: number } {
  const insert = db.prepare("INSERT OR IGNORE INTO votes (movie_id, voter_key) VALUES (?, ?)");
  const result = insert.run(movieId, voterKey);
  const voteCountRow = db.prepare("SELECT COUNT(*) AS count FROM votes WHERE movie_id = ?").get(movieId) as { count: number };

  return {
    added: result.changes > 0,
    voteCount: voteCountRow.count,
  };
}

export function getDashboardStats(): DashboardStats {
  const movieCountRow = db.prepare("SELECT COUNT(*) AS count FROM movies").get() as { count: number };
  const totalVotesRow = db.prepare("SELECT COUNT(*) AS count FROM votes").get() as { count: number };
  const topMovies = db.prepare(`
    SELECT m.id, m.title, m.genre, COUNT(v.id) AS votes
    FROM movies m
    LEFT JOIN votes v ON v.movie_id = m.id
    GROUP BY m.id
    ORDER BY votes DESC, m.title ASC
    LIMIT 5
  `).all() as DashboardStats["topMovies"];

  return {
    movieCount: movieCountRow.count,
    totalVotes: totalVotesRow.count,
    topMovies,
  };
}