'use strict';

/**
 * Validates that the library manifest conforms to curriculum requirements.
 */
function validateVolumeManifest(manifest) {
  const errors = [];
  if (!Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be an array of volumes'] };
  }
  if (manifest.length !== 6) {
    errors.push(`Expected 6 volumes, found ${manifest.length}`);
  }

  manifest.forEach((vol, idx) => {
    if (!vol.id || typeof vol.id !== 'string') errors.push(`Volume ${idx}: missing id`);
    if (typeof vol.number !== 'number' || vol.number < 1) errors.push(`Volume ${idx}: invalid number`);
    if (!vol.title) errors.push(`Volume ${idx}: missing title`);
    if (!vol.epubFile || !vol.epubFile.endsWith('.epub')) errors.push(`Volume ${idx}: invalid epubFile`);
    if (!vol.htmlFile || !vol.htmlFile.endsWith('.html')) errors.push(`Volume ${idx}: invalid htmlFile`);
    if (typeof vol.chapterCount !== 'number' || vol.chapterCount <= 0) errors.push(`Volume ${idx}: invalid chapterCount`);
    if (typeof vol.wordCount !== 'number' || vol.wordCount <= 0) errors.push(`Volume ${idx}: invalid wordCount`);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formats statistics (chapters, word count, file size) for UI display.
 */
function formatVolumeStats(volume) {
  if (!volume) return { chapterLabel: '0 Chapters', wordLabel: '0 Words', sizeLabel: '0 KB' };

  const chapters = volume.chapterCount || 0;
  const words = volume.wordCount || 0;
  const sizeKb = volume.epubSizeKb || 0;

  const chapterLabel = `${chapters} Chapter${chapters === 1 ? '' : 's'}`;
  const wordLabel = words >= 1000 ? `${(words / 1000).toFixed(0)}k Words` : `${words} Words`;
  const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.round(sizeKb)} KB`;

  return {
    chapterLabel,
    wordLabel,
    sizeLabel,
  };
}

/**
 * Filters the list of volumes by query string (matching title, subtitle, roman numeral, or phase names).
 */
function filterVolumes(volumes, query) {
  if (!volumes || !Array.isArray(volumes)) return [];
  if (!query || !query.trim()) return [...volumes];

  const q = query.trim().toLowerCase();
  return volumes.filter(v => {
    const titleMatch = (v.title || '').toLowerCase().includes(q);
    const subtitleMatch = (v.subtitle || '').toLowerCase().includes(q);
    const romanMatch = (v.roman || '').toLowerCase() === q;
    const phaseMatch = Array.isArray(v.phases) && v.phases.some(p => p.toLowerCase().includes(q));
    return titleMatch || subtitleMatch || romanMatch || phaseMatch;
  });
}

/**
 * Returns the relative download URL for an EPUB file.
 */
function getVolumeDownloadUrl(volume) {
  if (!volume || !volume.epubFile) return '#';
  return `books/${encodeURIComponent(volume.epubFile)}`;
}

/**
 * Returns the relative download URL for a PDF file.
 */
function getVolumePdfUrl(volume) {
  if (!volume) return '#';
  if (volume.pdfFile) return `books/${encodeURIComponent(volume.pdfFile)}`;
  if (volume.epubFile) return `books/${encodeURIComponent(volume.epubFile.replace(/\.epub$/, '.pdf'))}`;
  return `books/volume-${volume.number}.pdf`;
}

/**
 * Returns the relative URL for the standalone HTML reader.
 */
function getVolumeReaderUrl(volume) {
  if (!volume || !volume.htmlFile) return '#';
  return `books/${encodeURIComponent(volume.htmlFile)}`;
}

/**
 * Generates an HTML card for a book volume in the library grid.
 */
function renderVolumeCardHtml(volume) {
  const stats = formatVolumeStats(volume);
  const downloadUrl = getVolumeDownloadUrl(volume);
  const readerUrl = getVolumeReaderUrl(volume);
  const pdfUrl = getVolumePdfUrl(volume);
  const pdfFile = volume.pdfFile || (volume.epubFile ? volume.epubFile.replace(/\.epub$/, '.pdf') : `volume-${volume.number}.pdf`);
  const phasesText = (volume.phases || []).join(' · ');

  return `
    <div class="library-card" data-volume-id="${volume.id}" data-volume-num="${volume.number}">
      <div class="card-cover-bar">
        <span class="card-vol-badge">VOLUME ${volume.roman || volume.number}</span>
        <span class="card-size-badge">${stats.sizeLabel}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${volume.title}</h3>
        <p class="card-subtitle">${volume.subtitle || ''}</p>
        <div class="card-meta">
          <span>📚 ${stats.chapterLabel}</span>
          <span>✍️ ${stats.wordLabel}</span>
        </div>
        <div class="card-phases" title="${phasesText}">${phasesText}</div>
      </div>
      <div class="card-actions">
        <button class="lib-action-btn primary read-vol-btn" data-url="${readerUrl}" data-vol="${volume.number}">
          📖 Read Volume
        </button>
        <a class="lib-action-btn download-vol-btn epub-btn" href="${downloadUrl}" download="${volume.epubFile}" data-file="${volume.epubFile}" data-url="${downloadUrl}" data-type="epub" title="Download EPUB copy locally">
          📥 EPUB
        </a>
        <a class="lib-action-btn download-vol-btn pdf-btn" href="${pdfUrl}" download="${pdfFile}" data-file="${pdfFile}" data-url="${pdfUrl}" data-type="pdf" title="Download PDF copy locally">
          📄 PDF
        </a>
      </div>
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateVolumeManifest,
    formatVolumeStats,
    filterVolumes,
    getVolumeDownloadUrl,
    getVolumePdfUrl,
    getVolumeReaderUrl,
    renderVolumeCardHtml,
  };
}
