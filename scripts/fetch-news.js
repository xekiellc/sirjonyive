// scripts/fetch-news.js
// Daily news pipeline for sirjonyive.com
// Fetches from NewsAPI, curates with Claude, writes to data/news.json

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEWS_API_KEY      = process.env.NEWS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_PATH         = path.join(__dirname, '..', 'data', 'news.json');
const ARCHIVE_LIMIT     = 30;
const CURRENT_LIMIT     = 12;
const MIN_NEW_ARTICLES  = 3;

// ── SEARCH QUERIES ──────────────────────────────────────────
const QUERIES = [
  '"Jony Ive"',
  '"Jonathan Ive"',
  '"LoveFrom"',
  '"Jony Ive" OpenAI',
  '"Jony Ive" Apple',
  '"Sir Jony Ive"',
  '"io Products" "Jony Ive"',
];

// ── FETCH NEWS FROM NEWSAPI ──────────────────────────────────
async function fetchArticles() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const from = sevenDaysAgo.toISOString().split('T')[0];

  const seen = new Set();
  const raw  = [];

  for (const q of QUERIES) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${from}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
    try {
      const res  = await fetch(url);
      const data = await res.json();
      if (data.articles) {
        for (const a of data.articles) {
          if (!a.url || seen.has(a.url)) continue;
          if (!a.title || a.title === '[Removed]') continue;
          seen.add(a.url);
          raw.push(a);
        }
      }
    } catch (err) {
      console.warn(`Query failed: ${q}`, err.message);
    }
    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  // Sort newest first
  raw.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return raw;
}

// ── CURATE WITH CLAUDE API ───────────────────────────────────
async function curateWithClaude(articles) {
  const articleList = articles.map((a, i) => `
[${i}]
Title: ${a.title}
Source: ${a.source?.name || 'Unknown'}
Published: ${a.publishedAt}
URL: ${a.url}
Description: ${a.description || ''}
`).join('\n');

  const prompt = `You are the editorial curator for sirjonyive.com — a premium tribute site dedicated to Sir Jony Ive.

Your task: review these news articles and select the best ones about Jony Ive, LoveFrom, or OpenAI's AI hardware program. Then write polished, concise summaries for each selected article.

SELECTION CRITERIA:
- Must be directly about Jony Ive, LoveFrom, or OpenAI hardware/design
- Prefer: interviews, product news, design insights, OpenAI device updates
- Exclude: articles that only mention Ive in passing, pure opinion/rumor without substance, duplicates

For each selected article, write a 2-3 sentence summary that:
- Opens with the most newsworthy fact
- Is precise and editorial in tone — no fluff
- Reads like The New Yorker or FT, not TechCrunch

Return ONLY valid JSON, no markdown, no preamble:
{
  "selected": [
    {
      "index": <original index number>,
      "summary": "<2-3 sentence editorial summary>"
    }
  ]
}

Articles to review:
${articleList}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Claude JSON parse error:', err.message);
    console.error('Raw:', text.slice(0, 500));
    return { selected: [] };
  }
}

// ── BUILD FINAL ARTICLE OBJECTS ──────────────────────────────
function buildArticles(raw, curated) {
  return curated.selected.map(item => {
    const original = raw[item.index];
    if (!original) return null;
    return {
      title:       original.title,
      url:         original.url,
      source:      original.source?.name || 'News',
      publishedAt: original.publishedAt,
      summary:     item.summary,
      urlToImage:  original.urlToImage || null
    };
  }).filter(Boolean);
}

// ── LOAD EXISTING DATA ───────────────────────────────────────
function loadExisting() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { articles: [], archive: [] };
  }
}

// ── MERGE: deduplicate new + existing, rotate archive ────────
function mergeAndRotate(newArticles, existing) {
  const existingUrls = new Set([
    ...(existing.articles || []).map(a => a.url),
    ...(existing.archive  || []).map(a => a.url),
  ]);

  const brandNew = newArticles.filter(a => !existingUrls.has(a.url));

  if (brandNew.length < MIN_NEW_ARTICLES) {
    console.log(`Only ${brandNew.length} new articles — below threshold of ${MIN_NEW_ARTICLES}. Skipping update.`);
    return null;
  }

  const allCurrent = [...brandNew, ...(existing.articles || [])];
  const articles   = allCurrent.slice(0, CURRENT_LIMIT);
  const overflow   = allCurrent.slice(CURRENT_LIMIT);
  const archive    = [...overflow, ...(existing.archive || [])].slice(0, ARCHIVE_LIMIT);

  return { articles, archive };
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('Fetching articles from NewsAPI...');
  const raw = await fetchArticles();
  console.log(`Found ${raw.length} raw articles`);

  if (raw.length === 0) {
    console.log('No articles found. Exiting.');
    return;
  }

  console.log('Curating with Claude...');
  const curated = await curateWithClaude(raw.slice(0, 30));
  console.log(`Claude selected ${curated.selected?.length || 0} articles`);

  const newArticles = buildArticles(raw, curated);
  console.log(`Built ${newArticles.length} article objects`);

  const existing = loadExisting();
  const merged   = mergeAndRotate(newArticles, existing);

  if (!merged) return;

  const output = {
    lastUpdated: new Date().toISOString(),
    articles:    merged.articles,
    archive:     merged.archive
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`Done — ${merged.articles.length} articles + ${merged.archive.length} archived`);
}

main().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
