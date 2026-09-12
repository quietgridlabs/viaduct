export type TokenKind =
  | 'at_startuml'
  | 'at_enduml'
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'arrow'
  | 'colon'
  | 'comma'
  | 'plus_plus'
  | 'minus_minus'
  | 'text'
  | 'comment'
  | 'newline'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

const ARROWS = ['-->>', '->>', '-->x', '->x', '-->', '->'] as const;
const KEYWORDS = new Set([
  'title',
  'actor',
  'participant',
  'boundary',
  'control',
  'entity',
  'database',
  'queue',
  'collections',
  'as',
  'activate',
  'deactivate',
  'note',
  'left',
  'right',
  'over',
  'of',
  'return',
  'alt',
  'else',
  'opt',
  'loop',
  'par',
  'and',
  'break',
  'critical',
  'group',
  'expand',
  'end',
  'ref',
  'create',
  'destroy',
  'autonumber',
]);

export function lexPlantUml(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const lineNo = li + 1;
    let i = 0;

    const push = (
      kind: TokenKind,
      value: string,
      startCol: number,
      endCol = startCol + value.length
    ) => {
      tokens.push({
        kind,
        value,
        line: lineNo,
        column: startCol,
        endLine: lineNo,
        endColumn: endCol,
      });
    };

    while (i < line.length) {
      if (/\s/.test(line[i]!)) {
        i++;
        continue;
      }

      if (line.startsWith("'", i)) {
        push('comment', line.slice(i), i + 1, line.length + 1);
        break;
      }

      if (line.startsWith('@startuml', i)) {
        push('at_startuml', '@startuml', i + 1, i + 1 + '@startuml'.length);
        i += '@startuml'.length;
        continue;
      }
      if (line.startsWith('@enduml', i)) {
        push('at_enduml', '@enduml', i + 1, i + 1 + '@enduml'.length);
        i += '@enduml'.length;
        continue;
      }

      // Divider: == Label ==
      if (line.startsWith('==', i)) {
        push('text', line.slice(i).trimEnd(), i + 1, line.length + 1);
        break;
      }

      let matchedArrow: string | null = null;
      for (const a of ARROWS) {
        if (line.startsWith(a, i)) {
          matchedArrow = a;
          break;
        }
      }
      if (matchedArrow) {
        push('arrow', matchedArrow, i + 1, i + 1 + matchedArrow.length);
        i += matchedArrow.length;
        continue;
      }

      if (line.startsWith('++', i)) {
        push('plus_plus', '++', i + 1, i + 3);
        i += 2;
        continue;
      }
      if (line.startsWith('--', i) && !line.startsWith('-->', i) && !line.startsWith('-->>', i)) {
        push('minus_minus', '--', i + 1, i + 3);
        i += 2;
        continue;
      }

      if (line[i] === ':') {
        push('colon', ':', i + 1, i + 2);
        i++;
        const textStart = i;
        while (i < line.length && line[i] === ' ') i++;
        const text = line.slice(i).trimEnd();
        if (text.length) {
          push('text', text, i + 1, i + 1 + text.length);
          i = line.length;
        } else {
          i = textStart;
        }
        continue;
      }

      if (line[i] === ',') {
        push('comma', ',', i + 1, i + 2);
        i++;
        continue;
      }

      if (line[i] === '"') {
        const start = i;
        i++;
        let value = '';
        while (i < line.length && line[i] !== '"') {
          value += line[i];
          i++;
        }
        if (i < line.length && line[i] === '"') i++;
        push('string', value, start + 1, i + 1);
        continue;
      }

      if (/[A-Za-z_]/.test(line[i]!)) {
        const start = i;
        i++;
        while (i < line.length && /[A-Za-z0-9_]/.test(line[i]!)) i++;
        const value = line.slice(start, i);
        const kind = KEYWORDS.has(value.toLowerCase()) ? 'keyword' : 'identifier';
        push(kind, value, start + 1, i + 1);
        continue;
      }

      push('text', line.slice(i), i + 1, line.length + 1);
      break;
    }

    tokens.push({
      kind: 'newline',
      value: '\n',
      line: lineNo,
      column: line.length + 1,
      endLine: lineNo,
      endColumn: line.length + 1,
    });
  }

  tokens.push({
    kind: 'eof',
    value: '',
    line: lines.length || 1,
    column: 1,
    endLine: lines.length || 1,
    endColumn: 1,
  });

  return tokens;
}
