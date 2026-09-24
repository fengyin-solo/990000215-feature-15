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
| GET | `/api/articles` | List articles (with pagination and tag filter) | No |
| GET | `/api/articles/:id` | Get single article | No |
| POST | `/api/articles` | Create new article | Yes |
| PUT | `/api/articles/:id` | Update article | Yes |
| DELETE | `/api/articles/:id` | Delete article | Yes |
| GET | `/api/tags` | Get all unique tags | No |

### List endpoint response

`GET /api/articles` supports `page` (default 1), `limit` (default 10, max 100),
`tag` and `search` (max 100 characters). The response keeps `articles` and
`pagination` and adds a `meta` block describing the current result set:

```json
{
  "articles": [ /* { id, title, summary, tags: string[], created_at, updated_at } */ ],
  "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 },
  "meta": {
    "availableTags": ["JavaScript", "Vue", "前端"],
    "currentSummary": {
      "text": "共 15 篇文章，当前第 1/2 页，本页显示 10 篇",
      "total": 15,
      "totalPages": 2,
      "page": 1,
      "limit": 10,
      "shown": 10,
      "filters": { "tag": null, "search": null }
    },
    "nextPage": { "hasNext": true, "page": 2, "limit": 10, "remaining": 5 }
  }
}
```

- `availableTags`: tags that occur in the articles matching the current
  filters (across all pages), so metadata always matches the listed content.
- `currentSummary`: a human-readable summary plus structured counts.
- `nextPage`: next-page hint; `hasNext` is `false` (and `page` is `null`) on
  the last page. An empty match still returns HTTP 200 with empty `articles`.

Validation / range failures use a unified error envelope
`{ error, code, details }` with a distinct `code` per condition:

| Condition | HTTP | code |
|-----------|------|------|
| `page` is not a positive integer | 400 | `INVALID_PAGE` |
| `limit` is not a positive integer | 400 | `INVALID_LIMIT` |
| `limit` > 100 | 400 | `LIMIT_OUT_OF_RANGE` |
| `search` is empty / whitespace-only | 400 | `INVALID_SEARCH` |
| `search` longer than 100 characters | 400 | `SEARCH_TOO_LONG` |
| `page` beyond the available pages | 400 | `PAGE_OUT_OF_RANGE` |

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
