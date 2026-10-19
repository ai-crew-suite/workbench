# Internal Systems Mocks

These are notes about the design of the mock system. It should have the following features:

- Have preset mocks for a comprehensive software catalog
- Allow consumers to add their own mocks instead of or to augment the core mocks

## Configuration

Consumers can override or add to the backend and frontend dev server configuration via `app-config.dev.yaml` files added to the `dev` folder at the call site.

## Annotation Mocks

*Declarative Annotation Injection (`modules/dynamic-annotation-processor`)*

Backend server module that hooks an automated `catalogModuleFixtureAnnotations` engine into the global entity ingestion pipeline, dynamically appending mock telemetry tags and integration identifiers to targeted software catalog components during background processing intervals.

- Disabling currently blocks all mock functionality
- No current path to extend in calling code. ***How do you extend that to client call sites?* *Maybe programmatic in the core, and directory in call sites?***

## Catalog Mocks

*Why do we have both Local Fixtures Parsing (`modules/catalog-optional-fixtures-processor`) and Dynamic Catalog Entity Injection (*`modules/dynamic-catalog-entity-processor`*)*

Consumers can add catalog mocks via `catalog-info.yaml` files added to the `dev` folder at the call site.

- Disabling currently blocks all mock functionality

## Catalog Entity Kinds

*Custom Kinds Contract Validation (`modules/catalog-schema-extensions`)*

Plugs a strict `CustomKindsModule` parser into the ingestion framework that validates custom enterprise taxonomies (`DataProduct`, `Model`, `Product`, `Vulnerability`, and `ArchitectureDecision`) against mandatory internal schemas, enforcing explicit data policies, severity matrices, and operational ownership bounds before data commits to the catalog database.

- Disabling currently blocks all Kinds functionality
- ***How do you extend that to client call sites?* *Maybe programmatic in the core, and directory in call sites?***

## Kubernetes Mocks

There are two approaches to adding Kubernetes mocks:

- Wiremock mock k8s API
- Kind (k8s in Docker containers) or Minikube

## Scaffolder Mocks

- Default approach is specifying either a URL or directory in config. This could be set up to scan for `template.yaml` scaffolder templates in the `dev` folder at call sites.
- There's a programmatic API. ***How do you extend that to client call sites?* *Maybe programmatic in the core, and directory in call sites?***

## Techdocs Mocks

**There is no programmatic API for TechDocs** that functions like the Catalog's in-memory entity providers. While you can programmatically seed the Catalog with the metadata *about* a documentation site (by injecting a `Component` entity with a `backstage.io/techdocs-ref` annotation), **the actual documentation content itself cannot be stored in-memory or streamed via a database mutation.**

These are also wired in using `packages/backend/app-config.yaml` and must follow a specific directory structure.

```yaml
techdocs:
  builder: 'local'
  generator:
    runIn: 'local' # Safe: Prevents dangerous Docker-in-Docker container requirements in EKS
  publisher:
    type: 'local'
    local:
      publishDir: ${MOCK_FIXTURES_PATH:-../../mock-fixtures}/techdocs
```

## Wiremock External Service Mocks

*Automated WireMock Fixture Synchronization (`modules/wiremock-bootstrapper`)*

Provisions an automated `wiremockBootstrapperModule` API extension that crawls your monorepo workspaces on startup, auto-discovering localized plugin mock configurations and seamlessly syncing JSON endpoint stubs into active WireMock proxy containers to create zero-config offline developer environments.
