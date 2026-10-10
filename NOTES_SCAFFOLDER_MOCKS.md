# Scaffolder Mocks for Backstage

## Local Development

By default, the Scaffolder tries to use cloud providers (like GitHub, GitLab, or AWS) to fetch templates and publish repositories. You can configure it to run entirely in an offline, local-first mode using a combination of **file-based configurations** and **built-in mock/local actions**.

### Step A: Read Templates from a Local Directory

Instead of configuring the Scaffolder to read templates from a remote Git repository, register your development templates using the `file` provider in `app-config.local.yaml`.

```yaml
catalog:
  locations:
    # Safely point to your local template definitions for immediate feedback
    - type: file
      target: ${MOCK_FIXTURES_PATH:-../../mock-fixtures}/templates/my-custom-template.yaml

scaffolder:
  # Disables background catalog worker polling for templates, allowing instant local reloads
  experimentalNotLoadingTemplatesFromCatalog: false 
```

### Step B: Use the `file:publish` Action (Bypass GitHub/GitLab Auth)

If your developers are writing or testing templates, they don't want to wait for code to push to a live cloud repository. Backstage provides a built-in `file:publish` action that writes the generated scaffolding results to a local directory instead of a remote host.

In your template's definition YAML, use `file:publish` for local environments instead of `publish:github`:

```yaml
# In your local template definition:
steps:
  - id: fetch
    name: Fetch Template
    action: fetch:template
    input:
      url: ./template # Relative to the template yaml

  - id: publish
    name: Publish Locally
    action: file:publish # Bypasses all cloud git authentication
    input:
      path: /tmp/backstage-scaffolded-output/${{ parameters.name }}
```

## Automated Testing (CI/CD Pipeline)

When writing integration or unit tests for your custom Scaffolder templates or custom actions, you use the `@backstage/plugin-scaffolder-node-test-utils` library to execute steps in isolation without a running cluster.

### Testing Backend Custom Scaffolder Actions

If you write a custom action (e.g., an action that registers a service in your company's internal CMDB), you mock its dependencies inside a Jest execution context.

```typescript
import { createMockActionContext } from '@backstage/plugin-scaffolder-node-test-utils';
import { myCustomScaffolderAction } from './myCustomAction';

describe('myCustomScaffolderAction', () => {
  const action = myCustomScaffolderAction();

  it('should process the input and write to workspace successfully', async () => {
    // 1. Setup a clean, ephemeral test workspace directory
    const ctx = createMockActionContext({
      input: {
        myParam: 'test-value',
      },
      workspacePath: '/tmp/test-workspace',
    });

    // 2. Run the action
    await action.handler(ctx);

    // 3. Assert your logic took place (e.g., a file was modified or an internal API was hit)
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Successfully processed test-value'),
    );
  });
});
```

### Testing the Frontend Scaffolder Wizard UI

If you are testing that the custom form fields or multi-step wizard choices present correctly in the Backstage frontend, mock the backend Scaffolder API client using `TestApiRegistry`.

```typescript
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder';
import { TemplateWizardPage } from './TemplateWizardPage'; // your view

describe('Scaffolder Frontend Wizard', () => {
  it('renders custom form options correctly', async () => {
    // Mock the backend API responses for template dry-runs or parameters
    const mockScaffolderApi = {
      scaffold: jest.fn().mockResolvedValue({ taskId: 'mock-task-id' }),
      getTemplateParameterSchema: jest.fn().mockResolvedValue({
        steps: [{ title: 'Step 1', schema: { properties: {} } }]
      }),
    };

    const apis = TestApiRegistry.from([scaffolderApiRef, mockScaffolderApi]);

    await renderInTestApp(<TemplateWizardPage />, { apis });

    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });
});
```
