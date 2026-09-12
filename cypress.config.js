import { defineConfig } from 'cypress'
import vitePreprocessor from 'cypress-vite'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173/',
    viewportWidth: 1280,
    viewportHeight: 768,
    /* The screenshot rig is not a test — it asserts nothing about the product
       and rewrites files in src/assets. Hidden from a plain run, and let
       through only by the flag its own command passes. */
    excludeSpecPattern: process.env.CYPRESS_SHOTS ? [] : ['**/marketingShots.cy.ts'],
    setupNodeEvents(on, config) {
      on('file:preprocessor', vitePreprocessor())
      /* The screenshot rig wants the picture to be the app and nothing else.
         Electron shoots the window, so the window is made the size of the
         viewport; without this an 1800x1125 app came back as a 2560x1440
         window with the app in one corner and scrollbars around it.
         Only for the rig — every other spec is written for 1280x768, and
         resizing the window under them is not this rig's business. */
      if (config.env.SHOTS) {
        on('before:browser:launch', (browser, launchOptions) => {
          if (browser.name === 'electron') {
            /* Literals, not the resolved viewport: read from config here the
               window came out 2560x1536 and the capture with it. */
            launchOptions.preferences.width = 1800
            launchOptions.preferences.height = 1125
          }
          return launchOptions
        })
      }
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })
    },
  },
})