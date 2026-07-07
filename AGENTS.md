# Movie Gallery

## Vision

Movie Gallery is a local-first collaborative web application for sharing, browsing, and ranking movies inside a small community. The product should feel simple and immediate for guests, while giving registered users enough control to curate and maintain the catalogue.

The application is not a general-purpose streaming platform. It is a lightweight local gallery focused on discovery, contribution, and community voting. Every major implementation decision should support three outcomes:

- fast browsing of a visual movie catalogue
- low-friction contribution and voting
- clear separation between curation privileges and guest participation

## Product Goals

- Provide a responsive local web experience built with Node.js, TypeScript, SQLite, HTML, CSS, and client-side JavaScript.
- Support two user roles with clear behavior boundaries: Registered User and Guest.
- Allow registered users to upload, manage, and delete movie entries.
- Allow guests to browse the gallery, inspect movie details, and vote on movies.
- Present movies in a grid-based catalogue with filtering by genre or category.
- Surface live or near-real-time statistics such as total movie count, vote totals, and top-ranked movies.
- Store movie poster or cover images directly in SQLite using BLOB fields.
- Use secure server-side session management rather than client-trusted authentication state.

## User Roles

### Registered User

- Can register and authenticate.
- Can browse the full catalogue.
- Can upload new movies with metadata and image.
- Can edit or delete movies they are permitted to manage.
- Can participate in voting unless a later business rule restricts duplicate voting.

### Guest

- Can access the gallery without full management privileges.
- Can browse and filter movies.
- Can view movie details and current vote counts.
- Can vote for movies.
- Cannot create, edit, or delete movie records.

## Core Experience

The application should expose three primary user-facing areas:

### 1. Gallery

- Grid layout of all movies.
- Poster image, title, genre, and vote summary visible at a glance.
- Filtering by genre such as Action, Drama, Animation, and other defined categories.
- Responsive behavior for desktop and mobile widths.

### 2. Movie Management

- Restricted to registered users.
- Form-driven creation and editing of movie entries.
- Upload flow for image data stored as SQLite BLOB.
- Safe deletion workflow with confirmation.

### 3. Statistics Dashboard

- Displays total number of movies.
- Displays votes per movie.
- Highlights top-voted movies.
- Should be implemented so data remains current without forcing full page reloads when practical.

## Architecture Direction

### Application Style

Use a server-rendered or server-driven Node.js web application with TypeScript on the backend and plain HTML, CSS, and JavaScript on the frontend. The system should prioritize maintainability and predictable behavior over framework-heavy complexity.

Recommended baseline:

- Node.js HTTP server implemented with TypeScript
- SQLite as the primary persistent data store
- Server-rendered HTML templates or simple route-based page rendering
- Progressive enhancement with client-side JavaScript for voting, filtering, and dashboard refreshes
- CSS organized around responsive layout primitives and reusable components

### Logical Layers

Keep the codebase separated into these responsibilities:

#### Presentation Layer

- Route handlers
- HTML rendering templates or view builders
- Static assets: CSS, browser JavaScript, images/icons

#### Application Layer

- Authentication workflows
- Authorization checks by role
- Movie management use cases
- Voting workflows
- Dashboard/statistics aggregation

#### Data Layer

- SQLite access module
- Repository functions for users, movies, votes, and sessions
- Query logic isolated from route handlers

This separation matters. Route handlers should orchestrate requests and responses, but they should not contain raw SQL or authorization rules inline unless the case is trivial.

## Suggested Module Boundaries

The implementation should evolve around a small number of focused modules:

- `auth`: registration, login, password verification, logout, role checks
- `sessions`: secure session creation, lookup, expiration, invalidation
- `movies`: CRUD operations, image handling, validation, filtering
- `votes`: vote submission, duplicate-vote rules, vote aggregation
- `dashboard`: statistics queries and top-movie summaries
- `db`: database connection management, migrations, repository helpers
- `web`: routes, middleware, templates, static delivery

## Data Model Direction

The schema should remain small and explicit.

### Users

- id
- username or email
- password_hash
- role
- created_at

### Movies

- id
- title
- description
- genre
- release_year
- image_blob
- image_mime_type
- created_by
- created_at
- updated_at

### Votes

- id
- movie_id
- voter_identity or user_id depending on final guest-voting rules
- created_at

### Sessions

- id or session_id
- user_id or guest identity data
- expires_at
- created_at
- last_seen_at

If guest voting is anonymous, define a practical identity strategy early. Examples include session-based guest voting or browser-session-limited guest voting. The rule must be explicit to avoid inconsistent vote behavior.

## Authentication And Session Strategy

- Passwords must be stored as secure hashes, never plain text.
- Sessions must be server-side, with the browser holding only an opaque session identifier.
- Authorization must be enforced on the server for every create, update, and delete operation.
- Guest access should default to least privilege.
- Session expiration and logout should invalidate access predictably.

## Image Storage Strategy

Movie images should be stored in SQLite as BLOB data together with MIME type metadata. The application should serve those images through dedicated backend endpoints rather than exposing raw database access.

This approach is acceptable because the project is local and relatively small. If image volume grows substantially, the architecture should allow later migration to file-based storage without changing the user-facing model.

## UI Principles

- Keep navigation simple: Gallery, Dashboard, Login/Register, and Management actions for authorized users.
- Prefer readable layouts over dense controls.
- Ensure catalogue cards work well on smaller screens.
- Make voting status and top-movie information visually obvious.
- Treat filtering as a first-class interaction, not an afterthought.

## Non-Functional Goals

- Maintain a small, understandable codebase.
- Favor predictable database queries and explicit server logic.
- Keep security-sensitive decisions on the server.
- Make the app easy to run locally with minimal setup.
- Keep dependencies modest unless a library clearly reduces risk or complexity.

## Delivery Priorities

Build in this order unless requirements change:

1. Project skeleton, database schema, and server bootstrap.
2. Registration, authentication, and secure session handling.
3. Movie catalogue browsing and filtering.
4. Registered-user movie creation, editing, and deletion.
5. Guest and registered-user voting workflow.
6. Statistics dashboard and top-movie summaries.
7. Responsive polish and usability refinement.

## Guardrails For Future Agents

- Do not introduce unnecessary frontend frameworks unless requirements materially change.
- Do not move authorization decisions into client-side JavaScript.
- Do not store passwords, roles, or trust-sensitive state in the browser.
- Do not let route handlers become the home of direct SQL and business rules together.
- Keep schema, backend logic, and UI language aligned with the two-role model defined above.

## Definition Of Success

Movie Gallery succeeds if a local user can launch the app, register an account, add movies with poster images, browse the catalogue in a clean responsive grid, filter by genre, vote on entries as a guest or registered participant, and inspect current ranking statistics through a clear dashboard without security boundaries being ambiguous.