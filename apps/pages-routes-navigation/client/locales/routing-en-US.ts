export default {
  backToList: 'Back to list',
  keepEditing: 'Keep editing',
  discardAction: 'Discard draft',
  discardDescription:
    'Your draft has not been saved. Discard it and leave this page?',

  title: 'Pages, routes and navigation',
  intro:
    'Explore project pages, nested overlays, report tabs and access rules.',
  fixtures:
    'The project and task records are public fictional fixtures. Draft previews do not write to a database.',
  business: 'Projects',
  projects: 'Project list',
  insights: 'Insights',
  reports: 'Project reports',
  summary: 'Summary',
  owners: 'Owners',
  reportViews: 'Report views',
  projectPage: 'Open as a full page',
  workspace: 'Open workspace',
  workspaceDescription:
    'This page shares its component with a covering child route and names the project in the breadcrumb.',
  newDraft: 'New draft',
  projectName: 'Project name',
  owner: 'Owner',
  search: 'Search projects',
  noMatches: 'No matching projects. Clear the search to see all projects.',
  tasks: 'Tasks',
  notFound: 'The requested demonstration record does not exist.',
  close: 'Close',
  backToProject: 'Back to project',
  taskPath:
    'Project {{projectId}}, task {{taskId}}. Closing returns to the project drawer.',
  preview: 'Preview draft',
  finishPreview: 'Finish preview',
  draftOnly:
    'Try the route and form. This draft is not saved to the server and will be discarded when you leave.',
  draftPreview: 'Draft preview: {{name}}',
  discard: 'Discard this unsaved draft?',
  exports: 'Export instructions',
  exportsDescription:
    'This page is appended to the reports group from a separate contribution in the same application.',
  snapshot: 'Reporting snapshot',
  originalDescription: 'The original reporting contribution.',
  customDescription:
    'This application replaced the reporting plugin component. Its URL, title, permissions and owner remain unchanged.',
  adminNotes: 'Administrator notes',
  adminDescription:
    'This page requires unrestricted access. Its child opts out of its own check but cannot bypass this parent.',
  openChild: 'Open child page',
  adminChildDescription:
    'This child uses authz: skip. The unrestricted parent still guards the entire route.',
  publicProjects: 'Public project information',
  publicDescription:
    'Visitors and signed-in users can open this optional route. It uses the standalone layout.',
  welcome: 'Guest welcome',
  welcomeDescription:
    'This guest-only page is available before sign-in. Signed-in visitors leave for the redirect destination or home.',
  loaded: 'Try a slow page',
  loadedDescription:
    'The route component loaded after a short delay. The application showed its standard loading state first.',
  error: 'Try a page error',
  unknown: 'Try an unknown address',
  examples: 'Routing examples',
  permissionHint:
    'Project pages require the Projects page grant; New draft also requires its own grant. Administrators can assign these in System settings → Permission management → Roles and permissions, and System settings → Users. The links here also let you try denied addresses.',
  summaryCount: '{{count}} sample projects',
};
