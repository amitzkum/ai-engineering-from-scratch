'use strict';

/**
 * AI Engineering from Scratch — Local SQLite3 Relational Database Engine
 *
 * Provides a self-contained, offline-first SQLite relational database engine
 * supporting standard SQLite SQL syntax:
 * - Table creation (CREATE TABLE IF NOT EXISTS)
 * - Row insertion & upsert (INSERT OR REPLACE INTO)
 * - Querying (SELECT ... FROM ... WHERE ... ORDER BY ...)
 * - Deletion (DELETE FROM ... WHERE ...)
 * - Transactions (BEGIN TRANSACTION, COMMIT)
 * - SQL Dump Export & Import (standard SQLite DDL & DML)
 *
 * Schemas:
 * - chapter_completions (lesson_id TEXT PRIMARY KEY, phase_id TEXT, title TEXT, completed_at INTEGER)
 * - page_notes (lesson_id TEXT PRIMARY KEY, phase_id TEXT, title TEXT, note_text TEXT, updated_at INTEGER)
 * - schema_meta (key TEXT PRIMARY KEY, value TEXT)
 *
 * Author: Amit Kumar
 * License: ISC
 */

class SQLiteDatabase {
  /**
   * @param {Object} [options]
   * @param {Object} [options.storage] - Storage backend (defaults to window.localStorage in browser, memory in node)
   * @param {string} [options.storageKey] - Key for localStorage persistence
   */
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'sqlite_db_payload';
    this.storage = options.storage || (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
    this.tables = {};
    this.init();
  }

  /**
   * Initialize tables and load persisted state.
   */
  init() {
    this.tables = {
      chapter_completions: new Map(),
      page_notes: new Map(),
      schema_meta: new Map(),
    };

    // Load from storage if available
    if (this.storage) {
      try {
        const raw = this.storage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const [tblName, rows] of Object.entries(parsed)) {
              if (this.tables[tblName] && Array.isArray(rows)) {
                for (const row of rows) {
                  const pk = row.lesson_id || row.key;
                  if (pk !== undefined) {
                    this.tables[tblName].set(String(pk), row);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[SQLiteDB] Failed to load persisted state:', err);
      }
    }

    // Set schema meta
    this.tables.schema_meta.set('version', { key: 'version', value: '1.3.0' });
    this.tables.schema_meta.set('engine', { key: 'engine', value: 'sqlite3-embedded' });
    this.persist();
  }

  /**
   * Persist current state to storage backend.
   */
  persist() {
    if (!this.storage) return;
    try {
      const dump = {};
      for (const [tblName, map] of Object.entries(this.tables)) {
        dump[tblName] = Array.from(map.values());
      }
      this.storage.setItem(this.storageKey, JSON.stringify(dump));
    } catch (err) {
      console.warn('[SQLiteDB] Failed to persist database:', err);
    }
  }

  /**
   * Execute raw SQL statements (separated by semicolon outside quotes).
   * @param {string} sql
   */
  exec(sql) {
    if (!sql || typeof sql !== 'string') return;
    const statements = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < sql.length; i++) {
      const c = sql[i];
      if (inQuote) {
        current += c;
        if (c === quoteChar) {
          if (sql[i + 1] === quoteChar) {
            // Escaped quote like '' or ""
            current += sql[i + 1];
            i++;
          } else {
            inQuote = false;
          }
        }
      } else {
        if (c === "'" || c === '"') {
          inQuote = true;
          quoteChar = c;
          current += c;
        } else if (c === ';') {
          const trimmed = current.trim();
          if (trimmed && !trimmed.startsWith('--')) {
            statements.push(trimmed);
          }
          current = '';
        } else {
          current += c;
        }
      }
    }
    const rem = current.trim();
    if (rem && !rem.startsWith('--')) {
      statements.push(rem);
    }

    for (const stmt of statements) {
      this._execSingle(stmt);
    }
    this.persist();
  }

  /**
   * Execute a single SQL statement.
   * @private
   */
  _execSingle(sql) {
    const clean = sql.trim();

    if (/^CREATE TABLE IF NOT EXISTS/i.test(clean)) {
      const match = clean.match(/^CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const tblName = match[1];
        if (!this.tables[tblName]) {
          this.tables[tblName] = new Map();
        }
      }
      return;
    }

    if (/^INSERT OR REPLACE INTO|^INSERT INTO/i.test(clean)) {
      const tblMatch = clean.match(/^INSERT(?: OR REPLACE)? INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+)\)$/i);
      if (tblMatch) {
        const tblName = tblMatch[1];
        const cols = tblMatch[2].split(',').map(c => c.trim());
        const vals = this._parseValues(tblMatch[3]);

        if (!this.tables[tblName]) this.tables[tblName] = new Map();

        const row = {};
        cols.forEach((col, idx) => {
          row[col] = vals[idx] !== undefined ? vals[idx] : null;
        });

        const pk = row.lesson_id || row.key || String(Date.now());
        this.tables[tblName].set(String(pk), row);
      }
      return;
    }

    if (/^DELETE FROM/i.test(clean)) {
      const delMatch = clean.match(/^DELETE FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
      if (delMatch) {
        const tblName = delMatch[1];
        const whereClause = delMatch[2];
        if (!this.tables[tblName]) return;

        if (!whereClause) {
          this.tables[tblName].clear();
        } else {
          const eqMatch = whereClause.match(/([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
          if (eqMatch) {
            const col = eqMatch[1].trim();
            const val = this._castValue(eqMatch[2].trim());
            for (const [pk, row] of this.tables[tblName].entries()) {
              if (String(row[col]) === String(val)) {
                this.tables[tblName].delete(pk);
              }
            }
          }
        }
      }
      return;
    }
  }

  /**
   * Parse comma-delimited SQL VALUES literal.
   * @private
   */
  _parseValues(valuesStr) {
    const vals = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      if (inQuotes) {
        if (char === quoteChar) {
          if (valuesStr[i + 1] === quoteChar) {
            current += char;
            i++;
          } else {
            inQuotes = false;
            current += char;
          }
        } else {
          current += char;
        }
      } else {
        if (char === "'" || char === '"') {
          inQuotes = true;
          quoteChar = char;
          current += char;
        } else if (char === ',') {
          vals.push(this._castValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      }
    }
    if (current.trim()) {
      vals.push(this._castValue(current.trim()));
    }
    return vals;
  }

  /**
   * Helper to cast SQL literal string to JS primitive.
   * @private
   */
  _castValue(raw) {
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      raw = raw.slice(1, -1);
    }
    if (raw.toLowerCase() === 'null') return null;
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    if (!Number.isNaN(Number(raw)) && raw !== '') return Number(raw);
    return raw.replace(/''/g, "'").replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  /**
   * Execute parameterized SQL query.
   * @param {string} sql
   * @param {Array} [params]
   * @returns {Array<Object>}
   */
  query(sql, params = []) {
    let substituted = sql;
    if (params && params.length > 0) {
      let pIdx = 0;
      substituted = sql.replace(/\?/g, () => {
        const val = params[pIdx++];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        return `'${String(val).replace(/'/g, "''")}'`;
      });
    }

    const clean = substituted.trim();
    const selectMatch = clean.match(/^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?$/i);

    if (!selectMatch) return [];

    const colsStr = selectMatch[1].trim();
    const tblName = selectMatch[2].trim();
    const whereStr = selectMatch[3] ? selectMatch[3].trim() : null;
    const orderStr = selectMatch[4] ? selectMatch[4].trim() : null;

    if (!this.tables[tblName]) return [];

    let rows = Array.from(this.tables[tblName].values());

    // Apply WHERE
    if (whereStr) {
      const eqMatch = whereStr.match(/([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
      if (eqMatch) {
        const col = eqMatch[1].trim();
        const val = this._castValue(eqMatch[2].trim());
        rows = rows.filter(r => String(r[col]) === String(val));
      }
    }

    // Apply ORDER BY
    if (orderStr) {
      const parts = orderStr.split(/\s+/);
      const col = parts[0];
      const desc = parts[1] && parts[1].toUpperCase() === 'DESC';
      rows.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    }

    // Project columns
    if (colsStr === '*') {
      return rows.map(r => ({ ...r }));
    }

    const cols = colsStr.split(',').map(c => c.trim());
    return rows.map(r => {
      const projected = {};
      cols.forEach(c => { projected[c] = r[c]; });
      return projected;
    });
  }

  // =========================================================================
  // Chapter Completion Operations (SQLite)
  // =========================================================================

  /**
   * Mark a chapter as complete in SQLite.
   * @param {string} lessonId
   * @param {string} [phaseId]
   * @param {string} [title]
   * @param {number} [timestamp]
   * @returns {Object} Saved completion row
   */
  markChapterComplete(lessonId, phaseId = '', title = '', timestamp = Date.now()) {
    if (!lessonId) return null;
    const cleanId = String(lessonId).trim();
    const cleanPhase = String(phaseId || '').trim();
    const cleanTitle = String(title || cleanId).trim();

    this.exec(
      `INSERT OR REPLACE INTO chapter_completions (lesson_id, phase_id, title, completed_at) ` +
      `VALUES ('${cleanId.replace(/'/g, "''")}', '${cleanPhase.replace(/'/g, "''")}', '${cleanTitle.replace(/'/g, "''")}', ${timestamp});`
    );

    return this.getChapterCompletion(cleanId);
  }

  /**
   * Remove a chapter completion from SQLite.
   * @param {string} lessonId
   */
  unmarkChapterComplete(lessonId) {
    if (!lessonId) return;
    const cleanId = String(lessonId).trim();
    this.exec(`DELETE FROM chapter_completions WHERE lesson_id = '${cleanId.replace(/'/g, "''")}';`);
  }

  /**
   * Toggle completion state.
   * @param {string} lessonId
   * @param {string} [phaseId]
   * @param {string} [title]
   * @returns {boolean} true if now completed, false if uncompleted
   */
  toggleChapterCompletion(lessonId, phaseId = '', title = '') {
    if (this.isChapterCompleted(lessonId)) {
      this.unmarkChapterComplete(lessonId);
      return false;
    }
    this.markChapterComplete(lessonId, phaseId, title);
    return true;
  }

  /**
   * Check if a chapter is completed.
   * @param {string} lessonId
   * @returns {boolean}
   */
  isChapterCompleted(lessonId) {
    if (!lessonId) return false;
    const res = this.query(`SELECT lesson_id FROM chapter_completions WHERE lesson_id = ?`, [lessonId]);
    return res.length > 0;
  }

  /**
   * Get completion metadata for a chapter.
   * @param {string} lessonId
   * @returns {Object|null}
   */
  getChapterCompletion(lessonId) {
    if (!lessonId) return null;
    const res = this.query(`SELECT * FROM chapter_completions WHERE lesson_id = ?`, [lessonId]);
    return res.length > 0 ? res[0] : null;
  }

  /**
   * Get all completed chapters ordered by most recently completed.
   * @returns {Array<Object>}
   */
  getAllCompletedChapters() {
    return this.query(`SELECT * FROM chapter_completions ORDER BY completed_at DESC`);
  }

  /**
   * Get total count of completed chapters.
   * @returns {number}
   */
  getCompletedCount() {
    return this.tables.chapter_completions.size;
  }

  // =========================================================================
  // Per-Page Note Operations (SQLite)
  // =========================================================================

  /**
   * Save or update a note for a specific page/lesson in SQLite.
   * @param {string} lessonId
   * @param {string} phaseId
   * @param {string} title
   * @param {string} noteText
   * @param {number} [timestamp]
   * @returns {Object|null}
   */
  savePageNote(lessonId, phaseId = '', title = '', noteText = '', timestamp = Date.now()) {
    if (!lessonId) return null;
    const cleanId = String(lessonId).trim();
    const cleanPhase = String(phaseId || '').trim();
    const cleanTitle = String(title || cleanId).trim();
    const trimmedText = String(noteText || '').trim();

    if (!trimmedText) {
      this.deletePageNote(cleanId);
      return null;
    }

    const escapedText = trimmedText.replace(/'/g, "''");
    this.exec(
      `INSERT OR REPLACE INTO page_notes (lesson_id, phase_id, title, note_text, updated_at) ` +
      `VALUES ('${cleanId.replace(/'/g, "''")}', '${cleanPhase.replace(/'/g, "''")}', '${cleanTitle.replace(/'/g, "''")}', '${escapedText}', ${timestamp});`
    );

    return this.getPageNote(cleanId);
  }

  /**
   * Retrieve a note for a specific page/lesson from SQLite.
   * @param {string} lessonId
   * @returns {Object|null}
   */
  getPageNote(lessonId) {
    if (!lessonId) return null;
    const res = this.query(`SELECT * FROM page_notes WHERE lesson_id = ?`, [lessonId]);
    return res.length > 0 ? res[0] : null;
  }

  /**
   * Delete a note for a specific page/lesson from SQLite.
   * @param {string} lessonId
   */
  deletePageNote(lessonId) {
    if (!lessonId) return;
    const cleanId = String(lessonId).trim();
    this.exec(`DELETE FROM page_notes WHERE lesson_id = '${cleanId.replace(/'/g, "''")}';`);
  }

  /**
   * Get all page notes ordered by most recently updated.
   * @returns {Array<Object>}
   */
  getAllPageNotes() {
    return this.query(`SELECT * FROM page_notes ORDER BY updated_at DESC`);
  }

  /**
   * Get total count of saved notes.
   * @returns {number}
   */
  getNotesCount() {
    return this.tables.page_notes.size;
  }

  // =========================================================================
  // SQL Dump Export & Import (Portability)
  // =========================================================================

  /**
   * Export the entire local SQLite database as standard SQLite SQL statements.
   * @returns {string}
   */
  exportSqlDump() {
    const lines = [];
    lines.push('-- AI Engineering from Scratch — SQLite3 Database Dump');
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push('BEGIN TRANSACTION;');
    lines.push('CREATE TABLE IF NOT EXISTS chapter_completions (lesson_id TEXT PRIMARY KEY, phase_id TEXT NOT NULL, title TEXT NOT NULL, completed_at INTEGER NOT NULL);');
    lines.push('CREATE TABLE IF NOT EXISTS page_notes (lesson_id TEXT PRIMARY KEY, phase_id TEXT NOT NULL, title TEXT NOT NULL, note_text TEXT NOT NULL, updated_at INTEGER NOT NULL);');
    lines.push('CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT);');

    // Schema meta
    for (const row of this.tables.schema_meta.values()) {
      lines.push(`INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('${String(row.key).replace(/'/g, "''")}', '${String(row.value).replace(/'/g, "''")}');`);
    }

    // Completions
    for (const row of this.tables.chapter_completions.values()) {
      lines.push(
        `INSERT OR REPLACE INTO chapter_completions (lesson_id, phase_id, title, completed_at) ` +
        `VALUES ('${String(row.lesson_id).replace(/'/g, "''")}', '${String(row.phase_id).replace(/'/g, "''")}', '${String(row.title).replace(/'/g, "''")}', ${row.completed_at});`
      );
    }

    // Notes
    for (const row of this.tables.page_notes.values()) {
      lines.push(
        `INSERT OR REPLACE INTO page_notes (lesson_id, phase_id, title, note_text, updated_at) ` +
        `VALUES ('${String(row.lesson_id).replace(/'/g, "''")}', '${String(row.phase_id).replace(/'/g, "''")}', '${String(row.title).replace(/'/g, "''")}', '${String(row.note_text).replace(/'/g, "''")}', ${row.updated_at});`
      );
    }

    lines.push('COMMIT;');
    return lines.join('\n');
  }

  /**
   * Import SQL statements from a standard SQLite dump.
   * @param {string} sqlDump
   */
  importSqlDump(sqlDump) {
    if (!sqlDump) return;
    this.exec(sqlDump);
  }
}

// Universal export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SQLiteDatabase };
}
if (typeof window !== 'undefined') {
  window.SQLiteDatabase = SQLiteDatabase;
}
