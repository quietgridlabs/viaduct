import AppFooter, { SUPPORT_EMAIL } from '@components/AppFooter';
import { usePageScroll } from '@hooks/usePageScroll';
import { CLOUD_URL } from '@/seo';
import { Box, Button, Heading, Link, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';

/**
 * Community documentation — local editor only.
 * Cloud team features are linked out, not sold as if they ship here.
 */
export default function DocsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  usePageScroll();

  const returnTo =
    (location.state as { from?: string } | null)?.from ||
    (() => {
      try {
        return sessionStorage.getItem('c4-docs-return') || '/editor';
      } catch {
        return '/editor';
      }
    })();

  return (
    <Box minH="100vh" display="flex" flexDirection="column" bg="bg.canvas" color="fg.default">
      <Box
        as="header"
        borderBottomWidth="1px"
        borderColor="border.default"
        px={{ base: '20px', md: '48px' }}
        py="14px"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap="12px"
      >
        <Text fontWeight="700">{t('footer_brand')}</Text>
        <Button asChild size="sm" variant="outline">
          <RouterLink to={returnTo}>Back to editor</RouterLink>
        </Button>
      </Box>

      <Box
        as="main"
        flex="1"
        maxW="720px"
        w="full"
        mx="auto"
        px={{ base: '20px', md: '32px' }}
        py={{ base: '32px', md: '48px' }}
      >
        <VStack align="stretch" gap="28px">
          <Box>
            <Heading as="h1" size="lg" mb="10px">
              Viaduct Community
            </Heading>
            <Text color="fg.muted" fontSize="md" lineHeight="1.7">
              A local C4 modeling editor that runs in your browser. Models stay on this machine
              (browser storage / JSON import-export). No account required.
            </Text>
          </Box>

          <Box as="section">
            <Heading as="h2" size="md" mb="8px">
              What you can do here
            </Heading>
            <Box as="ul" color="fg.muted" fontSize="sm" lineHeight="1.7" ps="18px">
              <Box as="li" mb="6px">
                Draw C4 diagrams at system, container, component and code levels.
              </Box>
              <Box as="li" mb="6px">
                Attach markdown docs and PlantUML sequence diagrams to elements.
              </Box>
              <Box as="li" mb="6px">
                Model API endpoints / OpenAPI contracts and ER schemas on datastores.
              </Box>
              <Box as="li" mb="6px">
                Design Magic flows and play them back on the canvas.
              </Box>
              <Box as="li" mb="6px">Browse the service catalog for the open model.</Box>
              <Box as="li">Import and export the model as JSON.</Box>
            </Box>
          </Box>

          <Box as="section">
            <Heading as="h2" size="md" mb="8px">
              Getting started
            </Heading>
            <Text color="fg.muted" fontSize="sm" lineHeight="1.7" mb="10px">
              Open the{' '}
              <Link asChild color="brand.text">
                <RouterLink to="/editor">editor</RouterLink>
              </Link>
              , start from the welcome dialog (blank or starter model), then use Import/Export in
              the tools rail to move models between machines.
            </Text>
            <Text color="fg.muted" fontSize="sm" lineHeight="1.7">
              Settings (toolbar) cover theme and canvas preferences. Docs and sequences open from
              element actions on the diagram.
            </Text>
          </Box>

          <Box as="section">
            <Heading as="h2" size="md" mb="8px">
              Team features (Cloud)
            </Heading>
            <Text color="fg.muted" fontSize="sm" lineHeight="1.7" mb="10px">
              Hosted MCP for coding agents, live collaboration, change sets, webhooks, org SSO and
              multi-project domains are part of{' '}
              <Link href={CLOUD_URL} color="brand.text" target="_blank" rel="noreferrer">
                Viaduct Cloud
              </Link>
              — not this Community build.
            </Text>
          </Box>

          <Box as="section">
            <Heading as="h2" size="md" mb="8px">
              Support
            </Heading>
            <Text color="fg.muted" fontSize="sm" lineHeight="1.7">
              Questions or bugs:{' '}
              <Link href={`mailto:${SUPPORT_EMAIL}`} color="brand.text">
                {SUPPORT_EMAIL}
              </Link>
              .
            </Text>
          </Box>
        </VStack>
      </Box>

      <AppFooter />
    </Box>
  );
}
