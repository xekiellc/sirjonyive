// news-preview.js — loads 3 latest articles on homepage
(async () => {
  const container = document.getElementById('newsPreview');
  if (!container) return;

  try {
    const res = await fetch('data/news.json');
    if (!res.ok) throw new Error('No data');
    const data = await res.json();
    const articles = (data.articles || []).slice(0, 3);

    if (articles.length === 0) {
      container.innerHTML = '<div class="news-loading">No articles yet. Check back soon.</div>';
      return;
    }

    container.innerHTML = articles.map(a => `
      <a href="${a.url || '#'}" target="_blank" rel="noopener" class="news-card" style="display:block; text-decoration:none;">
        <div class="news-card-source">${escapeHtml(a.source || 'News')}</div>
        <div class="news-card-title">${escapeHtml(a.title || '')}</div>
        <div class="news-card-summary">${escapeHtml(a.summary || '')}</div>
        <div class="news-card-meta">${formatDate(a.publishedAt)}</div>
      </a>
    `).join('');
  } catch {
    container.innerHTML = '<div class="news-loading">Articles loading soon.</div>';
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatDate(str) {
    if (!str) return '';
    try {
      return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    } catch { return str; }
  }
})();
