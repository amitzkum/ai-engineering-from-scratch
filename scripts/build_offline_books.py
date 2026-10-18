#!/usr/bin/env python3
"""build_offline_books.py

Compiles all 6 curriculum volumes from book/volumes.json into:
1. Valid EPUB 3.0 archives (application/epub+zip)
2. Standalone offline HTML readers (supporting in-app reading & print-to-PDF)
3. library.json metadata manifest for the in-app Book Library

Zero external dependencies (uses Python stdlib only: zipfile, html, json, re, pathlib).
"""

import html
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"
VOLUMES_JSON = ROOT / "book" / "volumes.json"
DIST_DIR = ROOT / "offline-app" / "dist"
BOOKS_DIR = DIST_DIR / "books"

ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]

EPUB_CSS = """
body {
  font-family: Georgia, 'Source Serif 4', serif;
  line-height: 1.6;
  margin: 1.5em;
  color: #111;
  background: #fafaf5;
}
h1, h2, h3, h4 {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  margin-top: 1.5em;
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
  background: #f0f0eb;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1em;
  overflow-x: auto;
  white-space: pre-wrap;
}
code {
  background: #f0f0eb;
  padding: 0.15em 0.35em;
  border-radius: 3px;
}
blockquote {
  border-left: 4px solid #3553ff;
  margin: 1.2em 0;
  padding: 0.5em 1em;
  background: #f4f6ff;
  font-style: italic;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
}
th, td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}
th {
  background: #eaeaea;
  font-weight: bold;
}
.math-display {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  box-sizing: border-box;
  padding: 8px 0;
  margin: 1.2em 0;
}
.math-display .katex-display,
.katex-display {
  margin: 0;
  padding: 4px 0;
  display: block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  box-sizing: border-box;
}
.math-inline {
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  vertical-align: middle;
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
"""


def clean_markdown_to_xhtml(md_text):
    """Converts markdown content into clean XHTML suitable for EPUB chapters."""
    lines = md_text.splitlines()
    out = []
    in_code = False
    code_lines = []
    in_list = False
    in_quote = False
    quote_lines = []

    in_math_block = False
    math_lines = []

    def flush_list():
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    def flush_quote():
        nonlocal in_quote, quote_lines
        if in_quote:
            out.append(f"<blockquote><p>{html.escape(' '.join(quote_lines))}</p></blockquote>")
            quote_lines = []
            in_quote = False

    for line in lines:
        stripped = line.strip()

        # Math block fences ($$ or ```math)
        if stripped.startswith("$$") or (stripped == "```" and in_math_block) or stripped.startswith("```math"):
            flush_list()
            flush_quote()
            if in_math_block:
                in_math_block = False
                raw_tex = "\n".join(math_lines).strip()
                out.append(f'<div class="math-display" data-math="display" data-tex="{html.escape(raw_tex)}">{html.escape(raw_tex)}</div>')
                math_lines = []
            else:
                in_math_block = True
                math_lines = []
            continue

        if in_math_block:
            math_lines.append(line)
            continue

        # Code block fences
        if stripped.startswith("```"):
            flush_list()
            flush_quote()
            if in_code:
                in_code = False
                escaped_code = html.escape("\n".join(code_lines))
                out.append(f"<pre><code>{escaped_code}</code></pre>")
                code_lines = []
            else:
                in_code = True
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        # Blockquotes
        if stripped.startswith(">"):
            flush_list()
            in_quote = True
            quote_lines.append(stripped.lstrip("> ").strip())
            continue
        elif in_quote and not stripped:
            flush_quote()

        # Headings
        if stripped.startswith("# "):
            flush_list()
            flush_quote()
            out.append(f"<h1>{html.escape(stripped[2:])}</h1>")
            continue
        if stripped.startswith("## "):
            flush_list()
            flush_quote()
            out.append(f"<h2>{html.escape(stripped[3:])}</h2>")
            continue
        if stripped.startswith("### "):
            flush_list()
            flush_quote()
            out.append(f"<h3>{html.escape(stripped[4:])}</h3>")
            continue

        # Bullet list items
        if stripped.startswith("- ") or stripped.startswith("* "):
            flush_quote()
            if not in_list:
                out.append("<ul>")
                in_list = True
            raw_item = stripped[2:]
            raw_item = re.sub(r'(?<!\\)\$([^\$\n]+?)(?<!\\)\$', r'@@MATH_\1_END@@', raw_item)
            item_text = html.escape(raw_item)
            item_text = re.sub(r"`([^`]+)`", r"<code>\1</code>", item_text)
            item_text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", item_text)
            item_text = re.sub(r'@@MATH_(.*?)_END@@', r'<span class="math-inline" data-math="inline" data-tex="\1">\1</span>', item_text)
            out.append(f"<li>{item_text}</li>")
            continue
        else:
            flush_list()

        # Empty lines
        if not stripped:
            continue

        # Regular paragraphs
        flush_quote()
        raw_para = stripped
        raw_para = re.sub(r'(?<!\\)\$([^\$\n]+?)(?<!\\)\$', r'@@MATH_\1_END@@', raw_para)
        para = html.escape(raw_para)
        # Inline code, bold, italic
        para = re.sub(r"`([^`]+)`", r"<code>\1</code>", para)
        para = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", para)
        para = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", para)
        para = re.sub(r'@@MATH_(.*?)_END@@', r'<span class="math-inline" data-math="inline" data-tex="\1">\1</span>', para)
        out.append(f"<p>{para}</p>")

    flush_list()
    flush_quote()
    return "\n".join(out)


def build_volume(volume_cfg):
    """Compiles one volume into an EPUB file and a standalone HTML file."""
    vol_num = volume_cfg["number"]
    vol_slug = volume_cfg["slug"]
    vol_title = volume_cfg["title"]
    vol_subtitle = volume_cfg.get("subtitle", "")
    vol_roman = ROMAN_NUMERALS[vol_num - 1] if vol_num <= len(ROMAN_NUMERALS) else str(vol_num)

    epub_filename = f"volume-{vol_num}-{vol_slug}.epub"
    html_filename = f"volume-{vol_num}-{vol_slug}.html"
    epub_path = BOOKS_DIR / epub_filename
    html_path = BOOKS_DIR / html_filename

    # Collect lessons
    chapters = []
    total_words = 0

    for phase_dir in volume_cfg["phases"]:
        phase_path = PHASES_DIR / phase_dir
        if not phase_path.is_dir():
            continue

        lesson_dirs = sorted(
            [d for d in phase_path.iterdir() if d.is_dir() and re.match(r"^\d{2}-", d.name)]
        )

        for l_dir in lesson_dirs:
            doc_path = l_dir / "docs" / "en.md"
            if not doc_path.is_file():
                continue

            md_content = doc_path.read_text(encoding="utf-8")
            words = len(md_content.split())
            total_words += words

            # Extract title
            title = l_dir.name
            for line in md_content.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip()
                    break

            xhtml_content = clean_markdown_to_xhtml(md_content)
            chapter_id = f"chap-{len(chapters) + 1:03d}"
            chapter_file = f"{chapter_id}.xhtml"

            chapters.append({
                "id": chapter_id,
                "file": chapter_file,
                "title": title,
                "phase": phase_dir,
                "slug": l_dir.name,
                "words": words,
                "xhtml": xhtml_content,
            })

    # 1. Build Standalone Reader HTML
    html_chapters = []
    toc_links = []
    for idx, chap in enumerate(chapters):
        anchor = f"chapter-{idx + 1}"
        toc_links.append(f'<li><a href="#{anchor}">{idx + 1}. {html.escape(chap["title"])}</a></li>')
        html_chapters.append(f'''
        <article class="reader-chapter" id="{anchor}">
          <div class="reader-chapter-meta">{html.escape(chap["phase"])} · Chapter {idx + 1}</div>
          {chap["xhtml"]}
        </article>
        ''')

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Volume {vol_roman}: {html.escape(vol_title)} - AI Engineering from Scratch</title>
  <link rel="stylesheet" href="../katex.min.css">
  <script src="../katex.min.js"></script>
  <style>
    {EPUB_CSS}
    body {{ max-width: 840px; margin: 0 auto; padding: 40px 24px; }}
    .reader-header {{ border-bottom: 2px solid #3553ff; padding-bottom: 24px; margin-bottom: 32px; }}
    .reader-nav {{ background: #f0f2f5; padding: 20px; border-radius: 8px; margin-bottom: 40px; }}
    .reader-nav ul {{ column-count: 2; column-gap: 32px; list-style: none; padding-left: 0; }}
    .reader-nav li {{ margin-bottom: 8px; font-size: 0.95em; }}
    .reader-nav a {{ color: #3553ff; text-decoration: none; }}
    .reader-chapter {{ margin-bottom: 60px; padding-top: 20px; border-top: 1px solid #ddd; }}
    .reader-chapter-meta {{ font-family: monospace; font-size: 0.85em; color: #777; text-transform: uppercase; margin-bottom: 8px; }}
    @media print {{
      body {{ max-width: 100%; margin: 0; padding: 0; }}
      .reader-nav {{ display: none; }}
      .reader-chapter {{ page-break-before: always; }}
    }}
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
  <script>
    document.addEventListener('DOMContentLoaded', function () {{
      if (window.katex) {{
        document.querySelectorAll('.math-inline, .math-display').forEach(function (el) {{
          var isDisplay = el.classList.contains('math-display');
          try {{
            var tex = el.getAttribute('data-tex') || el.textContent;
            katex.render(tex, el, {{ displayMode: isDisplay, throwOnError: false }});
            el.setAttribute('data-math-rendered', 'true');
          }} catch (_) {{}}
        }});
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
            chap_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{html.escape(chap["title"])}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div style="font-family: monospace; font-size: 0.8em; color: #3553ff; text-transform: uppercase;">Chapter {idx + 1}</div>
  {chap["xhtml"]}
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
    print(f"   ✓ Built Volume {vol_num}: {vol_title} ({len(chapters)} chapters, {total_words:,} words, {epub_size_kb} KB)")

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
    }


def main():
    print("📚 Pre-generating 6 Curriculum Book Volumes (EPUB & HTML)...")
    BOOKS_DIR.mkdir(parents=True, exist_ok=True)

    volumes_data = json.loads(VOLUMES_JSON.read_text(encoding="utf-8"))
    library_manifest = []

    for vol in volumes_data["volumes"]:
        meta = build_volume(vol)
        library_manifest.append(meta)

    # Save library manifest
    manifest_path = BOOKS_DIR / "library.json"
    manifest_path.write_text(json.dumps(library_manifest, indent=2), encoding="utf-8")
    print(f"🎉 All 6 Volumes pre-generated at: {BOOKS_DIR}")


if __name__ == "__main__":
    main()
