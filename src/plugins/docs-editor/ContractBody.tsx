import { Box } from '@chakra-ui/react';
import JsonViewer from '@components/common/JsonViewer';
import ProtoViewer from '@components/common/ProtoViewer';
import type { ContractViewer } from './embedLanguage';

type Props = {
  value: string;
  viewer: ContractViewer;
  /** Unique within the page — Monaco keys its models by path. */
  modelId: string;
};

/**
 * One contract body inside a documentation embed, rendered with the same Monaco
 * viewers the contract editors use. Free text falls back to a plain block: a
 * prose response has no grammar, and folding gutters around a sentence are noise.
 */
export default function ContractBody({ value, viewer, modelId }: Props) {
  if (viewer === 'protobuf') {
    return <ProtoViewer value={value} modelId={modelId} />;
  }

  if (viewer === 'json') {
    let parsed: unknown = value;
    try {
      parsed = JSON.parse(value);
    } catch {
      /* Not valid JSON after all — JsonViewer shows the raw string instead. */
    }
    return <JsonViewer value={parsed} modelId={modelId} />;
  }

  return (
    <Box
      as="pre"
      fontSize="xs"
      fontFamily="mono"
      whiteSpace="pre-wrap"
      wordBreak="break-word"
      m="0"
      p="8px"
      borderRadius="6px"
      bg="bg.muted"
      color="fg.default"
    >
      {value}
    </Box>
  );
}
