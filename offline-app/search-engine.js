'use strict';

function categorizePhase(phaseId) {
  const num = parseInt(phaseId.slice(0, 2), 10);
  if (num <= 2) return 'Foundations & ML';
  if (num === 3 || num === 4 || num === 6) return 'Deep Learning & Vision';
  if (num === 5 || num === 7) return 'NLP & Transformers';
  if (num >= 8 && num <= 11) return 'LLMs & GenAI';
  if (num >= 12 && num <= 16) return 'Agents & Protocols';
  return 'Production & Capstones';
}

function buildSearchIndex(curriculum) {
  const index = [];
  curriculum.phases.forEach(phase => {
    const category = categorizePhase(phase.id);
    phase.lessons.forEach(lesson => {
      const langList = (lesson.languages || '')
        .split(/[,/ ]+/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      const searchRecord = {
        id: lesson.id,
        phaseId: lesson.phaseId,
        phaseTitle: phase.title,
        category: category,
        title: lesson.title,
        titleLower: (lesson.title || '').toLowerCase(),
        hook: lesson.hook || '',
        hookLower: (lesson.hook || '').toLowerCase(),
        type: lesson.type || 'Learn',
        languages: lesson.languages || 'Python',
        langList,
        objectives: (lesson.objectives || []).join(' ').toLowerCase(),
      };
      index.push(searchRecord);
    });
  });
  return index;
}

function search(index, query, filters = {}) {
  const q = (query || '').trim().toLowerCase();
  const selectedLang = (filters.language || 'all').toLowerCase();
  const selectedCategory = filters.category || 'all';
  const selectedType = (filters.type || 'all').toLowerCase();

  const results = [];

  for (let i = 0; i < index.length; i++) {
    const item = index[i];

    // Language filter
    if (selectedLang !== 'all' && !item.langList.includes(selectedLang)) {
      continue;
    }

    // Category / Subject filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      continue;
    }

    // Type filter (Learn, Build, Reference)
    if (selectedType !== 'all' && item.type.toLowerCase() !== selectedType) {
      continue;
    }

    // If query is empty, it passes filters with base score
    if (!q) {
      results.push({ item, score: 0 });
      continue;
    }

    let score = 0;
    const tokens = q.split(/\s+/).filter(Boolean);
    let allTokensMatched = true;

    for (const t of tokens) {
      let tokenScore = 0;
      if (item.titleLower === t) {
        tokenScore += 100;
      } else if (item.titleLower.startsWith(t)) {
        tokenScore += 60;
      } else if (item.titleLower.includes(t)) {
        tokenScore += 40;
      }

      if (item.id.toLowerCase().includes(t)) {
        tokenScore += 20;
      }

      if (item.hookLower.includes(t)) {
        tokenScore += 15;
      }

      if (item.objectives.includes(t)) {
        tokenScore += 10;
      }

      if (tokenScore === 0) {
        allTokensMatched = false;
        break;
      }
      score += tokenScore;
    }

    if (allTokensMatched && score > 0) {
      results.push({ item, score });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results.map(r => r.item);
}

function highlightMatches(text, query) {
  if (!query || !query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    categorizePhase,
    buildSearchIndex,
    search,
    highlightMatches,
  };
}
