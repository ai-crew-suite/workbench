# Testing Custom Scaffolder Actions

## Testing Backend Custom Scaffolder Actions

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

## Testing the Frontend Scaffolder Wizard UI

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

## Automated Testing (CI/CD Pipeline)

When writing integration or unit tests for your custom Scaffolder templates or custom actions, you use the `@backstage/plugin-scaffolder-node-test-utils` library to execute steps in isolation without a running cluster.