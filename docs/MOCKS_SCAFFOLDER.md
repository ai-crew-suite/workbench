# Scaffolder Mocks for Backstage

## Read Templates from a Local Directory

Instead of configuring the Scaffolder to read templates from a remote Git repository, register your development templates using the `file` provider in `app-config.local.yaml`.

```yaml
catalog:
  locations:
    # Safely point to your local template definitions for immediate feedback
    - type: file
      target: ${MOCK_FIXTURES_PATH:-../../mock-fixtures}/templates/my-custom-template.yaml

scaffolder:
  # Disables background catalog worker polling for templates,
  # allowing instant local reloads
  experimentalNotLoadingTemplatesFromCatalog: true
```

## Programmatic Way to Inject Scaffolder Templates

Because templates are stored as standard entities in the Software Catalog, you do not need to mess with complex Scaffolder configurations. Instead, you can extend the custom **`DynamicFixtureEntityProvider`** we wrote earlier to load your TypeScript template fixtures right into the catalog runtime.

To keep your template definitions type-safe and clean, you can import the **`TemplateEntity`** schema model from `@backstage/catalog-model`.

### Step 1: Programmatic Entity Seeder

Add your custom Scaffolder template objects right alongside your existing Components and Systems inside your mock seed file (e.g., `packages/fixtures/catalog/src/fixtures/workbenchService.ts`):

```typescript
import { 
  Entity, 
  ComponentEntity, 
  TemplateEntity // <-- Import the strict type definition for templates
} from '@backstage/catalog-model';

export function getProgrammaticEntities(): Entity[] {
  // 1. Define your programmatic Scaffolder Template
  const localReactTemplate: TemplateEntity = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: 'local-react-app-template',
      title: 'Create React App (Local Dev Sandbox)',
      description: 'Programmatically seeded offline template that outputs source files directly to your disk.',
      tags: ['react', 'frontend', 'sandbox'],
    },
    spec: {
      type: 'website',
      owner: 'product-ux-team',
      // Define the interactive questionnaire parameters shown on
      // the frontend
      parameters: [
        {
          title: 'Provide Service Metadata',
          required: ['name'],
          properties: {
            name: {
              title: 'Application Name',
              type: 'string',
              description: 'Unique identifier for the generated directory node.',
            },
          },
        },
      ],
      // Define the execution steps handled by your backend workers
      steps: [
        {
          id: 'fetch',
          name: 'Fetch Template Skeleton',
          action: 'fetch:template',
          input: {
            // Resolves relative to where your developer server is
            // launched
            url: './dev-skeletons/react-boilerplate', 
          },
        },
        {
          id: 'publish',
          name: 'Publish to Local Machine Filesystem',
          action: 'file:publish', // Bypasses all cloud git credentials
          input: {
            path: '/tmp/backstage-scaffolded-output/${{ parameters.name }}',
          },
        },
      ],
      output: {
        links: [
          {
            title: 'Local Generated Output Directory',
            icon: 'dashboard',
            url: 'file:///tmp/backstage-scaffolded-output',
          },
        ],
      },
    },
  };

  // 2. Return it inside your existing topology array
  return [
    localReactTemplate,
    // ... your domain, system, and component entity objects
  ];
}
```

### Step 2: Ensure the Catalog Backend Understands Templates

For your `DynamicFixtureEntityProvider` mutation to successfully write this template into your database without breaking, your backend dev server must be aware of the `Template` schema.

Make sure you have the **Scaffolder Entity Model module** appended to your backend server initialization pipeline inside `packages/backstage/backend/src/index.ts`:

```typescript
// packages/backstage/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// 1. Core infrastructure
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// 2. CRITICAL: Register the schema rules for "kind: Template"
backend.add(import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'));

// 3. Register your custom dynamic provider module
backend.add(catalogDynamicEntitiesModule);

backend.start();
```

Why this is a great strategy for your dev loop:

- **Zero Filesystem Footprint:** You don't have to keep a bunch of sparse `template.yaml` files inside your repo structure. The architecture stays clean, structured, and entirely code-driven.
- **Instant Database Integration:** The moment your backend spins up, the `DynamicFixtureEntityProvider` will fire its mutation and stream this template straight into memory, making it instantly discoverable under the `/create` view.

## Use a `tmp` Directory for Skeleton Read / Writes

If your developers are writing or testing templates, they don't want to wait for code to push to a live cloud repository. Backstage provides a built-in `file:publish` action that writes the generated scaffolding results to a local directory instead of a remote host.

In your template's definition YAML, use `file:publish` for local environments instead of `publish:github`:

```yaml
# In your local template definition:
steps:
  - id: fetch
    name: Fetch Template
    # Grabs a skeleton project directory full of boilerplate source code
    # and place it into an ephemeral workspace inside the backend memory 
    # space
    action: fetch:template
    input:
      url: ./template # Relative to the template yaml

  - id: publish
    name: Publish Locally
    # Take the newly populated project folder out of memory and dump it
    # straight onto the local physical machine's hard drive at
    # /tmp/backstage-scaffolded-output
    action: file:publish # Bypasses all cloud git authentication
    input:
      path: /tmp/backstage-scaffolded-output/${{ parameters.name }}
```
