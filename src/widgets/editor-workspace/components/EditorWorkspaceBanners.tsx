import type { User } from '@shared/api';
import type { ProjectSnapshot } from '@features/versions';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import { useTranslation } from 'react-i18next';

type Props = {
  viewingVersion: boolean;
  versionMeta: ProjectSnapshot | null;
  projectMode: boolean;
  user: User | null;
  viewOnly: boolean;
  onBackToLive: () => void;
  onSignIn: () => void;
};

/** Community: guest/sign-in banners removed; version banner kept for shell compatibility. */
export default function EditorWorkspaceBanners({
  viewingVersion,
  versionMeta,
  onBackToLive,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {viewingVersion && versionMeta && (
        <HStack
          position="fixed"
          top="64px"
          left="50%"
          transform="translateX(-50%)"
          zIndex={1640}
          px="14px"
          py="7px"
          gap="12px"
          borderRadius="10px"
          bg="bg.brand.emphasis.subtle"
          backdropFilter="blur(16px)"
          borderWidth="1px"
          borderColor="border.brand.emphasis"
          flexWrap="wrap"
          maxW="min(92vw, 620px)"
        >
          <Text fontSize="sm" color="fg.default">
            <Text as="span" fontWeight="700">
              {versionMeta.name}
            </Text>{' '}
            · {new Date(versionMeta.created_at ?? Date.now()).toLocaleDateString()}
          </Text>
          <Text
            fontSize="xs"
            fontWeight="700"
            letterSpacing="0.06em"
            textTransform="uppercase"
            color="fg.brand.emphasis"
          >
            {t('version_view_readonly')}
          </Text>
          <Button
            size="xs"
            variant="outline"
            color="fg.brand.emphasis"
            borderColor="border.brand.emphasis"
            onClick={onBackToLive}
          >
            {t('version_view_back')}
          </Button>
        </HStack>
      )}
    </>
  );
}

export function EditorWorkspaceLoading() {
  return (
    <Box h="100vh" display="grid" placeItems="center" bg="bg.canvas">
      <QuackSpinner size="xl" />
    </Box>
  );
}

export function EditorWorkspaceLoadError({
  loadError,
  onOpenProjects,
}: {
  loadError: string;
  user: User | null;
  projectId: string | undefined;
  onOpenProjects: () => void;
}) {
  return (
    <Box
      h="100vh"
      display="grid"
      placeItems="center"
      bg="bg.canvas"
      color="fg.default"
      gap="16px"
    >
      <Text>{loadError}</Text>
      <Button variant="ghost" color="brand.text" onClick={onOpenProjects}>
        Back to editor
      </Button>
    </Box>
  );
}
