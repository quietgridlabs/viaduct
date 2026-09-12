import { Box } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';

/** Neutral loading surface for lazily loaded routes. */
export default function RouteFallback() {
  return (
    <Box h="100%" minH="100dvh" display="grid" placeItems="center" bg="bg.canvas">
      <QuackSpinner size="xl" />
    </Box>
  );
}
