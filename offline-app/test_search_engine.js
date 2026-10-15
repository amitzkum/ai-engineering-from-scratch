'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSearchIndex, search, highlightMatches, categorizePhase } = require('./search-engine');

const CURRICULUM_PATH = path.join(__dirname, 'dist', 'data', 'curriculum.json');

test('search index builds all 542 lessons with language and category tags', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const index = buildSearchIndex(curriculum);

  assert.equal(index.length, 542, 'Search index must contain all 542 lessons');
  
  // Verify sample item shape
  const item = index[0];
  assert.ok(item.id, 'Record must have id');
  assert.ok(item.title, 'Record must have title');
  assert.ok(item.category, 'Record must have category');
  assert.ok(Array.isArray(item.langList), 'Record must have langList array');
});

test('phase categorization maps all phases into coherent curriculum categories', () => {
  assert.equal(categorizePhase('01-math-foundations'), 'Foundations & ML');
  assert.equal(categorizePhase('03-deep-learning-core'), 'Deep Learning & Vision');
  assert.equal(categorizePhase('07-transformers-deep-dive'), 'NLP & Transformers');
  assert.equal(categorizePhase('10-llms-from-scratch'), 'LLMs & GenAI');
  assert.equal(categorizePhase('14-agent-engineering'), 'Agents & Protocols');
  assert.equal(categorizePhase('17-infrastructure-and-production'), 'Production & Capstones');
});

test('keyword search finds core curriculum concepts accurately', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const index = buildSearchIndex(curriculum);

  // Search "attention"
  const attentionResults = search(index, 'attention');
  assert.ok(attentionResults.length >= 5, 'Must find multiple attention lessons');
  assert.ok(
    attentionResults.some(r => r.title.toLowerCase().includes('attention')),
    'Results must include attention lessons'
  );

  // Search "backpropagation"
  const backpropResults = search(index, 'backpropagation');
  assert.ok(backpropResults.length >= 1, 'Must find backprop lesson');
  assert.ok(backpropResults[0].title.toLowerCase().includes('backpropagation'));

  // Search "mcp"
  const mcpResults = search(index, 'mcp');
  assert.ok(mcpResults.length >= 1, 'Must find MCP lessons');
});

test('multi-filter search narrows results by language and category', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const index = buildSearchIndex(curriculum);

  // Filter only TypeScript in Agents & Protocols
  const tsAgents = search(index, '', {
    language: 'typescript',
    category: 'Agents & Protocols',
  });

  assert.ok(tsAgents.length > 0, 'Must find TypeScript agent lessons');
  for (const item of tsAgents) {
    assert.equal(item.category, 'Agents & Protocols');
    assert.ok(item.langList.includes('typescript'));
  }

  // Filter Build type in Foundations & ML
  const buildFoundations = search(index, '', {
    category: 'Foundations & ML',
    type: 'build',
  });

  assert.ok(buildFoundations.length > 0, 'Must find build lessons in foundations');
  for (const item of buildFoundations) {
    assert.equal(item.category, 'Foundations & ML');
    assert.equal(item.type.toLowerCase(), 'build');
  }
});

test('search ranking ranks exact title matches above body/hook matches', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const index = buildSearchIndex(curriculum);

  const results = search(index, 'linear algebra');
  assert.ok(results.length >= 1);
  assert.ok(
    results[0].title.toLowerCase().includes('linear algebra'),
    'Top result must have Linear Algebra in title'
  );
});

test('search latency benchmark executes under 16ms (60 FPS touch frame budget)', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const index = buildSearchIndex(curriculum);

  const queries = ['attention', 'transformer', 'matrix', 'tensor', 'lora', 'agent', 'rag', 'tokenizer', 'mcp', 'cuda'];

  const start = performance.now();
  for (let round = 0; round < 10; round++) {
    for (const q of queries) {
      search(index, q);
    }
  }
  const elapsed = performance.now() - start;
  const avgPerQuery = elapsed / 100;

  assert.ok(
    avgPerQuery < 5.0,
    `Search must take < 5ms per query for 60 FPS touch response, actual: ${avgPerQuery.toFixed(3)}ms`
  );
});

test('highlightMatches wraps search terms in <mark> tags', () => {
  const text = 'Implement Multi-Head Attention from scratch';
  const highlighted = highlightMatches(text, 'Attention');
  assert.equal(highlighted, 'Implement Multi-Head <mark>Attention</mark> from scratch');
});
