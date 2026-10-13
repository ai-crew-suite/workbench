# Dependency Audit

## MUI v2 Packages

```bash
@mui/material @mui/icons-material @emotion/react @emotion/styled
```

## Strictly Required Core Dependencies

These packages are explicitly imported and called by your entry points, routing factories, and custom sidebar engine layers:

- **`@backstage/frontend-defaults`**: Provisions `createApp` [packages/backstage/app/src/App.tsx].
- **`@backstage/frontend-plugin-api`**: Provisions `createFrontendModule`, `createExtensionBlueprint`, and your core types [packages/backstage/app/src/App.tsx, packages/backstage/app/src/modules/nav/Sidebar.tsx].
- **`@backstage/plugin-app-react`**: Provisions `NavContentBlueprint` and core wrapper types [packages/backstage/app/src/modules/nav/Sidebar.tsx].
- **`@backstage/plugin-app-visualizer`**: Explicitly added to your feature array matrix [packages/backstage/app/src/App.tsx].
- **`@backstage/plugin-catalog`**: Explicitly added to your feature array matrix [packages/backstage/app/src/App.tsx].
- **`@backstage/plugin-notifications`**: Loaded directly inside `Sidebar.tsx` via `NotificationsSidebarItem` [packages/backstage/app/src/modules/nav/Sidebar.tsx].
- **`@backstage/plugin-search`**: Loaded directly inside `Sidebar.tsx` via `SidebarSearchModal` [packages/backstage/app/src/modules/nav/Sidebar.tsx].
- **`@backstage/plugin-user-settings`**: Loaded directly inside `Sidebar.tsx` via `UserSettingsSignInAvatar` [packages/backstage/app/src/modules/nav/Sidebar.tsx].
- **`@backstage/theme`**: Provisions `themes` mapping properties and the `UnifiedThemeProvider` layout [packages/backstage/app/src/App.tsx, packages/backstage/app/src/modules/nav/SidebarLogo.tsx].
- **`@backstage/ui`**: Mandated by your top-level layout css style injection import [packages/backstage/app/src/App.tsx].
- **`@backstage/core-components`**: Draws your entire layout navigation system (`Sidebar`, `SidebarDivider`, etc.) [packages/backstage/app/src/modules/nav/Sidebar.tsx].
- **`@material-ui/core` & `@material-ui/icons`**: Direct style hooks used by `makeStyles` and core structural vector elements (`SearchIcon`, `MenuIcon`) [packages/backstage/app/src/modules/nav/Sidebar.tsx, packages/backstage/app/src/modules/nav/SidebarLogo.tsx].
- **`react` & `react-dom`**: Engine runtime layer [packages/backstage/app/src/App.tsx].

## Safe to Remove (The Cruft)

These packages are never imported anywhere in your code streams. They are heavy plugins or legacy bridges that can be completely deleted from this orchestrator's package manifest:

### Inactive Feature Plugins

These are **frontend UI plugins** meant for a complete enterprise portal. Since your workbench is purely a sandboxed playground for *testing an independent custom plugin*, you don't need to mount the full corporate feature suite.

- **`@backstage/plugin-api-docs`**: Renders the API documentation explorer tab (OpenAPI/Swagger specs) inside the Catalog.
- **`@backstage/plugin-auth`**: Provides the user-facing OAuth login screens, provider buttons (GitHub, Okta, Google), and session renewal utilities. (Since your sandbox logs in instantly behind the scenes using our custom `SignInPageBlueprint` mock, this is dead weight).
- **`@backstage/plugin-catalog-graph`**: Renders the interactive visual node graph showing how components, systems, and APIs depend on one another.
- **`@backstage/plugin-catalog-import`**: Power the "Register an Existing Component" page wizard, allowing users to paste a URL to a `catalog-info.yaml` file to pull it into Backstage.
- **`@backstage/plugin-kubernetes`**: Renders the Kubernetes cluster resource tracker tab, displaying live deployment status, pods, and errors directly inside a Catalog entity view.
- **`@backstage/plugin-org`**: Manages and displays the organization hierarchy web pages (User profiles, Team/Group pages, and ownership arrays).
- **`@backstage/plugin-scaffolder` & `@backstage/plugin-scaffolder-react`**: Renders the Software Templates wizard UI (the form inputs used to create new repositories). While your backend processes these actions, your frontend test application doesn't need to load the heavy React form wizard bundles natively—it just passes along the menu sidebar token.
- **`@backstage/plugin-signals`**: The frontend client connection bundle that establishes a live WebSocket tunnel to the backend to enable real-time UI data updates without refreshing.
- **`@backstage/plugin-techdocs` & `@backstage/plugin-techdocs-module-addons-contrib`**: Renders the documentation reading page layouts (Markdown compiled into HTML documents), including community contribution add-ons like search-in-doc overlays.

### Legacy Framework Bridges & Unused Bundles

These are underlying framework primitives, runtime tools, or duplicate third-party asset libraries. They are either handled automatically by Backstage App Next under the hood or are completely unused by your code.

- **`@backstage/app-defaults`**: A legacy configuration bundle containing standard defaults for the *old* monolithic Backstage system. It is entirely replaced by `@backstage/frontend-defaults`.
- **`@backstage/config`**: The lower-level utility library used to parse, read, and typecheck strings inside `app-config.yaml` files. The new app factory handles this framework task natively.
- **`@backstage/core-app-api`**: The legacy root implementation layer that handles theme contexts, API registries, and routing initialization for the original frontend platform system.
- **`@backstage/core-compat-api`**: A backwards-compatibility bridge designed to let teams wrap older, legacy v1 plugins so they can mount inside the modern App Next system. Since you are building authentic, modern plugins from day one, you do not need this layer.
- **`@backstage/core-plugin-api`**: The original foundational API definition bundle used to register plugins, create route references, and declare utility APIs in legacy Backstage code layouts.
- **`@backstage/integration-react`**: Provides React hooks and UI helpers to parse external code integrations (like rendering Git repository provider icons or reading README links from GitHub/GitLab).
- **`@backstage/frontend-dev-utils`**: Internal compilation helper binaries used by the framework’s CLI to optimize builds—not meant to be imported into application bundle runtime environments.
- **`@backstage/cli`**: The global builder tool. Your backend `launcher.js` triggers this process, but the browser-facing frontend application package has no business hosting framework CLI code inside its web dependencies array.
- **`@mui/material`**: **Material-UI Version 5**. Backstage is in a long transition phase between style libraries. Your custom navigation code relies strictly on legacy **MUI Version 4** (`@material-ui/core`). Keeping version 5 installed adds duplicate styling files to the user's browser.
- **`@emotion/react` & `@emotion/styled`**: The css-in-js engines required exclusively to support modern MUI v5 layouts. Since your code relies on MUI v4 (which uses JSS via `makeStyles`), these are entirely unused.
- **`@rjsf/utils`**: Core utility layers for *react-jsonschema-form*. It is an indirect dependency used by the Scaffolder wizard to turn JSON schemas into frontend form components, but is unnecessary for your isolated shell.
- **`i18next`**: The internationalization/translation framework used to swap languages in localized user interfaces.
- **`prop-types`**: A legacy runtime type-checking library for JavaScript React components that has been completely made obsolete by your clean TypeScript workflow.
- **`react-router` & `react-router-dom`**: Browser navigation management packages. While your app is absolutely a multi-page routing application, Backstage App Next encapsulates these libraries inside its core extension nodes (`createApp`), handling page changes natively and removing the need to import them manually.

## Suggested `package.json`

```json
{
  "name": "@ai-crew-suite/workbench-app",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.tsx",
  "types": "src/index.tsx",
  "dependencies": {
    "@backstage/core-components": "backstage:^",
    "@backstage/frontend-defaults": "backstage:^",
    "@backstage/frontend-plugin-api": "backstage:^",
    "@backstage/plugin-app-react": "backstage:^",
    "@backstage/plugin-app-visualizer": "backstage:^",
    "@backstage/plugin-catalog": "backstage:^",
    "@backstage/plugin-notifications": "backstage:^",
    "@backstage/plugin-search": "backstage:^",
    "@backstage/plugin-user-settings": "backstage:^",
    "@backstage/theme": "backstage:^",
    "@backstage/ui": "backstage:^",
    "@material-ui/core": "catalog:prod",
    "@material-ui/icons": "catalog:prod",
    "react": "catalog:prod",
    "react-dom": "catalog:prod"
  },
  "devDependencies": {
    "@ai-crew-suite/typescript-shared-config": "catalog:dev",
    "@types/react": "catalog:dev",
    "@types/react-dom": "catalog:dev",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

## MUI v4 vs. MUI v5

The reason MUI introduced massive breaking changes between version 4 (`@material-ui/core`) and version 5 (`@mui/material`) comes down to **performance and the style engine**.

| Dimension               | MUI v4 (`@material-ui/core`)                                | MUI v5 (`@mui/material`)                                     |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| **Style Engine**        | Custom JSS (`makeStyles` / `withStyles`)                    | **Emotion** (`@emotion/react`)                               |
| **Runtime Performance** | Slow on large DOM trees due to dynamic JSS injection loops. | Fast. Leverage's Emotion's highly optimized engine cache.    |
| **Developer API**       | Brittle hook-based syntax (`const classes = useStyles()`).  | Unified **`sx` property** utility wrapper (very similar to Tailwind). |

### Why did they break the API?

In MUI v4, styles were built using **JSS**. It looked like this:

```tsx
const useStyles = makeStyles({ root: { backgroundColor: 'blue' } });
// In the component: const classes = useStyles(); return <div className={classes.root} />
```

MUI wanted to get rid of JSS because it was slow and bloated. For MUI v5, they completely swapped out the underlying engine to use **Emotion**. Because Emotion operates completely differently, they deleted `makeStyles` entirely and introduced the `sx` prop, allowing you to pass styles directly as inline utility objects:

```tsx
// MUI v5 Syntax (Feels closer to utility classes like Tailwind)
return <Box sx={{ bgcolor: 'blue.500', p: 2 }} />;
```

This complete architectural rewrite is what causes the breaking changes keeping the Backstage ecosystem split down the middle.

### What is the Primary Style Engine in Backstage?

Because of the v4/v5 split, the answer is actually **both, depending on the plugin phase**:

1. **Legacy Backstage (Core / Mainstream):** The primary style system is **MUI v4 JSS (`makeStyles`)**. If you are looking at standard core plugins like the Scaffolder forms or the Catalog rows, you will see `makeStyles` everywhere.

2. **Modern Backstage (App Next / Greenfield):** The official platform has standardly shifted to **Emotion** as its core engine. The framework's underlying themes layer compiles your corporate design templates into explicit Emotion token structures [packages/backstage/app/src/App.tsx].

## Impact on Users of Choosing **MUI v5 (`@mui/material`)** 

### The Immediate Impact: Severe Style Crashes

If a corporate user running a legacy Backstage instance installs your MUI v5 plugin, your components will not render correctly.

- **The Symptom:** They will see completely **unstyled raw HTML text, misaligned elements, or broken layouts**.
- **The Reason:** Legacies systems do not have an active Material-UI v5 theme provider engine mounted at their root. When your components initialize and attempt to resolve style variables (like `theme.palette.primary.main` or padding constants via the `sx` prop), the query returns `undefined`. Without fallback tokens, the layout breaks.

### The Operational Impact: Upstream Dependency Bloat

Corporate environments—especially in highly regulated sectors like banking or defense—have strict rules about package sizes and security audits.

- **The Symptom:** When they run `yarn add` on your plugin, it will pull down heavy transitive dependencies: `@mui/material`, `@mui/icons-material`, `@emotion/react`, and `@emotion/styled`.
- **The Reason:** If their core instance only uses MUI v4, your plugin forces them to bundle **two entirely separate design engines and UI frameworks** into their production application bundle. This increases their frontend bundle size (impacting page load performance) and introduces extra third-party code that their security teams must audit.

### The Implementation Hurdle: Custom Theme Mapping

Even if a legacy user wants to use your plugin and agrees to the bundle size increase, they cannot just drop it in. They are forced to write **custom bridge code** in their repository root.

- **The Symptom:** They must manually install `@mui/material` and add an explicit dual-provider wrapper around their entire app canvas:

  ```tsx
  <StyledEngineProvider injectFirst>
    <V5ThemeProvider theme={v5Theme}> {/* Required solely for your plugin */}
      <LegacyV4ThemeProvider theme={v4Theme}>
        <AppRouter />
      </LegacyV4ThemeProvider>
    </V5ThemeProvider>
  </StyledEngineProvider>
  ```

- **The Friction:** Many corporate platform engineers do not want to maintain custom theme-mapping files or manage style injection order precedence just to support a single third-party plugin. If the friction is too high, they will look for an alternative plugin.

### 🏆 How to Safely Build in v5 Without Alienating Legacy Users

You do not have to downgrade your greenfield project to v4 just to please legacy systems. You can use MUI v5 and remain a good open-source citizen by implementing these three guardrails:

1. **Strictly Use Peer Dependencies:** Never list `@mui/material` or `@emotion/*` inside your plugin's `dependencies` array. List them under **`peerDependencies`**. This tells the user's package manager: *"This plugin expects the host to provide the MUI v5 engine."*

2. **Utilize Backstage's Built-in Unified Theme:** Backstage introduced **`createUnifiedTheme`** specifically to solve this exact issue. Modern Backstage releases compile a single theme object that satisfies *both* v4 and v5 engines simultaneously.

3. **Provide a "Legacy Onboarding" Snippet in your README:** In your open-source installation documentation, provide the exact 5-line `ThemeProvider` snippet shown above. Frame it clearly:

   > *"Built using modern Material-UI v5. If your corporate host instance hasn't enabled the unified v5 theme engine yet, simply wrap your entry point using the standard MUI v5 Provider adapter."*

   This approach protects your code quality, lets you build on a modern engine, and provides a clear, manageable migration path for your enterprise users.
