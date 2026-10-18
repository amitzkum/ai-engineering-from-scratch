#!/usr/bin/env python3
"""build_offline_books.py

Compiles all 6 curriculum volumes from book/volumes.json into:
1. Valid EPUB 3.0 archives (application/epub+zip)
2. Standalone offline HTML readers (supporting in-app reading & print-to-PDF)
3. High-fidelity PDF documents generated via headless LibreOffice
4. library.json metadata manifest for the in-app Book Library

Attribution:
- App Architecture & Packaging: Amit Kumar
- Curriculum Source: AI Engineering from Scratch Contributors
"""

import html
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"
VOLUMES_JSON = ROOT / "book" / "volumes.json"
DIST_DIR = ROOT / "offline-app" / "dist"
BOOKS_DIR = DIST_DIR / "books"
KATEX_CSS_PATH = DIST_DIR / "katex.min.css"
if not KATEX_CSS_PATH.exists():
    KATEX_CSS_PATH = ROOT / "vendor" / "katex" / "katex.min.css"

ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]

# Read KaTeX CSS for inlining
KATEX_CSS_TEXT = ""
if KATEX_CSS_PATH.exists():
    KATEX_CSS_TEXT = KATEX_CSS_PATH.read_text(encoding="utf-8")

BOOK_BASE_CSS = """
*, *::before, *::after {
  box-sizing: border-box;
}
html {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}
body {
  font-family: Georgia, 'Source Serif 4', serif;
  line-height: 1.65;
  color: #111;
  background: #fafaf5;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 20px;
  overflow-x: hidden;
  word-break: break-word;
  overflow-wrap: break-word;
  font-size: 16px;
}
h1, h2, h3, h4 {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  margin-top: 1.5em;
  line-height: 1.3;
}
h1 { font-size: 2em; border-bottom: 2px solid #3553ff; padding-bottom: 0.3em; }
h2 { font-size: 1.4em; border-bottom: 1px solid #ddd; padding-bottom: 0.2em; }
h3 { font-size: 1.15em; }
p { margin: 1em 0; }
pre, code {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.88em;
}
pre {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 12px 16px;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
}
code {
  background: #f0f2f5;
  padding: 0.15em 0.35em;
  border-radius: 3px;
  word-break: break-word;
}
pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
  word-break: break-word;
  white-space: pre-wrap;
}
blockquote {
  border-left: 4px solid #3553ff;
  margin: 1.2em 0;
  padding: 0.5em 1em;
  background: #f4f6ff;
  font-style: italic;
}
.motto {
  font-size: 1.1em;
  font-style: italic;
  color: #444;
  border-left: 3px solid #3553ff;
  padding: 8px 16px;
  margin: 1.2em 0;
  background: #f8f9ff;
}
.learning-objectives {
  background: #f0f7ff;
  border: 1px solid #c8e1ff;
  border-radius: 6px;
  padding: 14px 18px;
  margin: 1.5em 0;
}
.learning-objectives-title {
  font-weight: 700;
  font-family: sans-serif;
  color: #0969da;
  margin-bottom: 8px;
}
.learning-objectives ul {
  margin: 0;
  padding-left: 20px;
}
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.5em 0;
  box-sizing: border-box;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
  font-size: 0.9em;
}
th, td {
  border: 1px solid #d0d7de;
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f3f4f6;
  font-weight: 600;
}
tr:nth-child(even) td {
  background: #fafafa;
}
.math-display {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  padding: 8px 0;
  margin: 1.2em 0;
  text-align: center;
}
.math-display .katex-display,
.katex-display {
  margin: 0;
  padding: 4px 0;
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.math-inline {
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  vertical-align: middle;
}
.mermaid-container {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.5em 0;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  box-sizing: border-box;
}
.mermaid-toolbar {
  display: none;
}
.mermaid-render {
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow-x: auto;
  max-width: 100%;
}
.mermaid-render svg {
  max-width: 100%;
  height: auto;
  display: block;
}
.mermaid-source {
  padding: 12px 16px;
  background: #f6f8fa;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em;
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.lesson-figure {
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  padding: 16px;
  box-sizing: border-box;
  overflow-x: auto;
}
.lesson-figure svg {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
.lesson-figure:empty::before {
  content: "📊 Diagram: " attr(data-figure);
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em;
  color: #57606a;
  text-align: center;
  padding: 12px;
}
.title-page {
  text-align: center;
  padding: 4em 1em;
}
.title-page h1 {
  font-size: 2.5em;
  margin-bottom: 0.3em;
  border: none;
}
.title-page .subtitle {
  font-size: 1.25em;
  color: #555;
  margin-bottom: 2em;
}
.title-page .author {
  font-size: 1.1em;
  color: #3553ff;
  font-weight: bold;
}
@media (max-width: 768px) {
  body {
    padding: 16px 12px;
  }
  .reader-header h1 {
    font-size: 1.5em !important;
  }
  .reader-nav ul {
    column-count: 1 !important;
    column-gap: 0 !important;
  }
  table {
    font-size: 0.82em;
  }
  pre {
    font-size: 0.82em;
    padding: 10px;
  }
}
@media print {
  body {
    max-width: 100%;
    margin: 0;
    padding: 20mm 15mm;
    background: #fff;
  }
  .reader-nav {
    display: none;
  }
  .reader-chapter {
    page-break-before: always;
  }
  .mermaid-source {
    display: block !important;
  }
}
"""

EPUB_CSS = f"""
{KATEX_CSS_TEXT}
{BOOK_BASE_CSS}
"""


def html_to_xhtml(html_str):
    """Converts HTML to valid XHTML for EPUB 3 chapters."""
    # Strip script tags for EPUB chapter safety
    res = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html_str, flags=re.IGNORECASE)
    # Ensure void tags are self-closing: <br>, <hr>, <img>, <col>, <input>
    res = re.sub(r'<(img|br|hr|col|input)([^>]*?)(?<!/)>', r'<\1\2 />', res, flags=re.IGNORECASE)
    # Ensure raw ampersands are escaped
    res = re.sub(r'&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)', '&amp;', res)
    return res


def build_volume(volume_cfg, compiled_vol):
    """Compiles one volume into an EPUB file, standalone HTML reader, and PDF."""
    vol_num = volume_cfg["number"]
    vol_slug = volume_cfg["slug"]
    vol_title = volume_cfg["title"]
    vol_subtitle = volume_cfg.get("subtitle", "")
    vol_roman = ROMAN_NUMERALS[vol_num - 1] if vol_num <= len(ROMAN_NUMERALS) else str(vol_num)

    epub_filename = f"volume-{vol_num}-{vol_slug}.epub"
    html_filename = f"volume-{vol_num}-{vol_slug}.html"
    pdf_filename = f"volume-{vol_num}-{vol_slug}.pdf"

    epub_path = BOOKS_DIR / epub_filename
    html_path = BOOKS_DIR / html_filename
    pdf_path = BOOKS_DIR / pdf_filename

    chapters = compiled_vol["chapters"]
    total_words = compiled_vol["wordCount"]

    # 1. Build Standalone Reader HTML
    html_chapters = []
    toc_links = []
    for idx, chap in enumerate(chapters):
        anchor = f"chapter-{idx + 1}"
        toc_links.append(f'<li><a href="#{anchor}">{idx + 1}. {html.escape(chap["title"])}</a></li>')
        html_chapters.append(f'''
        <article class="reader-chapter" id="{anchor}">
          <div class="reader-chapter-meta">{html.escape(chap["phase"])} · Chapter {idx + 1}</div>
          {chap["html"]}
        </article>
        ''')

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Volume {vol_roman}: {html.escape(vol_title)} - AI Engineering from Scratch</title>
  <style>
    {KATEX_CSS_TEXT}
    {BOOK_BASE_CSS}
    .reader-header {{ border-bottom: 2px solid #3553ff; padding-bottom: 24px; margin-bottom: 32px; }}
    .reader-nav {{ background: #f0f2f5; padding: 20px; border-radius: 8px; margin-bottom: 40px; }}
    .reader-nav ul {{ column-count: 2; column-gap: 32px; list-style: none; padding-left: 0; margin: 0; }}
    .reader-nav li {{ margin-bottom: 8px; font-size: 0.95em; }}
    .reader-nav a {{ color: #3553ff; text-decoration: none; }}
    .reader-nav a:hover {{ text-decoration: underline; }}
    .reader-chapter {{ margin-bottom: 60px; padding-top: 20px; border-top: 1px solid #ddd; }}
    .reader-chapter-meta {{ font-family: monospace; font-size: 0.85em; color: #777; text-transform: uppercase; margin-bottom: 8px; }}
  </style>
</head>
<body>
  <header class="reader-header">
    <div style="font-family: monospace; color: #3553ff; font-weight: bold; font-size: 0.9em;">VOLUME {vol_roman}</div>
    <h1 style="margin-top: 8px;">{html.escape(vol_title)}</h1>
    <div style="color: #666; font-size: 1.15em;">{html.escape(vol_subtitle)}</div>
    <div style="margin-top: 12px; font-family: monospace; font-size: 0.85em; color: #888;">{len(chapters)} Chapters · {total_words:,} Words</div>
  </header>

  <nav class="reader-nav">
    <h3 style="margin-top: 0;">Table of Contents</h3>
    <ul>
      {"".join(toc_links)}
    </ul>
  </nav>

  <main>
    {"".join(html_chapters)}
  </main>

  <script src="../mermaid.min.js"></script>
  <script src="../figure-manifest.js"></script>
  <script src="../figures.js"></script>
  <script src="../lesson-figures.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {{
      // 1. Render Mermaid diagrams
      if (window.mermaid) {{
        try {{
          mermaid.initialize({{
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose'
          }});
          document.querySelectorAll('.mermaid-block').forEach(function (block, idx) {{
            var source = block.querySelector('pre.mermaid-source');
            var renderDiv = block.querySelector('.mermaid-render');
            if (source && renderDiv) {{
              var code = source.textContent.trim();
              var id = 'book-mermaid-' + idx;
              mermaid.render(id, code).then(function (res) {{
                renderDiv.innerHTML = res.svg;
                source.style.display = 'none';
              }}).catch(function (e) {{
                source.style.display = 'block';
              }});
            }}
          }});
        }} catch (err) {{
          console.warn('Mermaid error:', err);
        }}
      }}
      // 2. Mount lesson figures
      if (window.AIFS_loadFigureProviders) {{
        window.AIFS_loadFigureProviders(document.body).catch(function () {{}});
      }}
    }});
  </script>
</body>
</html>"""
    html_path.write_text(full_html, encoding="utf-8")

    # 2. Build EPUB Archive
    with zipfile.ZipFile(epub_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 2a. mimetype (must be uncompressed stored)
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)

        # 2b. container.xml
        zf.writestr(
            "META-INF/container.xml",
            """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>""",
        )

        # 2c. style.css
        zf.writestr("OEBPS/style.css", EPUB_CSS)

        # 2d. Title / Cover page
        title_page_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Volume {vol_roman}: {html.escape(vol_title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="title-page">
    <p style="font-family: monospace; color: #3553ff; letter-spacing: 0.1em;">VOLUME {vol_roman}</p>
    <h1>{html.escape(vol_title)}</h1>
    <p class="subtitle">{html.escape(vol_subtitle)}</p>
    <p class="author">AI Engineering from Scratch</p>
    <p style="font-size: 0.9em; color: #888; margin-top: 3em;">542-Lesson Comprehensive Curriculum</p>
  </div>
</body>
</html>"""
        zf.writestr("OEBPS/cover.xhtml", title_page_xhtml)

        # 2e. Chapters
        manifest_items = [
            '<item id="style" href="style.css" media-type="text/css"/>',
            '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
            '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
            '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        ]
        spine_items = ['<itemref idref="cover"/>']
        nav_li = []
        ncx_points = []

        for idx, chap in enumerate(chapters):
            xhtml_body = html_to_xhtml(chap["html"])
            chap_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{html.escape(chap["title"])}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div style="font-family: monospace; font-size: 0.8em; color: #3553ff; text-transform: uppercase;">Chapter {idx + 1}</div>
  {xhtml_body}
</body>
</html>"""
            zf.writestr(f"OEBPS/{chap['file']}", chap_xhtml)
            manifest_items.append(
                f'<item id="{chap["id"]}" href="{chap["file"]}" media-type="application/xhtml+xml"/>'
            )
            spine_items.append(f'<itemref idref="{chap["id"]}"/>')
            nav_li.append(
                f'<li><a href="{chap["file"]}">{idx + 1}. {html.escape(chap["title"])}</a></li>'
            )
            ncx_points.append(f"""    <navPoint id="navPoint-{idx + 1}" playOrder="{idx + 1}">
      <navLabel><text>{idx + 1}. {html.escape(chap["title"])}</text></navLabel>
      <content src="{chap["file"]}"/>
    </navPoint>""")

        # 2f. nav.xhtml
        nav_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      {"".join(nav_li)}
    </ol>
  </nav>
</body>
</html>"""
        zf.writestr("OEBPS/nav.xhtml", nav_xhtml)

        # 2g. toc.ncx (EPUB 2 compatibility)
        toc_ncx = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:aifs-volume-{vol_num}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>Volume {vol_roman}: {html.escape(vol_title)}</text></docTitle>
  <navMap>
{"".join(ncx_points)}
  </navMap>
</ncx>"""
        zf.writestr("OEBPS/toc.ncx", toc_ncx)

        # 2h. content.opf
        content_opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:aifs-volume-{vol_num}</dc:identifier>
    <dc:title>Volume {vol_roman}: {html.escape(vol_title)}</dc:title>
    <dc:creator>AI Engineering from Scratch</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-10-15T00:00:00Z</meta>
  </metadata>
  <manifest>
    {"".join(manifest_items)}
  </manifest>
  <spine toc="ncx">
    {"".join(spine_items)}
  </spine>
</package>"""
        zf.writestr("OEBPS/content.opf", content_opf)

    epub_size_kb = round(epub_path.stat().st_size / 1024, 1)

    # 3. PDF Generation (headless libreoffice)
    pdf_size_kb = 0
    if shutil.which("libreoffice"):
        try:
            print(f"      📄 Compiling PDF for Volume {vol_num} ({vol_slug})...")
            cmd = ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(BOOKS_DIR), str(html_path)]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"      ⚠ Could not generate PDF for {vol_slug}: {e}")
    if pdf_path.exists():
        pdf_size_kb = round(pdf_path.stat().st_size / 1024, 1)

    return {
        "id": f"volume-{vol_num}-{vol_slug}",
        "number": vol_num,
        "roman": vol_roman,
        "slug": vol_slug,
        "title": vol_title,
        "subtitle": vol_subtitle,
        "phases": volume_cfg["phases"],
        "chapterCount": len(chapters),
        "wordCount": total_words,
        "epubFile": epub_filename,
        "epubSizeKb": epub_size_kb,
        "htmlFile": html_filename,
        "pdfFile": pdf_filename,
        "pdfSizeKb": pdf_size_kb,
    }


def main():
    print("📚 Pre-generating 6 Curriculum Book Volumes (EPUB, HTML & PDF)...")
    BOOKS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Compile all volume chapters using lesson-markdown and KaTeX pre-rendering
    compile_script = ROOT / "scripts" / "compile_book_chapters.js"
    cmd = ["node", str(compile_script), "all"]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    all_compiled_volumes = json.loads(proc.stdout)
    volumes_by_num = {v["number"]: v for v in all_compiled_volumes}

    volumes_data = json.loads(VOLUMES_JSON.read_text(encoding="utf-8"))
    library_manifest = []

    for vol_cfg in volumes_data["volumes"]:
        compiled_vol = volumes_by_num.get(vol_cfg["number"])
        meta = build_volume(vol_cfg, compiled_vol)
        library_manifest.append(meta)

    # Save library manifest
    manifest_path = BOOKS_DIR / "library.json"
    manifest_path.write_text(json.dumps(library_manifest, indent=2), encoding="utf-8")
    print(f"🎉 All 6 Volumes pre-generated at: {BOOKS_DIR}")


if __name__ == "__main__":
    main()
