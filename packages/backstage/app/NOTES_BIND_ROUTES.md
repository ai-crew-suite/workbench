# Notes on Binding Routes Dynamically

f your plugin attempts to generate a link using an `ExternalRouteRef` that hasn't been plugged into anything via `bindRoutes`, **the app will crash with a runtime javascript error** the moment that component mounts or the button is clicked. Backstage will throw an error stating: `No binding found for ExternalRouteRef...`.

## Route Binding in `App.tsx`

```typescript
import { createApp } from '@backstage/frontend-defaults';
import { catalogPlugin } from '@backstage/plugin-catalog';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';

const app = createApp({
  features: [ catalogPlugin, scaffolderPlugin ],
  
  bindRoutes({ bind }) {
    // We are binding Catalog's external hook to Scaffolder's real route
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
    });
  },
});
```

##  Route Binding Handling via YAML Configuration

```yaml
# app-config.yaml
app:
  listen: { port: 3000 }
  
bindRoutes:
  catalog.externalRoutes.createComponent: scaffolder.routes.root
```

## Implementing a Dynamic Route Binder Module

To build a dynamic router that mirrors what `createDevApp` does under the hood, you can create a custom **Frontend Module**. This module intercepts external routing hooks and uses Backstage's internal routing engine or browser location helpers to resolve targets by matching strings, rather than requiring the target plugin code to be explicitly imported.

```typescript
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { catalogPlugin } from '@backstage/plugin-catalog';

export const dynamicRoutingDevModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    // We register our loose routing rules inside a configuration-style module
  ],
  // Instead of static code matching, we hook into runtime string parsing
  configure({ bind }) {
    // If you are using standard paths across your team's plugins, 
    // you can map the external targets to a unified dynamic handler or path proxy
    bind(catalogPlugin.externalRoutes, {
      // You can explicitly point these out to fixed dev targets 
      // without needing to import the actual plugin objects themselves
      createComponent: '/create', 
      viewTechDocs: '/docs',
    });
  }
});
```

## Disable Routes

If you are using the custom `createApp` wrapper pattern for local development and want to avoid manually maintaining a giant `bindRoutes` switchboard block, you can replicate the `createDevApp` behavior using **App Configuration**.

Backstage's framework allows you to toggle route configuration via your `app-config.yaml` or `app-config.local.yaml` files instead of code. You can specify a dynamic wildcard block or loose bindings in your local-only environment file:

```yaml
# app-config.local.yaml
# This file is loaded exclusively during local development loops

bindRoutes:
  # You can safely point external targets to 'false' to automatically
  # deactivate the links and prevent the framework from throwing runtime crashes.
  catalog.externalRoutes.createComponent: false
  catalog.externalRoutes.viewTechDocs: false
```

## Using the `discoveryApiRef` Hook

A tiny helper leveraging the public **`discoveryApiRef`** acts as a lightweight runtime location resolver. In Backstage, the `DiscoveryApi` is the core mechanism that keeps track of where various services are located. While it is primarily designed to resolve **backend plugin endpoints** (e.g., finding the URL for `http://localhost:7007/api/catalog`), you can use it to build a utility that dynamically generates paths for external systems or plugins without needing strict compile-time route bindings.

Here is what a helper like this looks like and exactly how it functions:

### The React Hook Helper Implementation

You can write this as a clean, custom React hook that can be dropped into any component inside your custom `createApp` setup.

```typescript
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';

export const useDynamicRouteResolver = () => {
  const discoveryApi = useApi(discoveryApiRef);

  /**
   * Resolves a standard path for a target backend plugin dynamically.
   * @param pluginId The identifier of the plugin (e.g., 'catalog', 'scaffolder')
   * @param subPath An optional deep link path (e.g., '/entities', '/templates/my-template')
   */
  const resolveUrl = async (pluginId: string, subPath: string = '') => {
    try {
      // 1. Ask the discovery API where this plugin's backend is hosted
      const baseUrl = await discoveryApi.getBaseUrl(pluginId);
      
      // 2. Append your deep link sub-path
      return `${baseUrl}${subPath}`;
    } catch (error) {
      console.error(`Failed to dynamically discover plugin: ${pluginId}`, error);
      // Fallback to a predictable local development default path if discovery fails
      return `http://localhost:7007/api/${pluginId}${subPath}`;
    }
  };

  return { resolveUrl };
};
```

#### How You Use It inside a Custom Component

Instead of importing an `ExternalRouteRef` and relying on the `bindRoutes` switchboard configuration, your component simply queries the helper at runtime:

```typescript
import React, { useState, useEffect } from 'react';
import { useDynamicRouteResolver } from './useDynamicRouteResolver';

export const DevTemplateButton = () => {
  const { resolveUrl } = useDynamicRouteResolver();
  const [targetUrl, setTargetUrl] = useState<string>('#');

  useEffect(() => {
    // Dynamically resolve the path without compile-time binding dependencies
    resolveUrl('scaffolder', '/v2/templates/custom-template')
      .then(url => setTargetUrl(url));
  }, []);

  return (
    <a href={targetUrl} target="_blank" rel="noopener noreferrer">
      Launch Scaffolder Template
    </a>
  );
};
```

### What This Helper Actually Does Under the Hood

1. **Bypasses Strict Type Checks:** It entirely skips the `bindRoutes` compiler verification step. If the target plugin is missing or changed, your app won't crash with a JavaScript validation error on startup.
2. **Consults the Backstage Context:** When `discoveryApi.getBaseUrl('scaffolder')` is executed, it actively reads your current loaded configuration (like your `app-config.yaml` rules) to find the live address of that plugin.
3. **Graceful Error Handling:** If your isolated development environment doesn't have the target plugin running, the `catch` block intercepts the failure, logs a clean message, and supplies a predictable local fallback URL instead of crashing your frontend user interface.

## Frontend Route Discovery and a Local Development Proxy

To connect your isolated frontend (`createApp` or `createDevApp`) to your custom backend plugin, you need to configure two things: **frontend route discovery** and a **local development proxy**.

This setup allows your frontend components to make clean requests to `/api/my-custom-plugin/` and have Backstage automatically route that traffic to your backend server running on a separate port (e.g., `7007`).

### Step 1: Configure the Local Dev Proxy (`app-config.local.yaml`)

Backstage includes a built-in proxy plugin (`@backstage/plugin-proxy`) that handles cross-origin routing. You configure it inside your local configuration file.

Add the following to your **`app-config.local.yaml`** at the root of your project:

```yaml
# app-config.local.yaml
backend:
  baseUrl: http://localhost:7007
  listen:
    port: 7007

# Configure the proxy service to forward traffic to your custom backend plugin
proxy:
  endpoints:
    '/my-custom-plugin':
      target: 'http://localhost:7007/api/my-custom-plugin'
      changeOrigin: true
      # Optional: If your backend requires special dev headers, inject them here
      headers:
        X-Backstage-Dev-Token: 'local-development-bypass-token'
```

### Step 2: Use `discoveryApiRef` to Make Requests

In your custom frontend plugin components, you should **never** hardcode the backend URL (like `http://localhost:7007`). Instead, combine the `discoveryApiRef` with the `fetchApiRef` (which automatically handles session tokens and authentication).

Here is how to safely call your custom backend plugin:

```typescript
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import React, { useState, useEffect } from 'react';

export const MyCustomBackendDataComponent = () => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      // 1. Dynamically discover the main proxy endpoint base URL
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      
      // 2. Append your custom plugin's proxy endpoint path
      const targetUrl = `${proxyBaseUrl}/my-custom-plugin/health`; // or your custom route

      // 3. Make the type-safe, authenticated request
      const response = await fetchApi.fetch(targetUrl);
      const json = await response.json();
      setData(json);
    }

    fetchData().catch(console.error);
  }, [discoveryApi, fetchApi]);

  if (!data) return <div>Loading data from backend plugin...</div>;

  return (
    <div>
      <h3>Backend Status: {data.status}</h3>
    </div>
  );
};
```

### How to Run This Setup in Development

To see this full loop in action across your custom backend and frontend plugins, you will need two open terminal windows on your machine:

1. **Terminal 1 (Start the Backend):**
   Navigate to your custom backend plugin directory (or the root if using the integrated layout) and start it up:

   ```bash
   cd plugins/my-custom-plugin-backend
   yarn start
   ```

   This launches your endpoint listener on port `7007`.

   

2. **Terminal 2 (Start the Frontend Sandbox):**
   Navigate to your frontend plugin directory and spin up your dev app:

   ```bash
   cd plugins/my-custom-plugin
   yarn start
   ```

   This launches your browser shell on port `3000`.

   

Why this is the Standard Approach

- **No CORS Issues:** Because the frontend browser talks directly to its own proxy layer, you avoid cross-origin resource sharing (CORS) blocks completely.
- **Production Ready:** When you eventually package your plugin for production deployment, you won't have to rewrite any code. The `discoveryApi` will seamlessly switch from pointing at `localhost` to pointing at your company's production Kubernetes or cloud-hosted domains automatically.