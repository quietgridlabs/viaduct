import { Box } from '@chakra-ui/react';
import type { QuackBubbleProps } from './types';

/** Cartoon speech bubble — tail points at the duck. */
export default function QuackBubble({ quip, side }: QuackBubbleProps) {
  const tail =
    side === 'below'
      ? {
          top: '-6px',
          left: '14px',
          borderTopWidth: '1.5px',
          borderLeftWidth: '1.5px',
        }
      : side === 'above'
        ? {
            bottom: '-6px',
            left: '50%',
            marginLeft: '-4.5px',
            borderBottomWidth: '1.5px',
            borderRightWidth: '1.5px',
            borderTopWidth: '0',
            borderLeftWidth: '0',
          }
        : {
            top: 'calc(50% - 4.5px)',
            right: '-6px',
            borderTopWidth: '1.5px',
            borderRightWidth: '1.5px',
          };

  const className =
    side === 'above'
      ? 'qk-bubble qk-bubble-below'
      : side === 'below'
        ? 'qk-bubble'
        : 'qk-bubble qk-bubble-left';

  return (
    <Box
      key={quip.id}
      className={className}
      style={{ '--qk-tilt': `${quip.tilt}deg` } as React.CSSProperties}
      position="relative"
      px="10px"
      py="9px"
      minH="28px"
      display="inline-flex"
      alignItems="center"
      lineHeight="1.35"
      borderRadius="12px"
      borderWidth="1.5px"
      borderColor="border.strong"
      bg="bg.dialog"
      color="fg.default"
      fontSize="xs"
      fontWeight="700"
      whiteSpace="nowrap"
      boxShadow="float"
      _before={{
        content: '""',
        position: 'absolute',
        w: '9px',
        h: '9px',
        bg: 'bg.dialog',
        borderColor: 'border.strong',
        transform: 'rotate(45deg)',
        ...tail,
      }}
    >
      {quip.text}
    </Box>
  );
}
