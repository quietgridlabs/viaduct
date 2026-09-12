import AppFooter from '@components/AppFooter';
import QglMark from '@components/QglMark';
import { useColorMode } from '@contexts/ColorModeContext';
import { usePageScroll } from '@hooks/usePageScroll';
import { Box, Heading, IconButton, Link, Text } from '@chakra-ui/react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CONTACT_EMAIL,
  LEGAL_UPDATED,
  type LegalSection,
} from './legalContent';

type Props = {
  title: string;
  intro: string;
  sections: LegalSection[];
  /** The other document, linked at the foot — people look for the pair. */
  sibling: { to: string; label: string };
};

/**
 * The frame both legal documents share: a plain reading column, a header that
 * leads back to the site, and the date the text was last changed where a
 * reader looks for it — at the top, not buried at the end.
 */
export default function LegalPage({ title, intro, sections, sibling }: Props) {
  const { mode, toggleColorMode } = useColorMode();
  const { t } = useTranslation();
  usePageScroll();
  const themeLabel = mode === 'light' ? t('landing_theme_dark') : t('landing_theme_light');

  return (
    <Box minH="100dvh" bg="bg.canvas" color="fg.default" display="flex" flexDirection="column">
      <Box
        as="header"
        borderBottomWidth="1px"
        borderColor="border.default"
        bg="bg.nav"
        px={{ base: '20px', md: '24px' }}
        py="14px"
      >
        <Box
          maxW="820px"
          mx="auto"
          display="flex"
          alignItems="center"
          gap="12px"
        >
          <Link
            asChild
            color="fg.muted"
            _hover={{ color: 'brand.text' }}
            display="inline-flex"
            alignItems="center"
            gap="6px"
            fontSize="sm"
            fontWeight="600"
          >
            <RouterLink to="/">
              <ArrowLeft size={16} aria-hidden />
              Viaduct
            </RouterLink>
          </Link>
          <Box flex="1" display="inline-flex" justifyContent="center" aria-hidden>
            <QglMark size={20} />
          </Box>
          <IconButton
            size="sm"
            variant="ghost"
            color="fg.muted"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={toggleColorMode}
            _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
          >
            {mode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </IconButton>
        </Box>
      </Box>

      <Box
        as="main"
        flex="1"
        px={{ base: '20px', md: '24px' }}
        py={{ base: '40px', md: '64px' }}
      >
        <Box maxW="720px" mx="auto">
          <Heading
            as="h1"
            fontSize={{ base: '2xl', md: '3xl' }}
            fontWeight="800"
            letterSpacing="-0.025em"
            mb="8px"
          >
            {title}
          </Heading>
          <Text fontSize="xs" fontFamily="mono" color="fg.subtle" mb="24px">
            Last updated {LEGAL_UPDATED}
          </Text>
          <Text fontSize="md" color="fg.muted" lineHeight="1.8" mb="40px">
            {intro}
          </Text>

          {sections.map((section) => (
            <Box as="section" key={section.id} id={section.id} mb="32px">
              <Heading
                as="h2"
                fontSize="lg"
                fontWeight="700"
                letterSpacing="-0.015em"
                mb="10px"
                /* Anchored, so a support reply can point at one clause. */
                scrollMarginTop="24px"
              >
                {section.heading}
              </Heading>
              {section.blocks.map((block, i) =>
                block.kind === 'p' ? (
                  <Text key={i} fontSize="sm" color="fg.muted" lineHeight="1.8" mb="10px">
                    {block.text}
                  </Text>
                ) : (
                  <Box key={i} as="ul" pl="18px" mb="10px">
                    {block.items.map((entry) => (
                      <Box
                        as="li"
                        key={entry}
                        fontSize="sm"
                        color="fg.muted"
                        lineHeight="1.8"
                        mb="4px"
                      >
                        {entry}
                      </Box>
                    ))}
                  </Box>
                )
              )}
            </Box>
          ))}

          <Box
            mt="48px"
            pt="24px"
            borderTopWidth="1px"
            borderColor="border.default"
            display="flex"
            gap="16px"
            flexWrap="wrap"
            fontSize="sm"
          >
            <Link asChild color="brand.text" fontWeight="600">
              <RouterLink to={sibling.to}>{sibling.label}</RouterLink>
            </Link>
            <Link
              href={`mailto:${CONTACT_EMAIL}`}
              color="fg.muted"
              _hover={{ color: 'brand.text' }}
            >
              {CONTACT_EMAIL}
            </Link>
          </Box>
        </Box>
      </Box>

      <AppFooter />
    </Box>
  );
}
