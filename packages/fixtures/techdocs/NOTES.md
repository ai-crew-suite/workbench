# TechDocs

The **`search_index.json`** file is the **pre-built search index** required by Backstage to provide instant, zero-network, clientside full-text documentation search for that component.

Backstage's TechDocs engine doesn't scan your raw HTML files on the fly when a user types into the search bar. Instead, it relies on a client-side search engine library called Lunr.js (or an upstream builder like MkDocs). This file acts as the compiled metadata database that tells the search bar exactly where to look.

### Anatomy of the JSON File

The structure is split into two critical coordinates:

#### 1. The `config` Block

```json
"config": {
  "lang": ["en"],
  "pipeline": ["trimmer", "stopWordFilter", "stemmer"]
}
```

This configures the **text preprocessing pipeline** used by the search engine:

- **`trimmer`**: Strips out punctuation, special characters, and formatting clutter so they don't break string matching.
- **`stopWordFilter`**: Drops common, uninformative filler words (like "the", "is", "at") so the index doesn't bloat up with junk data.
- **`stemmer`**: Reduces words down to their root forms. For example, if a user types *"orchestrated"*, the stemmer collapses it to *"orchestrat"*, allowing it to successfully match *"orchestration"* inside your `index.html` file!

#### 2. The `docs` Array

```json
"docs": [
  {
    "location": "",
    "title": "Core Workflow Orchestration Engine Configuration",
    "text": "Welcome to the technical baseline..."
  },
  {
    "location": "operations/",
    "title": "Runtime Execution and Maintenance Manual",
    "text": "This path maps out operations..."
  }
]
```

This is a flat map of **scraped, plain-text snapshots** extracted from your sister `index.html` pages:

- **`location`**: The relative URL path sub-directory hook (e.g., `operations/` maps directly to your `operations/index.html` file path topology).
- **`title`**: The exact string matching the header (`<h1>`) elements on those pages.
- **`text`**: A clean, tag-free compression of the content paragraphs.

### Why is this fixture critical for your Dev Server Sandbox?

When a developer launches the `searchPlugin` that you registered in your `startDevBackend` factory, and types a phrase like *"REINDEX"* or *"Temporal"* into the Backstage UI search bar, the system queries this exact JSON schema profile. It allows the interface to instantly highlight and link the user directly to `http://localhost:3000/docs/default/component/platform/operations/` without throwing a `404 Search Index Missing` exception in your local developer logs.

### Will Backstage Automatically Generate `search_index.json` If Missing?

**No, the Backstage backend server will not generate this file automatically if it is missing from S3.**

The Backstage runtime assumes that **the build/CI pipeline has already generated it.**

- In a standard production layout, developers write their documentation in Markdown (`.md`) inside their code repositories.
- When they push code, a CI/CD script running the **`techdocs-cli`** tool invokes a localized Python instance of `mkdocs`.
- It is `mkdocs` that compiles the Markdown into HTML and outputs the `search_index.json` metadata index.
- Your CI/CD script then pushes that whole bundle to S3. If your pipeline skips compiling the search assets, the search bar for that component will remain completely empty.

### Is the Name `search_index.json` Special?

**Yes, the name `search_index.json` is strictly hardcoded and special.**

You cannot rename it. The `searchTechDocsCollatorPlugin` (the engine running inside your backend factory) is programmed to explicitly look for a file path string ending in `search/search_index.json` relative to the component's root space.

 ## The Backstage Triplet Path

The highly specific nesting structure (`default/component/platform/`) maps exactly to how Backstage structures unique identity paths for software assets, known as an **Entity Reference (EntityRef)**.

In the Software Catalog, every asset is uniquely identified by a strict triplet formula: **`<namespace>/<kind>/<name>`**.

```text
packages/fixtures/techdocs/
  └──  default     /   component   /     platform     /
     [Namespace]        [Kind]            [Name]
```

- **`namespace` (`default`):** The logical workspace isolation boundary. If you don't declare an explicit namespace inside an entity's `metadata.namespace` layout, Backstage assigns the word `default` automatically.
- **`kind` (`component`):** The structural model classification (e.g., `component`, `api`, `system`, or `domain`).
- **`name` (`platform`):** The distinct system string handle assigned to the individual microservice asset (`metadata.name`).

### How TechDocs Uses the Triplet Path

When the `techdocsPluginAlpha` reads your configuration, it matches the currently viewed documentation page directly against a target catalog object. When a developer navigates to the documentation page for your platform core service, the UI makes an internal network request targeting:

```text
/api/techdocs/static/docs/default/component/platform/index.html
```

Because your `techdocs.publisher.local.publishFolder` points straight to your `packages/fixtures/techdocs` folder root, Backstage's local file reader resolves the path perfectly, locating your mock files instantly.

## Summary of Special vs. Arbitrary Names in TechDocs

To keep your directory schema clear, here is a quick breakdown of what Backstage strictly enforces versus what you control:

- 🔒 **Strict / Special Names (Do Not Change):** `default/component/platform/` (The Entity Triplet) and `search/search_index.json`.
- 🎨 **Arbitrary Names (Fully Customizable):** Any sub-folders or asset files representing your actual documentation pages (like `operations/`, `architecture/`, `api-guide/`, or `images/`).

## Is Your Search JSON Being Loaded or Ignored?

Right now, **your custom `search_index.json` file is being completely ignored by the background search indexing engines.**

Here is exactly why, and what is happening under the hood based on your programmatic configuration blocks:

### The Disconnect

1. Inside your `search` config block, you only registered a single collator engine: **`catalog`**. This engine crawls *only* standard Software Catalog data fields (like component titles, descriptions, and tags). It has no awareness of documentation pages or HTML directories.
2. Because your `techdocs` block sets the builder to `'local'` and generator to `runIn: 'local'`, Backstage assumes it should serve static pre-compiled pages, but **the core search plugin doesn't automatically scour publisher folders for loose files named `search_index.json`**.
3. To actually load, parse, and ingest documentation text into your global workspace search dashboard, you must register the **TechDocs Collator Plugin** inside your `search` engine block so that it actively reads from your local publisher folder.

### The Quick Fix

To make your search indexes operational, update your programmatic `search` config block to register the `techdocs` collator parallel to your `catalog` scheduler:

```typescript
      search: {
        collators: {
          catalog: {
            schedule: {
              frequency: { seconds: 60 },
              timeout: { minutes: 3 },
              initialDelay: { seconds: 15 },
            },
          },
          // ADD THIS RUNTIME BLOCK: Tells Backstage to actively ingest your TechDocs files
          techdocs: {
            schedule: {
              frequency: { minutes: 10 },
              timeout: { minutes: 5 },
              initialDelay: { seconds: 30 },
            },
          },
        },
      },
```

Once this configuration is updated and you restart the backend via your dev factory (`startDevBackend`), the `searchTechDocsCollatorPlugin` (which is already registered inside your factory script step) will look at your `techdocs.publisher.local.publishFolder` target, pick up that nested `search_index.json` index, and instantly stream its keywords directly into your workspace search bar.

## Trigger a Search Indexing Scan via API

The `searchTechDocsCollatorPlugin` is a provider that plugs into the central Backstage **Search Ingestion Engine**. In the modern Backstage Backend system, the search framework schedules these collators via an internal scheduler.

To force a re-index on demand (for example, via a Workbench CLI command or a webhook), you invoke the Backstage Search API endpoint:

```bash
# Force an immediate, non-cached re-indexing sweep of the techdocs index
curl -X POST http://localhost:7007/api/search/index/techdocs
```

## How to Programmatically Trigger the Search Index Refresh

Inside your modern Backstage Backend system architecture, you can trigger a refresh on demand by creating a custom backend module or route handler. You do this by depending on **`coreServices.searchRegistry`** to schedules an immediate task orchestration sweep.

Here is how you inject the registry dependency and invoke an immediate refresh inside your backend ecosystem:

```typescript
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';

export const searchTriggerModule = createBackendModule({
  pluginId: 'search',
  moduleId: 'on-demand-trigger',
  register(reg) {
    reg.registerInit({
      deps: {
        // 1. Inject the searchRegistry service dependency
        searchRegistry: coreServices.searchRegistry,
        logger: coreServices.logger,
      },
      async init({ searchRegistry, logger }) {
        // Expose a function or wire this to an express router hook
        const triggerTechDocsScan = async () => {
          logger.info('[Search-Trigger] Programmatically requesting an on-demand re-index sweep for TechDocs...');
          
          try {
            // 2. Instruct the engine registry to execute the 'techdocs' scheduler index instantly
            await searchRegistry.scheduleTask({
              id: 'search_index_techdocs', // Standard core task ID for techdocs indexing
              scope: 'global',
            });
            logger.info('[Search-Trigger] TechDocs index task successfully queued for immediate execution.');
          } catch (error) {
            logger.error(`[Search-Trigger] Failed to trigger search index task: ${error}`);
          }
        };

        // Example trigger: For testing, invoke it 5 seconds after backend boot
        setTimeout(triggerTechDocsScan, 5000);
      },
    });
  },
});
```

## The `backstage.io/techdocs-ref` Annotation

Even if a repository maps to a single isolated service, Backstage requires the `backstage.io/techdocs-ref` annotation inside its `catalog-info.yaml` file. Without this metadata marker, the Backstage UI will not display the "Docs" tab or sidebar navigation button on that component's entity page, making the documentation completely unreachable in the frontend browser interface.

Adding it to programmatic mock configurations:

```typescript
metadata: {
  name: 'platform',
  annotations: {
    'backstage.io/techdocs-ref': 'dir:.', // Standard directory relative pointer
  }
}
``
```

## Executing the `techdocs-cli` Compiler Programmatically

Since `techdocs-cli` is distributed as a standard Node.js executable package via npm, you can invoke it programmatically within your new Workbench CLI or test scripts using Node’s native `child_process` execution module. Instead of typing commands manually into a terminal console, your code can spawn a child container or local thread process to build and bundle your assets:

```typescript
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function programmaticallyCompileTechDocs(options: {
  sourceDir: string;
  outputDir: string;
}) {
  console.log(`[CLI-Compiler] Compiling documentation from source footprint: ${options.sourceDir}`);

  try {
    // Invoke the techdocs-cli compiler binary programmatically out of node_modules
    const { stdout, stderr } = await execPromise(
      `npx @backstage/techdocs-cli generate --source-dir ${options.sourceDir} --output-dir ${options.outputDir}`
    );

    if (stderr) {
      console.warn(`[CLI-Compiler] Build Warning output: ${stderr}`);
    }

    console.log(`[CLI-Compiler] Successfully compiled HTML and search_index.json assets into: ${options.outputDir}`);
    return { success: true, log: stdout };
  } catch (error: any) {
    console.error(`[CLI-Compiler] CRITICAL ERROR during documentation generation loop: ${error.message}`);
    throw error;
  }
}
```