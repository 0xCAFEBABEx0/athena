// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import { getSentryEnvironment } from './src/utilities/env'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: getSentryEnvironment(),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Sentry v11 collects everything when dataCollection is unset. Keep the v10
  // defaults so cookies (payload-token), bodies and user info stay out.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    graphQL: { document: false, variables: false },
  },

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
