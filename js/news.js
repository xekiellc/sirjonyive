// news.js — full news page loader
(async () => {
  const grid    = document.getElementById('newsGrid');
  const archive = document.getElementById('archiveGrid');
  const archSec = document.getElementById('archiveSection');

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatDate(str) {
    if (!str) return '';
    try {
      return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    } catch { return str; }
  }
  function cardHtml(a) {
    return `
      <a href="${a.url || '#'}" target="_blank" rel="noopener" class="news-card" style="display:block; text-decoration:none;">
        <div class="news-card-source">${escapeHtml(a.source || 'News')}</div>
        <div class="news-card-title">${escapeHtml(a.title || '')}</div>
        <div class="news-card-summary">${escapeHtml(a.summary || '')}</div>
        <div class="news-card-meta">${formatDate(a.publishedAt)}</div>
      </a>
    `;
  }

  try {
    const res = await fetch('data/news.json');
    if (!res.ok) throw new Error('No data');
    const data = await res.json();
    const articles = data.articles || [];
    const archived = data.archive || [];

    if (articles.length === 0) {
      grid.innerHTML = `
        <div class="news-empty">
          <h3>Articles are on the way.</h3>
          <p>The pipeline refreshes daily at 6am UTC. Check back soon.</p>
        </div>`;
    } else {
      grid.innerHTML = articles.map(cardHtml).join('');
    }

    if (archived.length > 0) {
      archive.innerHTML = archived.map(cardHtml).join('');
      archSec.style.display = 'block';
    }
  } catch {
    grid.innerHTML = `
      <div class="news-empty">
        <h3>Articles are on the way.</h3>
        <p>The pipeline refreshes daily at 6am UTC. Check back soon.</p>
      </div>`;
  }
})();
