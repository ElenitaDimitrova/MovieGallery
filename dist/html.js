"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderLayout = renderLayout;
exports.renderGallery = renderGallery;
exports.renderDashboard = renderDashboard;
exports.renderAuthPage = renderAuthPage;
exports.renderManagePage = renderManagePage;
exports.escapeHtml = escapeHtml;
function renderLayout(options) {
    const userLabel = options.auth
        ? `<div class="user-pill">Signed in as <strong>${escapeHtml(options.auth.username)}</strong></div>`
        : `<div class="user-pill">Browsing as guest</div>`;
    const authActions = options.auth
        ? `
        <form method="post" action="/logout">
          <button class="ghost-button" type="submit">Log out</button>
        </form>
      `
        : `<a class="ghost-button" href="/auth">Login / Register</a>`;
    const flash = options.flash
        ? `<div class="flash ${options.flash.type}">${escapeHtml(options.flash.message)}</div>`
        : "";
    return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(options.title)} | Movie Gallery</title>
      <link rel="stylesheet" href="/styles.css" />
      <script defer src="/app.js"></script>
    </head>
    <body data-page="${options.currentPath.slice(1)}">
      <div class="page-shell">
        <header class="hero">
          <div>
            <p class="eyebrow">Movie Gallery</p>
            <h1>All Time Top 10</h1>
            <p class="hero-copy">A minimal proof of concept with role-based access, SQLite-backed media records, and live vote statistics.</p>
          </div>
          <div class="hero-side">
            ${userLabel}
            ${authActions}
          </div>
        </header>
        <nav class="main-nav">
          ${navLink("/gallery", "Gallery", options.currentPath)}
          ${navLink("/dashboard", "Dashboard", options.currentPath)}
          ${navLink("/manage", "Manage", options.currentPath)}
          ${navLink("/auth", "Auth", options.currentPath)}
        </nav>
        ${flash}
        ${options.body}
      </div>
    </body>
  </html>`;
}
function navLink(href, label, currentPath) {
    const active = href === currentPath ? "active" : "";
    return `<a class="nav-link ${active}" href="${href}">${label}</a>`;
}
function renderGallery(options) {
    const filters = ["All", ...options.genres]
        .map((genre) => {
        const isActive = genre === "All"
            ? !options.selectedGenre
            : options.selectedGenre === genre;
        const href = genre === "All" ? "/gallery" : `/gallery?genre=${encodeURIComponent(genre)}`;
        return `<a class="chip ${isActive ? "active" : ""}" href="${href}">${escapeHtml(genre)}</a>`;
    })
        .join("");
    const cards = options.movies
        .map((movie) => {
        const deleteForm = options.auth
            ? `
          <form method="post" action="/movies/${movie.id}/delete" onsubmit="return confirm('Delete this movie?');">
            <button class="danger-button" type="submit">Delete</button>
          </form>
        `
            : "";
        return `
        <article class="movie-card">
          <button
            class="poster-button"
            type="button"
            data-description-toggle
            aria-expanded="false"
            aria-controls="movie-description-${movie.id}"
          >
            <img src="/images/${movie.id}" alt="${escapeHtml(movie.title)} poster" />
          </button>
          <div class="movie-meta">
            <div class="movie-topline">
              <span class="genre-badge">${escapeHtml(movie.genre)}</span>
              <span>${movie.releaseYear}</span>
            </div>
            <h2>${escapeHtml(movie.title)}</h2>
            <div
              class="movie-description"
              id="movie-description-${movie.id}"
              data-description-panel
              hidden
            >
              <p>${escapeHtml(movie.description)}</p>
            </div>
            <div class="movie-footer">
              <span class="vote-count" data-vote-count="${movie.id}">${movie.voteCount} vote${movie.voteCount === 1 ? "" : "s"}</span>
              <span>${movie.createdByName ? `by ${escapeHtml(movie.createdByName)}` : "community upload"}</span>
            </div>
            <div class="card-actions">
              <form class="vote-form" method="post" action="/movies/${movie.id}/vote" data-movie-id="${movie.id}">
                <button class="primary-button" type="submit">Vote</button>
              </form>
              ${deleteForm}
            </div>
          </div>
        </article>
      `;
    })
        .join("");
    return `
    <section class="panel stack-gap">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Catalogue</p>
        </div>
        <p class="section-copy">Guests can browse and vote. Click a movie poster to reveal its description.</p>
      </div>
      <div class="chip-row">${filters}</div>
      <div class="movie-grid">${cards}</div>
    </section>
  `;
}
function renderDashboard(stats) {
    const topRows = stats.topMovies
        .map((movie, index) => `
      <li>
        <span>${index + 1}. ${escapeHtml(movie.title)}</span>
        <strong>${movie.votes} vote${movie.votes === 1 ? "" : "s"}</strong>
      </li>
    `)
        .join("");
    return `
    <section class="dashboard-grid" data-dashboard-root>
      <article class="stat-card">
        <p>Total movies</p>
        <strong data-stat="movieCount">${stats.movieCount}</strong>
      </article>
      <article class="stat-card">
        <p>Total votes</p>
        <strong data-stat="totalVotes">${stats.totalVotes}</strong>
      </article>
      <article class="stat-card highlight">
        <p>Top movie</p>
        <strong data-stat="topMovieTitle">${stats.topMovies[0] ? escapeHtml(stats.topMovies[0].title) : "No movies yet"}</strong>
      </article>
      <article class="panel top-list-panel">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">Live ranking</p>
            <h2>Top voted movies</h2>
          </div>
          <p class="section-copy">This list refreshes automatically.</p>
        </div>
        <ol class="top-list" data-top-movies>${topRows}</ol>
      </article>
    </section>
  `;
}
function renderAuthPage() {
    return `
    <section class="auth-grid">
      <article class="panel">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">Registered user</p>
            <h2>Log in</h2>
          </div>
          <p class="section-copy">Demo account: curator / demo1234</p>
        </div>
        <form class="stack-form" method="post" action="/login">
          <label>
            Username
            <input name="username" type="text" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button class="primary-button" type="submit">Log in</button>
        </form>
      </article>
      <article class="panel">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">New curator</p>
            <h2>Register</h2>
          </div>
          <p class="section-copy">Registration creates a registered-user account with management privileges.</p>
        </div>
        <form class="stack-form" method="post" action="/register">
          <label>
            Username
            <input name="username" type="text" minlength="3" maxlength="32" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minlength="6" required />
          </label>
          <button class="primary-button" type="submit">Create account</button>
        </form>
      </article>
    </section>
  `;
}
function renderManagePage(auth) {
    if (!auth) {
        return `
      <section class="panel empty-state">
        <p class="section-kicker">Restricted area</p>
        <h2>Management requires a registered-user session.</h2>
        <p>Use the demo account or register a new one to add movies to the gallery.</p>
        <a class="primary-button inline-link" href="/auth">Open auth page</a>
      </section>
    `;
    }
    return `
    <section class="panel manage-panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Movie management</p>
          <h2>Add a new movie</h2>
        </div>
        <p class="section-copy">Images are stored directly in SQLite as BLOB data for this PoC.</p>
      </div>
      <form class="stack-form" method="post" action="/movies" enctype="multipart/form-data">
        <label>
          Title
          <input name="title" type="text" maxlength="120" required />
        </label>
        <label>
          Genre
          <input name="genre" type="text" maxlength="40" placeholder="Action, Drama, Animation" required />
        </label>
        <label>
          Release year
          <input name="releaseYear" type="number" min="1888" max="2100" required />
        </label>
        <label>
          Description
          <textarea name="description" rows="4" maxlength="500" required></textarea>
        </label>
        <label>
          Poster image
          <input name="poster" type="file" accept="image/*" required />
        </label>
        <button class="primary-button" type="submit">Save movie</button>
      </form>
    </section>
  `;
}
function escapeHtml(value) {
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
