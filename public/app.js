async function handleVoteSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches(".vote-form")) {
    return;
  }

  event.preventDefault();

  const response = await fetch(form.action, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "fetch",
    },
  });

  const payload = await response.json();
  const target = document.querySelector(`[data-vote-count="${form.dataset.movieId}"]`);
  if (target) {
    target.textContent = `${payload.voteCount} vote${payload.voteCount === 1 ? "" : "s"}`;
  }

  const button = form.querySelector("button");
  if (button instanceof HTMLButtonElement) {
    button.textContent = payload.added ? "Voted" : "Already voted";
    button.disabled = !payload.added;
  }
}

function handlePosterToggle(event) {
  const toggle = event.target instanceof Element
    ? event.target.closest("[data-description-toggle]")
    : null;

  if (!(toggle instanceof HTMLButtonElement)) {
    return;
  }

  const card = toggle.closest(".movie-card");
  const panel = card ? card.querySelector("[data-description-panel]") : null;
  if (!(panel instanceof HTMLElement)) {
    return;
  }

  const isExpanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
  panel.hidden = isExpanded;
}

async function refreshDashboard() {
  const root = document.querySelector("[data-dashboard-root]");
  if (!root) {
    return;
  }

  const response = await fetch("/api/dashboard-stats", {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();
  updateText('[data-stat="movieCount"]', String(payload.movieCount));
  updateText('[data-stat="totalVotes"]', String(payload.totalVotes));
  updateText('[data-stat="topMovieTitle"]', payload.topMovies[0] ? payload.topMovies[0].title : "No movies yet");

  const list = document.querySelector("[data-top-movies]");
  if (list) {
    list.innerHTML = payload.topMovies
      .map(
        (movie, index) => `<li><span>${index + 1}. ${escapeHtml(movie.title)}</span><strong>${movie.votes} vote${movie.votes === 1 ? "" : "s"}</strong></li>`,
      )
      .join("");
  }
}

function updateText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
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

document.addEventListener("submit", (event) => {
  void handleVoteSubmit(event);
});

document.addEventListener("click", (event) => {
  handlePosterToggle(event);
});

if (document.body.dataset.page === "dashboard") {
  void refreshDashboard();
  window.setInterval(() => {
    void refreshDashboard();
  }, 10000);
}