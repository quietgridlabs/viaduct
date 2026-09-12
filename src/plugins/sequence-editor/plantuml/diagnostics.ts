export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code: string;
}

export function diagnostic(
  severity: DiagnosticSeverity,
  message: string,
  line: number,
  column: number,
  code: string,
  end?: { endLine?: number; endColumn?: number }
): Diagnostic {
  return {
    severity,
    message,
    line,
    column,
    endLine: end?.endLine,
    endColumn: end?.endColumn,
    code,
  };
}
