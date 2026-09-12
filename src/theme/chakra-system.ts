import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { POPPER_LAYER_Z } from './sidePanelLayout';
import { C4_BASE_COLORS, darkChrome, lightChrome } from './theme';

const config = defineConfig({
  globalCss: {
    'html, body': {
      bg: 'bg.canvas',
      color: 'fg.default',
      fontFamily: 'body',
    },
    /* Zag sets `z-index: var(--z-index)` inline on positioners; without the
       variable they collapse to `auto` and fall behind panels and overlays. */
    '[data-part="positioner"]': {
      '--z-index': POPPER_LAYER_Z,
    },
    /* Menus / selects / comboboxes — visible highlight on dark */
    '[data-scope="menu"] [data-part="item"][data-highlighted], [data-scope="menu"] [data-part="item"]:hover':
      {
        bg: 'bg.list.hover !important',
      },
    '[data-scope="select"] [data-part="item"][data-highlighted], [data-scope="combobox"] [data-part="item"][data-highlighted]':
      {
        bg: 'bg.list.hover !important',
      },
    '[data-scope="tooltip"] [data-part="content"]': {
      transitionProperty: 'opacity, transform',
    },
    '[data-scope="menu"] [data-part="content"], [data-scope="select"] [data-part="content"], [data-scope="combobox"] [data-part="content"]':
      {
        py: '4px',
        bg: 'bg.dialog',
        color: 'fg.default',
        boxShadow: 'float',
        borderWidth: '1px',
        borderColor: 'border.glass',
        borderRadius: '8px',
      },
    '[data-scope="select"] [data-part="trigger"], [data-scope="combobox"] [data-part="trigger"]':
      {
        bg: 'bg.dialog',
        color: 'fg.default',
      },
    '[data-scope="menu"] [data-part="item"], [data-scope="select"] [data-part="item"], [data-scope="combobox"] [data-part="item"]':
      {
        px: '12px',
        py: '8px',
        borderRadius: '6px',
        mx: '4px',
      },
  },
  theme: {
    /* Chakra's default ghost/outline/subtle button hover fills with
       `colorPalette.subtle`, which — with no colorPalette set, the common case
       for a plain Cancel/Close button — resolves to the built-in gray scale:
       `gray.900` in dark mode. That is nearly the same shade as this app's own
       dark panels (`bg.dialog` is `#1a1d24`), so the hover was there but
       essentially invisible against them. Every button that sets its own
       `_hover` already overrides this per-instance; this only changes the
       ones that were silently falling back to Chakra's default, replacing it
       with the same `bg.list.hover` token used for hover everywhere else in
       the app (list rows, toolbar icons, menu items), so the fill is both
       visible and consistent rather than a one-off patch. */
    recipes: {
      /*
       * A field you can type into says so when the pointer reaches it.
       *
       * Every field drawn through `fieldSurfaceStyles` already did; the ones
       * dropped in as a bare `<Input>` — a link's label, a dialog's search box
       * — sat inert under the pointer, and next to their neighbours that read
       * as "this one is not for editing". Fixed in the recipe, like the
       * button hover above, so it holds for every field including the next
       * one somebody adds. Disabled and read-only fields are excluded by
       * selector rather than by hoping the disabled style wins the cascade —
       * inside `:where()`, so the exclusion adds no specificity and a
       * per-instance `_hover` (a red border on a bad address, say) still wins
       * over this: same weight, applied later.
       */
      input: {
        variants: {
          variant: {
            outline: {
              '&:hover:where(:not(:disabled, [readonly], [data-disabled]))': { borderColor: 'border.strong' },
            },
          },
        },
      },
      textarea: {
        variants: {
          variant: {
            outline: {
              '&:hover:where(:not(:disabled, [readonly], [data-disabled]))': { borderColor: 'border.strong' },
            },
          },
        },
      },
      button: {
        variants: {
          variant: {
            ghost: {
              _hover: { bg: 'bg.list.hover' },
              _expanded: { bg: 'bg.list.hover' },
            },
            outline: {
              _hover: { bg: 'bg.list.hover' },
              _expanded: { bg: 'bg.list.hover' },
            },
            subtle: {
              _hover: { bg: 'bg.list.hover' },
              _expanded: { bg: 'bg.list.hover' },
            },
          },
        },
      },
    },
    /* `slots` repeats the full list from the default config on purpose: the
       merge is by array index, so a shorter list here would overwrite the
       first slot names rather than add to them. */
    slotRecipes: {
      select: {
        slots: defaultConfig.theme?.slotRecipes?.select?.slots ?? [],
        variants: {
          variant: {
            outline: {
              trigger: {
                '&:hover:where(:not(:disabled, [data-disabled]))': { borderColor: 'border.strong' },
              },
            },
          },
        },
      },
      combobox: {
        slots: defaultConfig.theme?.slotRecipes?.combobox?.slots ?? [],
        variants: {
          variant: {
            outline: {
              input: {
                '&:hover:where(:not(:disabled, [readonly], [data-disabled]))': { borderColor: 'border.strong' },
              },
            },
          },
        },
      },
      nativeSelect: {
        slots: defaultConfig.theme?.slotRecipes?.nativeSelect?.slots ?? [],
        variants: {
          variant: {
            outline: {
              field: {
                '&:hover:where(:not(:disabled, [data-disabled]))': { borderColor: 'border.strong' },
              },
            },
          },
        },
      },
    },
    tokens: {
      fonts: {
        body: {
          value:
            "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
        },
        heading: {
          value:
            "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        mono: {
          value:
            "'JetBrains Mono', 'GitLab Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
      },
      colors: {
        brand: {
          solid: { value: '#f09a05' },
          soft: { value: '#f5b23c' },
          dark: { value: '#c47c00' },
        },
      },
    },
    semanticTokens: {
      colors: {
        'bg.canvas': {
          value: { _light: lightChrome.pageBg, _dark: darkChrome.pageBg },
        },
        'bg.nav': {
          value: { _light: lightChrome.navBg, _dark: darkChrome.navBg },
        },
        'bg.dialog': {
          value: { _light: lightChrome.dialogBg, _dark: darkChrome.dialogBg },
        },
        'bg.panel': {
          value: { _light: lightChrome.dialogBg, _dark: darkChrome.dialogBg },
        },
        'bg.drawer': {
          value: { _light: lightChrome.drawerBg, _dark: darkChrome.drawerBg },
        },
        'bg.glass': {
          value: {
            _light: 'rgba(255, 255, 255, 0.72)',
            _dark: 'rgba(28, 26, 32, 0.78)',
          },
        },
        'border.glass': {
          value: {
            _light: 'rgba(40, 28, 18, 0.16)',
            _dark: 'rgba(255, 255, 255, 0.13)',
          },
        },
        /* Version-comparison palette — plain-DOM twin of DIFF_COLORS in
           theme/diffColors.ts. That module holds the same values as raw
           hex/rgba for the canvas accent pipeline, which does pixel maths on
           the string and cannot resolve a CSS variable; these tokens are for
           everywhere else (the comparison panel) that just needs a colour on
           a Chakra prop. Keep both in sync if this palette changes. */
        'diff.added': { value: { _light: '#059669', _dark: '#34d399' } },
        'diff.addedWash': {
          value: {
            _light: 'rgba(5, 150, 105, 0.10)',
            _dark: 'rgba(52, 211, 153, 0.12)',
          },
        },
        'diff.changed': { value: { _light: '#4f46e5', _dark: '#818cf8' } },
        'diff.changedWash': {
          value: {
            _light: 'rgba(79, 70, 229, 0.10)',
            _dark: 'rgba(129, 140, 248, 0.14)',
          },
        },
        'diff.gone': { value: { _light: '#94a3b8', _dark: '#6b7688' } },
        'bg.muted': {
          value: { _light: lightChrome.paperMuted, _dark: darkChrome.paperMuted },
        },
        'bg.subtle': {
          value: { _light: lightChrome.iconButtonBg, _dark: darkChrome.iconButtonBg },
        },
        'bg.subtle.hover': {
          value: { _light: lightChrome.iconButtonHover, _dark: darkChrome.iconButtonHover },
        },
        'bg.list.hover': {
          value: { _light: lightChrome.listHover, _dark: darkChrome.listHover },
        },
        'bg.list.selected': {
          value: { _light: lightChrome.listSelected, _dark: darkChrome.listSelected },
        },
        'fg.default': {
          value: { _light: lightChrome.textPrimary, _dark: darkChrome.textPrimary },
        },
        'fg.muted': {
          value: { _light: lightChrome.textSecondary, _dark: darkChrome.textSecondary },
        },
        'fg.subtle': {
          value: { _light: lightChrome.textMuted, _dark: darkChrome.textMuted },
        },
        'border.default': {
          value: { _light: lightChrome.border, _dark: darkChrome.border },
        },
        'border.strong': {
          value: { _light: lightChrome.borderStrong, _dark: darkChrome.borderStrong },
        },
        'border.input': {
          value: { _light: lightChrome.inputBorder, _dark: darkChrome.inputBorder },
        },
        /* Focus is neutral by design — a field must not change colour with the
           C4 level the dialog happens to belong to. */
        'border.focus': {
          value: { _light: lightChrome.borderFocus, _dark: darkChrome.borderFocus },
        },
        'bg.neutral.emphasis': {
          value: { _light: lightChrome.neutralSolid, _dark: darkChrome.neutralSolid },
        },
        'bg.neutral.emphasis.hover': {
          value: {
            _light: lightChrome.neutralSolidHover,
            _dark: darkChrome.neutralSolidHover,
          },
        },
        'fg.onNeutral': {
          value: { _light: lightChrome.onNeutralSolid, _dark: darkChrome.onNeutralSolid },
        },
        'accent.solid': {
          value: { _light: lightChrome.accent, _dark: darkChrome.accent },
        },
        'accent.soft': {
          value: { _light: lightChrome.accentSoft, _dark: darkChrome.accentSoft },
        },
        'brand.solid': {
          value: { _light: lightChrome.brand, _dark: darkChrome.brand },
        },
        'brand.soft': {
          value: { _light: lightChrome.brandSoft, _dark: darkChrome.brandSoft },
        },
        'brand.dark': {
          value: { _light: lightChrome.brandDark, _dark: darkChrome.brandDark },
        },
        /* The pair that carries text. `brand.solid` is a fill and a border
           weight; on type it is thin, so anything with words in it takes
           this one instead. */
        'brand.text': {
          value: { _light: lightChrome.brandText, _dark: darkChrome.brandText },
        },
        /* Filled actions. Dark enough for white type on either theme — 9.5:1
           on light, 7.9:1 on dark. */
        /*
         * The one saturated thing in the chrome: amber, on a filled primary
         * action and nowhere else.
         *
         * Its type is near-black, not white — white on this amber is 2.2:1 and
         * unreadable, while the near-black from the same palette is 10.9:1.
         * That is `fg.on.brand`, and every filled action takes it.
         */
        'bg.brand.emphasis': {
          value: { _light: '#f09a05', _dark: '#f09a05' },
        },
        'bg.brand.emphasis.hover': {
          value: { _light: '#d88700', _dark: '#f5b23c' },
        },
        'fg.on.brand': {
          value: { _light: '#0a0a0c', _dark: '#0a0a0c' },
        },
        /* The saturated accent — dots, icons, sliders, highlights. `brand.solid`
           is the graphite chrome; this is the amber that reads as "look here". */
        'brand.emphasis': {
          value: { _light: '#f09a05', _dark: '#f09a05' },
        },
        'brand.emphasis.soft': {
          value: { _light: '#f5b23c', _dark: '#f5b23c' },
        },
        'brand.emphasis.dark': {
          value: { _light: '#c47c00', _dark: '#d88700' },
        },
        'fg.brand.emphasis': {
          value: { _light: '#c47c00', _dark: '#f5b23c' },
        },
        'border.brand.emphasis': {
          value: {
            _light: 'rgba(240, 154, 5, 0.55)',
            _dark: 'rgba(245, 178, 60, 0.5)',
          },
        },
        'bg.brand.emphasis.subtle': {
          value: {
            _light: 'rgba(240, 154, 5, 0.08)',
            _dark: 'rgba(240, 154, 5, 0.14)',
          },
        },
        /* Soft washes stay on the neutral: they sit behind text, and behind
           text the amber has no contrast to give. */
        'bg.brand.subtle': {
          value: {
            _light: 'rgba(71, 77, 89, 0.07)',
            _dark: 'rgba(169, 153, 138, 0.14)',
          },
        },
        'bg.brand.muted': {
          value: {
            _light: 'rgba(71, 77, 89, 0.11)',
            _dark: 'rgba(169, 153, 138, 0.2)',
          },
        },
        'border.brand': {
          value: {
            _light: 'rgba(71, 77, 89, 0.4)',
            _dark: 'rgba(169, 153, 138, 0.4)',
          },
        },
        /* Canvas levels — same source as the diagram nodes (see theme.ts). */
        'c4.system': {
          value: { _light: C4_BASE_COLORS.system.light, _dark: C4_BASE_COLORS.system.dark },
        },
        'c4.container': {
          value: { _light: C4_BASE_COLORS.container.light, _dark: C4_BASE_COLORS.container.dark },
        },
        'c4.component': {
          value: { _light: C4_BASE_COLORS.component.light, _dark: C4_BASE_COLORS.component.dark },
        },
        'c4.code': {
          value: { _light: C4_BASE_COLORS.code.light, _dark: C4_BASE_COLORS.code.dark },
        },
        'c4.connection': {
          value: { _light: C4_BASE_COLORS.connection.light, _dark: C4_BASE_COLORS.connection.dark },
        },
      },
      shadows: {
        raised: {
          value: { _light: lightChrome.shadowSm, _dark: darkChrome.shadowSm },
        },
        panel: {
          value: { _light: lightChrome.shadowMd, _dark: darkChrome.shadowMd },
        },
        float: {
          value: { _light: lightChrome.shadow, _dark: darkChrome.shadow },
        },
        inset: {
          value: { _light: lightChrome.shadowInset, _dark: darkChrome.shadowInset },
        },
      },
    },
  },
});

export const chakraSystem = createSystem(defaultConfig, config);
