function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(input: string): string {
  let out = escapeHtml(input);
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

/** Opaque live reference to a project sequence diagram (single source of truth). */
export const SEQUENCE_REF_FENCE = 'c4-sequence';

/** Opaque live reference to an API endpoint component (single source of truth). */
export const ENDPOINT_REF_FENCE = 'c4-endpoint';

/**
 * Opaque live reference to a broker channel. Separate from the endpoint fence
 * because a topic is not a request/response call — it resolves out of a
 * different index and renders its key/value/headers contract instead.
 */
export const CHANNEL_REF_FENCE = 'c4-channel';

/**
 * Opaque live reference to a UI element. Its own fence for the same reason a
 * channel has one: a screen is not a request/response call — it resolves out of
 * its own index and renders a design and its states rather than a payload.
 */
export const UI_REF_FENCE = 'c4-ui';

export function formatSequenceRefToken(id: string): string {
  return ['', '```' + SEQUENCE_REF_FENCE, `id: ${id}`, '```', ''].join('\n');
}

export function formatEndpointRefToken(id: string): string {
  return ['', '```' + ENDPOINT_REF_FENCE, `id: ${id}`, '```', ''].join('\n');
}

export function formatChannelRefToken(id: string): string {
  return ['', '```' + CHANNEL_REF_FENCE, `id: ${id}`, '```', ''].join('\n');
}

export function formatUiRefToken(id: string): string {
  return ['', '```' + UI_REF_FENCE, `id: ${id}`, '```', ''].join('\n');
}

export function parseSequenceRefFenceBody(body: string): string | null {
  const m = body.match(/^\s*id\s*:\s*([A-Za-z0-9_-]+)\s*$/m);
  return m?.[1] ?? null;
}

export function parseEndpointRefFenceBody(body: string): string | null {
  const m = body.match(/^\s*id\s*:\s*([A-Za-z0-9_-]+)\s*$/m);
  return m?.[1] ?? null;
}

export function parseChannelRefFenceBody(body: string): string | null {
  const m = body.match(/^\s*id\s*:\s*([A-Za-z0-9_-]+)\s*$/m);
  return m?.[1] ?? null;
}

export function parseUiRefFenceBody(body: string): string | null {
  const m = body.match(/^\s*id\s*:\s*([A-Za-z0-9_-]+)\s*$/m);
  return m?.[1] ?? null;
}

export type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

export type DocPreviewBlock =
  | { type: 'html'; html: string }
  | { type: 'sequence'; id: string }
  | { type: 'endpoint'; id: string }
  | { type: 'channel'; id: string }
  | { type: 'ui'; id: string }
  | { type: 'table'; table: MarkdownTable; tableIndex: number };

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

export function serializeMarkdownTable(table: MarkdownTable): string {
  const width = Math.max(
    table.headers.length,
    ...table.rows.map((r) => r.length),
    1
  );
  const pad = (row: string[]) => {
    const next = row.slice(0, width);
    while (next.length < width) next.push('');
    return next;
  };
  const headers = pad(table.headers.length ? table.headers : Array.from({ length: width }, (_, i) => `Column ${i + 1}`));
  const sep = headers.map(() => '---');
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...table.rows.map((r) => `| ${pad(r).join(' | ')} |`),
  ];
  return lines.join('\n');
}

export function createEmptyMarkdownTable(rows: number, cols: number): MarkdownTable {
  const width = Math.max(1, cols);
  const height = Math.max(1, rows);
  return {
    headers: Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: height }, () => Array.from({ length: width }, () => '')),
  };
}

export function formatMarkdownTableToken(rows = 2, cols = 3): string {
  return ['', serializeMarkdownTable(createEmptyMarkdownTable(rows, cols)), ''].join('\n');
}

/** Tiny markdown renderer for MVP docs preview. */
export function markdownToHtml(markdown: string): string {
  return splitMarkdownToPreviewBlocks(markdown)
    .filter((b): b is Extract<DocPreviewBlock, { type: 'html' }> => b.type === 'html')
    .map((b) => b.html)
    .join('\n');
}

/**
 * Split markdown into HTML segments, tables, and live sequence refs.
 * Sequence fences: ```c4-sequence\nid: <diagramId>\n```
 * Endpoint fences: ```c4-endpoint\nid: <componentId>\n```
 */
export function splitMarkdownToPreviewBlocks(markdown: string): DocPreviewBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: DocPreviewBlock[] = [];
  let htmlBuf: string[] = [];
  let inCode = false;
  let inUl = false;
  let inOl = false;
  let codeLang = '';
  let codeBody: string[] = [];
  let tableIndex = 0;

  const flushHtml = () => {
    if (!htmlBuf.length) return;
    blocks.push({ type: 'html', html: htmlBuf.join('\n') });
    htmlBuf = [];
  };

  const closeLists = () => {
    if (inUl) {
      htmlBuf.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlBuf.push('</ol>');
      inOl = false;
    }
  };

  const pushHtmlLine = (line: string) => {
    htmlBuf.push(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith('```')) {
      closeLists();
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBody = [];
      } else {
        inCode = false;
        if (codeLang === SEQUENCE_REF_FENCE) {
          flushHtml();
          const id = parseSequenceRefFenceBody(codeBody.join('\n'));
          if (id) blocks.push({ type: 'sequence', id });
          else {
            pushHtmlLine(
              `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBody.join('\n'))}</code></pre>`
            );
          }
        } else if (codeLang === ENDPOINT_REF_FENCE) {
          flushHtml();
          const id = parseEndpointRefFenceBody(codeBody.join('\n'));
          if (id) blocks.push({ type: 'endpoint', id });
          else {
            pushHtmlLine(
              `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBody.join('\n'))}</code></pre>`
            );
          }
        } else if (codeLang === CHANNEL_REF_FENCE) {
          flushHtml();
          const id = parseChannelRefFenceBody(codeBody.join('\n'));
          if (id) blocks.push({ type: 'channel', id });
          else {
            pushHtmlLine(
              `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBody.join('\n'))}</code></pre>`
            );
          }
        } else if (codeLang === UI_REF_FENCE) {
          flushHtml();
          const id = parseUiRefFenceBody(codeBody.join('\n'));
          if (id) blocks.push({ type: 'ui', id });
          else {
            pushHtmlLine(
              `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBody.join('\n'))}</code></pre>`
            );
          }
        } else {
          pushHtmlLine(`<pre><code class="language-${escapeHtml(codeLang)}">`);
          for (const l of codeBody) pushHtmlLine(`${escapeHtml(l)}\n`);
          pushHtmlLine('</code></pre>');
        }
        codeLang = '';
        codeBody = [];
      }
      continue;
    }

    if (inCode) {
      codeBody.push(line);
      continue;
    }

    // GFM table: header + separator + body rows
    const next = lines[i + 1];
    if (
      line.includes('|') &&
      next &&
      isTableSeparator(next) &&
      splitTableRow(line).length > 0
    ) {
      closeLists();
      flushHtml();
      const headers = splitTableRow(line);
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i]!;
        if (!rowLine.includes('|') || !rowLine.trim()) break;
        if (rowLine.trim().startsWith('```')) break;
        rows.push(splitTableRow(rowLine));
        i += 1;
      }
      i -= 1; // compensate loop increment
      blocks.push({
        type: 'table',
        tableIndex: tableIndex++,
        table: { headers, rows },
      });
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      pushHtmlLine('<p></p>');
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeLists();
      const level = heading[1]!.length;
      pushHtmlLine(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (inOl) {
        htmlBuf.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        pushHtmlLine('<ul>');
        inUl = true;
      }
      pushHtmlLine(`<li>${inlineMarkdown(ul[1]!)}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (inUl) {
        htmlBuf.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        pushHtmlLine('<ol>');
        inOl = true;
      }
      pushHtmlLine(`<li>${inlineMarkdown(ol[1]!)}</li>`);
      continue;
    }

    closeLists();
    pushHtmlLine(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  closeLists();
  if (inCode) {
    if (codeLang === SEQUENCE_REF_FENCE) {
      flushHtml();
      const id = parseSequenceRefFenceBody(codeBody.join('\n'));
      if (id) blocks.push({ type: 'sequence', id });
    } else if (codeLang === ENDPOINT_REF_FENCE) {
      flushHtml();
      const id = parseEndpointRefFenceBody(codeBody.join('\n'));
      if (id) blocks.push({ type: 'endpoint', id });
    } else if (codeLang === CHANNEL_REF_FENCE) {
      flushHtml();
      const id = parseChannelRefFenceBody(codeBody.join('\n'));
      if (id) blocks.push({ type: 'channel', id });
    } else if (codeLang === UI_REF_FENCE) {
      flushHtml();
      const id = parseUiRefFenceBody(codeBody.join('\n'));
      if (id) blocks.push({ type: 'ui', id });
    } else {
      pushHtmlLine(`<pre><code class="language-${escapeHtml(codeLang)}">`);
      for (const l of codeBody) pushHtmlLine(`${escapeHtml(l)}\n`);
      pushHtmlLine('</code></pre>');
    }
  }
  flushHtml();
  return blocks;
}

/** Replace N-th markdown table (0-based among parsed tables) with `next`. */
export function replaceMarkdownTable(
  markdown: string,
  tableIndex: number,
  next: MarkdownTable
): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let current = -1;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    const sep = lines[i + 1];
    if (
      line.includes('|') &&
      sep &&
      isTableSeparator(sep) &&
      splitTableRow(line).length > 0
    ) {
      current += 1;
      const start = i;
      let end = i + 1; // separator
      while (end + 1 < lines.length) {
        const rowLine = lines[end + 1]!;
        if (!rowLine.includes('|') || !rowLine.trim()) break;
        if (rowLine.trim().startsWith('```')) break;
        end += 1;
      }
      if (current === tableIndex) {
        const before = lines.slice(0, start);
        const after = lines.slice(end + 1);
        const serialized = serializeMarkdownTable(next).split('\n');
        return [...before, ...serialized, ...after].join('\n');
      }
      i = end;
    }
  }

  return markdown;
}

export function appendMarkdownSnippet(markdown: string, snippet: string): string {
  const base = markdown.replace(/\s*$/, '');
  const token = snippet.replace(/^\n+/, '').replace(/\n+$/, '');
  if (!base) return `${token}\n`;
  return `${base}\n\n${token}\n`;
}
