const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// List-query constraints
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

// Parse a query parameter that must be a positive integer.
// Returns an object: { value } when valid, { invalid: true } otherwise.
function parsePositiveInt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { value: null };
  }
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) {
    return { invalid: true };
  }
  const value = Number(str);
  if (!Number.isSafeInteger(value) || value < 1) {
    return { invalid: true };
  }
  return { value };
}

// GET /api/articles - List articles with pagination, tag filter and search
router.get('/', (req, res) => {
  const db = getDb();

  // --- Parameter validation (unified error envelope: error / code / details) ---

  const rawPage = req.query.page;
  let page = DEFAULT_PAGE;
  if (rawPage !== undefined && String(rawPage).trim() !== '') {
    const parsedPage = parsePositiveInt(rawPage);
    if (parsedPage.invalid) {
      return res.status(400).json({
        error: 'Invalid page number',
        code: 'INVALID_PAGE',
        details: { page: String(rawPage), message: '页码必须为正整数' }
      });
    }
    if (parsedPage.value !== null) {
      page = parsedPage.value;
    }
  }

  const rawLimit = req.query.limit;
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== undefined && String(rawLimit).trim() !== '') {
    const parsedLimit = parsePositiveInt(rawLimit);
    if (parsedLimit.invalid) {
      return res.status(400).json({
        error: 'Invalid limit',
        code: 'INVALID_LIMIT',
        details: { limit: String(rawLimit), message: '每页条数必须为正整数' }
      });
    }
    if (parsedLimit.value !== null) {
      limit = parsedLimit.value;
    }
  }
  if (limit > MAX_LIMIT) {
    return res.status(400).json({
      error: 'Limit out of range',
      code: 'LIMIT_OUT_OF_RANGE',
      details: { limit, max: MAX_LIMIT, message: `每页条数不能超过 ${MAX_LIMIT}` }
    });
  }

  const tag = (typeof req.query.tag === 'string' && req.query.tag.trim()) ? req.query.tag.trim() : null;

  // Search: distinguish an empty/blank term from an over-long term.
  let search = null;
  const rawSearch = req.query.search;
  if (rawSearch !== undefined && rawSearch !== null) {
    const candidate = String(rawSearch);
    if (candidate.trim() === '') {
      return res.status(400).json({
        error: 'Invalid search term',
        code: 'INVALID_SEARCH',
        details: { message: '搜索词不能为空' }
      });
    }
    if (candidate.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        error: 'Search term too long',
        code: 'SEARCH_TOO_LONG',
        details: {
          length: candidate.length,
          maxLength: MAX_SEARCH_LENGTH,
          message: `搜索词不能超过 ${MAX_SEARCH_LENGTH} 个字符`
        }
      });
    }
    search = candidate.trim();
  }

  // --- Build the shared filter so count, rows and metadata stay in sync ---

  const whereClauses = [];
  const filterParams = [];

  if (tag) {
    whereClauses.push(`',' || tags || ',' LIKE ?`);
    filterParams.push(`%,${tag},%`);
  }

  if (search) {
    whereClauses.push(`(title LIKE ? OR summary LIKE ?)`);
    const searchTerm = `%${search}%`;
    filterParams.push(searchTerm, searchTerm);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*) as total FROM articles ${whereSql}`;
  const listQuery =
    `SELECT id, title, summary, tags, created_at, updated_at FROM articles ${whereSql} ` +
    `ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  try {
    const { total } = db.prepare(countQuery).get(...filterParams);
    const totalPages = Math.ceil(total / limit) || 0;

    // Page beyond the available range is a distinct client error.
    // With no matches at all, page 1 is a valid (empty) result, so range is
    // only enforced when there is at least one page.
    if (total > 0 && page > totalPages) {
      return res.status(400).json({
        error: 'Page out of range',
        code: 'PAGE_OUT_OF_RANGE',
        details: { page, totalPages, message: `页码超出范围，共 ${totalPages} 页` }
      });
    }

    const offset = (page - 1) * limit;
    const articles = db.prepare(listQuery).all(...filterParams, limit, offset);

    const parsedArticles = articles.map(article => ({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    }));

    // Available tags come from the articles matching the current filters
    // (across every page), so metadata always matches the result set.
    const availableTagSet = new Set();
    if (total > 0) {
      const matched = db
        .prepare(`SELECT tags FROM articles ${whereSql}`)
        .all(...filterParams);
      matched.forEach(row => {
        if (row.tags) {
          row.tags.split(',').forEach(t => {
            const trimmed = t.trim();
            if (trimmed) availableTagSet.add(trimmed);
          });
        }
      });
    }
    const availableTags = Array.from(availableTagSet).sort();

    const hasNextPage = page < totalPages;
    const nextPage = hasNextPage
      ? {
          hasNext: true,
          page: page + 1,
          limit,
          remaining: total - (offset + articles.length)
        }
      : { hasNext: false, page: null, limit, remaining: 0 };

    // Human-readable summary of the current result window and filters.
    const filterDescriptors = [];
    if (tag) filterDescriptors.push(`标签「${tag}」`);
    if (search) filterDescriptors.push(`搜索「${search}」`);
    const scopeText = filterDescriptors.length > 0 ? `${filterDescriptors.join('、')}下，` : '';
    const shown = articles.length;
    let summaryText;
    if (total === 0) {
      summaryText = `${scopeText}没有找到匹配的文章`;
    } else {
      summaryText =
        `${scopeText}共 ${total} 篇文章，` +
        `当前第 ${page}/${totalPages} 页，本页显示 ${shown} 篇`;
    }

    const currentSummary = {
      text: summaryText,
      total,
      totalPages,
      page,
      limit,
      shown,
      filters: {
        tag: tag || null,
        search: search || null
      }
    };

    res.json({
      articles: parsedArticles,
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      meta: {
        availableTags,
        currentSummary,
        nextPage
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to fetch articles',
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/articles/:id - Get single article
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// POST /api/articles - Create article (requires auth)
router.post('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO articles (title, body, summary, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, body, summary || '', tagsStr, now, now);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// PUT /api/articles/:id - Update article (requires auth)
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE articles SET title = ?, body = ?, summary = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(title, body, summary || '', tagsStr, now, id);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    res.json({
      ...article,
      tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// DELETE /api/articles/:id - Delete article (requires auth)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// GET /api/tags - Get all unique tags (exported for use in server.js)
function getTags(req, res) {
  const db = getDb();

  try {
    const articles = db.prepare("SELECT tags FROM articles WHERE tags IS NOT NULL AND tags != ''").all();
    const tagSet = new Set();

    articles.forEach(article => {
      if (article.tags) {
        article.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });

    const tags = Array.from(tagSet).sort();
    res.json({ tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
}

module.exports = router;
module.exports.getTags = getTags;
