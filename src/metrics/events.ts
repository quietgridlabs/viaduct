/**
 * The product event dictionary.
 *
 * Mirrors `server/src/metricEvents.js` — a server test compares the two lists,
 * so a name added on one side and forgotten on the other fails CI rather than
 * becoming a metric that silently never arrives.
 *
 * Names are `<area>.<action>`; the area doubles as the event category, which
 * the server derives rather than accepts.
 */
export const METRIC_EVENTS = [
  // Landing / auth
  'landing.opened',
  'landing.signin',
  'landing.try_local',
  'landing.access_request_sent',
  'auth.login_gitlab',
  'auth.login_google',
  'auth.login_github',
  'auth.login_success',
  'auth.login_failed',
  'auth.logout',

  // Session / project
  'session.started',
  'session.ended',
  'project.opened',
  'project.created',
  'project.shared_invite',

  // Editor
  'editor.level_changed',
  'editor.element_added',
  'editor.element_deleted',
  'editor.connection_added',
  'editor.clone_created',

  // Overlays / capabilities
  'docs.opened',
  'docs.saved',
  'sequence.opened',
  'sequence.saved',
  'flow.created',
  'flow.played',
  'catalog.opened',
  'export.image',
  'share.link_created',
  'share.group_added',
  'navigator.opened',
  'navigator.project_opened',
  'history.opened',
  'history.restored',
  'helper.opened',

  // AI assistant
  'assist.opened',
  'assist.suggested',
  'assist.accepted',
  'assist.rejected',
  'assist.review_run',
  'assist.flow_named',
  'assist.quota_exceeded',

  // Health
  'health.save_failed',
  'health.gitlab_reauth',
  'health.export_failed',
] as const;

export type MetricEvent = (typeof METRIC_EVENTS)[number];

/** What a metric may carry: enums, counts, flags — never identity or prose. */
export type MetricProps = Record<string, string | number | boolean | null | undefined>;
