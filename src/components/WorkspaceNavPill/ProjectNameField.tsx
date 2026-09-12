import { Box, HStack, Input, Text } from '@chakra-ui/react';
import { Layers } from 'lucide-react';
import { forwardRef } from 'react';
import { NAME_FIELD_MAX_W, NAV_ICON_SIZE, PILL_CONTROL_H } from './constants';
import type { ProjectNameFieldProps } from './types';

/**
 * The project's name, editable in place.
 *
 * The ref belongs to the caller: clicking the canvas does not blur this field
 * on its own, so the pill reaches in and blurs it — and the blur is what
 * commits the rename.
 */
const ProjectNameField = forwardRef<HTMLInputElement, ProjectNameFieldProps>(
  function ProjectNameField({ value, onChange, onCommit, onRevert, disabled, viewOnly }, ref) {
    return (
      <HStack gap="6px" px="6px" minW={0} maxW={NAME_FIELD_MAX_W} flexShrink={1}>
        <Box flexShrink={0} color="brand.emphasis.soft" lineHeight={0}>
          <Layers size={NAV_ICON_SIZE} />
        </Box>
        <Input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              onRevert();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Project name"
          spellCheck={false}
          variant="flushed"
          fontWeight="600"
          fontSize="sm"
          color="fg.default"
          px="0"
          h={PILL_CONTROL_H}
          minH={PILL_CONTROL_H}
          borderColor="transparent"
          _hover={{ borderColor: 'border.glass' }}
          _focus={{ borderColor: 'brand.solid', boxShadow: 'none' }}
        />
        {viewOnly ? (
          <Text
            as="span"
            fontSize="10px"
            fontWeight="700"
            color="brand.emphasis.soft"
            flexShrink={0}
            textTransform="uppercase"
          >
            view
          </Text>
        ) : null}
      </HStack>
    );
  }
);

export default ProjectNameField;
