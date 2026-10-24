# Adding Client Custom Kinds

The `workbench-backend` dev server has a module (`modules/catalog-schema-extensions`) that adds a default set of custom Kinds to the Backstage backend dev server. That behavior can be turned off via configuration if desired by adding the following to your plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    customKinds:
      enabled: false
```

## Add New Kinds in Client Call Code

### Step 1: Define the JSON Schema

Backstage enforces structure through schemas. You must create a JSON schema file defining your custom entity rules (e.g., inside `packages/backend/src/schema/Product.v1.schema.json`).

```json
{
  "$schema": "http://json-schema.org",
  "$id": "ProductV1Alpha1",
  "description": "Validation schema for custom Product kind",
  "type": "object",
  "required": ["apiVersion", "kind", "metadata", "spec"],
  "properties": {
    "apiVersion": { "enum": ["://company.com"] },
    "kind": { "enum": ["Product"] },
    "metadata": { "type": "object" },
    "spec": {
      "type": "object",
      "required": ["lifecycle", "owner"],
      "properties": {
        "lifecycle": { "type": "string" },
        "owner": { "type": "string" },
        "productManager": { "type": "string" }
      }
    }
  }
}
```

### Step 2: Build a Custom Backend Processor

Next, you need a catalog processor to validate incoming entities against this schema and handle relationships (e.g., linking the `Product` to its `owner`).

Create a new file `ProductKindProcessor.ts`:

```typescript
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { Entity, getCompoundEntityRef } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import productSchema from './Product.v1.schema.json';
import ajv from 'ajv';

export class ProductKindProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ProductKindProcessor';
  }

  // Hook into the validation phase
  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (entity.kind === 'Product') {
      const validate = new ajv().compile(productSchema);
      const valid = validate(entity);
      if (!valid) {
        throw new Error(`Invalid Product entity schema: ${JSON.stringify(validate.errors)}`);
      }
      return true; // Return true means this processor handled the validation
    }
    return false;
  }

  // Hook into the post-processing phase to emit relationships
  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind === 'Product') {
      const selfRef = getCompoundEntityRef(entity);
      
      // Emit the relationship connecting the Product to its Group/User owner
      if (entity.spec?.owner) {
        emit(
          processingResult.relation({
            source: selfRef,
            type: 'ownedBy',
            target: entity.spec.owner as string,
          })
        );
      }
    }
    return entity;
  }
}
```

### Step 3: Wrap the Processor in a Backend Module

Then, introduce the custom processor to the catalog plugin infrastructure. In the **new Backstage Backend System**, wrap your processor inside a backend module:

```typescript
// packages/backend/src/modules/catalogModuleProductKind.ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { ProductKindProcessor } from '../processors/ProductKindProcessor';

export const customKindsModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'product-kind',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ catalog }) {
        // Wire up the new validation logic to the catalog pipeline
        catalog.addProcessor(new ProductKindProcessor());
      },
    });
  },
});
```

### Step 4: Register the Processor in the Backend

Then, initialize it via the `features` parameter object option in `startDevBackend()` in your plugin's `dev/index.ts` file:

```typescript
import { catalogPlugin } from '@backstage/plugin-catalog-backend';
import { customKindsModule } from './my-custom-kinds';

await startDevBackend({
  features: [
    catalogModuleTemplateKind,
  ]
});
```

### Step 5: Allow the New Kind in `app-config.yaml`

By default, the catalog engine drops unexpected kinds to prevent accidental database spam. You must tell the ingestion engine that the `Product` kind is officially allowed globally or under specific locations:

```yaml
catalog:
  rules:
    - allow: [Component, API, Resource, Location, System, Domain]
    - allow: [Product] # Grants permission for the custom Kind to be read globally
```
