# Blog Platform

A lightweight personal blog platform built with Vue 3 + Vite (frontend) and Node.js + Express (backend).

## Tech Stack

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **Vite** - Next generation frontend tooling
- **Vue Router** - Official router for Vue.js
- **Pinia** - State management library
- **Element Plus** - Vue 3 UI component library
- **Axios** - HTTP client
- **Marked** - Markdown parser

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **better-sqlite3** - Fast SQLite3 library
- **jsonwebtoken** - JWT implementation
- **cors** - Cross-Origin Resource Sharing

## Project Structure

```
blog-platform/
├── frontend/          # Vue 3 + Vite frontend
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/# Reusable components
│   │   ├── router/    # Vue Router configuration
│   │   ├── stores/    # Pinia stores
│   │   └── views/     # Page components
│   └── ...
├── backend/           # Node.js + Express backend
│   ├── db/            # Database initialization and seeds
│   ├── routes/        # API routes
│   ├── middleware/    # Express middleware
│   └── data/          # SQLite database file
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone or navigate to the project directory**

```bash
cd blog-platform
```

2. **Install backend dependencies**

```bash
cd backend
npm install
```

3. **Install frontend dependencies**

```bash
cd ../frontend
npm install
```

4. **Initialize the database with seed data**

```bash
cd ../backend
npm run seed
```

### Running the Application

1. **Start the backend server (port 3001)**

```bash
cd backend
npm run dev
```

The API server will start at `http://localhost:3001`

2. **Start the frontend development server (port 5173)**

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Features

- **Article Management**: Create, read, update, and delete blog articles
- **Markdown Support**: Write articles in Markdown with live preview
- **Tag System**: Organize articles with tags and filter by tags
- **Pagination**: Navigate through articles with pagination (10 per page)
- **Admin Panel**: Protected admin area for managing articles
- **JWT Authentication**: Secure admin login with JSON Web Tokens

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Admin login | No |
| GET | `/api/articles` | List articles (with pagination, tag filter and search) | No |
| GET | `/api/articles/:id` | Get single article | No |
| POST | `/api/articles` | Create new article | Yes |
| PUT | `/api/articles/:id` | Update article | Yes |
| DELETE | `/api/articles/:id` | Delete article | Yes |
| GET | `/api/tags` | Get all unique tags | No |

### Article list response

`GET /api/articles` accepts `page`, `limit`, `tag` and `search` query
parameters and always responds with the same envelope:

```json
{
  "articles": [ ... ],
  "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 },
  "meta": {
    "status": "ok",
    "reason": null,
    "availableTags": ["CSS", "前端", "..."],
    "summary": {
      "total": 15,
      "returned": 10,
      "page": 1,
      "totalPages": 2,
      "from": 1,
      "to": 10,
      "filters": { "tag": null, "search": null },
      "text": "Showing 1-10 of 15 articles"
    },
    "nextPage": { "hasNextPage": true, "page": 2 }
  }
}
```

- `meta.availableTags` — unique tags of the articles matching the current
  filters (computed from the same query, so it always reflects the latest
  content; identical to `GET /api/tags` when no filter is applied).
- `meta.summary` — counts, item range and active filters for the current page.
- `meta.nextPage` — whether another page exists and which page to request.

`meta.status` / `meta.reason` distinguish the result conditions, and rejected
queries keep the same envelope (plus an `error` message):

| Condition | HTTP | `meta.status` | `meta.reason` |
|-----------|------|---------------|----------------|
| Articles returned | 200 | `ok` | `null` |
| No matching articles | 200 | `empty` | `no_results` |
| Page invalid (non-numeric/`< 1`) or beyond the last page | 400 | `error` | `page_out_of_range` |
| Search term longer than 100 characters | 400 | `error` | `search_too_long` |

## Admin Credentials

- **Username**: admin
- **Password**: admin123

## Configuration

### Backend

- Server port: `3001` (configurable via `PORT` environment variable)
- JWT secret: `blog-platform-secret-key` (hardcoded in middleware/auth.js)
- Database file: `backend/data/blog.db`

### Frontend

- Dev server port: `5173`
- API proxy: `/api` requests are proxied to `http://localhost:3001`

## Build for Production

### Backend

The backend runs directly with Node.js:

```bash
cd backend
npm start
```

### Frontend

Build the frontend for production:

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## License

MIT
