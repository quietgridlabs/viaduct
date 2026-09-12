import { useColorMode } from '@contexts/ColorModeContext';
import { Box, Field, Textarea } from '@chakra-ui/react';
import { CSSProperties, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  label?: string;
  placeholder?: string;
}

const getLanguage = (language: string): string => {
  const langMap: Record<string, string> = {
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    python: 'python',
    py: 'python',
    html: 'html',
    css: 'css',
    ruby: 'ruby',
    rb: 'ruby',
    java: 'java',
    php: 'php',
    go: 'go',
    rust: 'rust',
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    cs: 'csharp',
    swift: 'swift',
    kotlin: 'kotlin',
    scala: 'scala',
    sql: 'sql',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    markdown: 'markdown',
    md: 'markdown',
  };

  return langMap[language?.toLowerCase()] || 'javascript';
};

const CodeEditor = ({
  value,
  onChange,
  language = 'javascript',
  label,
  placeholder,
}: CodeEditorProps) => {
  const { t } = useTranslation();
  const { mode, chrome } = useColorMode();
  const [editorValue, setEditorValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditorValue(value || '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditorValue(newValue);
    onChange(newValue);
  };

  const customStyle: { [key: string]: CSSProperties } = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      ...vscDarkPlus['pre[class*="language-"]'],
      margin: 0,
      padding: '12px',
      backgroundColor:
        mode === 'light' ? 'rgba(15, 39, 68, 0.06)' : 'rgba(0, 0, 0, 0.2)',
      border: `1px solid ${chrome.inputBorder}`,
      borderRadius: '4px',
      cursor: 'pointer',
      maxHeight: '200px',
      overflowY: 'auto',
    },
  };

  return (
    <Box mt="16px">
      {label && (
        <Field.Root mb="8px">
          <Field.Label color="fg.muted">{label}</Field.Label>
        </Field.Root>
      )}

      {isEditing ? (
        <Textarea
          value={editorValue}
          onChange={handleChange}
          placeholder={placeholder}
          onBlur={() => setIsEditing(false)}
          data-testid="input_code"
          autoFocus
          rows={8}
          fontFamily="mono"
          bg="bg.muted"
          color="fg.default"
          borderColor="border.input"
          _hover={{ borderColor: 'border.strong' }}
          _focus={{
            borderColor: 'border.focus',
            boxShadow: `0 0 0 1px ${chrome.borderFocus}`,
          }}
        />
      ) : (
        <Box cursor="pointer" onClick={() => setIsEditing(true)} title={t('click_to_edit')}>
          {editorValue ? (
            <SyntaxHighlighter
              data-testid="input_code"
              language={getLanguage(language)}
              style={customStyle}
              wrapLines
              wrapLongLines
            >
              {editorValue}
            </SyntaxHighlighter>
          ) : (
            <Box
              data-testid="input_code"
              bg="bg.muted"
              borderWidth="1px"
              borderColor="border.input"
              borderRadius="4px"
              p="12px"
              color="fg.subtle"
              fontStyle="italic"
              minH="200px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {placeholder || t('enter_code_here')}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CodeEditor;
