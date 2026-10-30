
// packages/crew-cli-suite/src/commands/scaffold.ts
import { Command } from 'commander';
import { executePortableTemplate } from '@backstage/cli-module-new';
import { loadPortableTemplate } from '@backstage/cli-module-new';
import path from 'node:path';

export default async function scaffoldCommand(program: Command) {
  program
    .command('crew-new <plugin-name>')
    .description('Scaffold an internal plugin using corporate template configurations')
    .action(async (pluginName: string) => {

      // 1. Manually construct the Configuration object (Bypassing root checks)
      const mockConfig = {
        isUsingDefaultTemplates: false,
        templatePointers: [], // Not needed because we pass the template directly
        license: 'Apache-2.0',
        version: '0.1.0',
        private: true,
        packageNamePrefix: '@crew/',
        packageNamePluginInfix: 'plugin-',
      };

      // 2. Resolve and load your template blueprint packaged inside this module
      // Assumes your templates are compiled into the dist/npm folder of your CLI package
      const templatePath = path.resolve(__dirname, '..', 'templates', 'custom-plugin', 'template.yaml');
      const template = await loadPortableTemplate({
        name: 'crew-frontend-plugin',
        description: 'Internal corporate frontend plugin blueprint',
        target: templatePath,
      });

      // 3. Assemble the explicit execution variables normally gathered by the wizard
      const mockInput = {
        roleParams: {
          role: 'frontend-plugin',
          name: pluginName,
          pluginId: pluginName,
        },
        packageName: `@crew/plugin-${pluginName}`,
        packagePath: `plugins/${pluginName}`,
        owner: '@crew/platform-team', // Injects straight to codeowners.ts
        license: mockConfig.license,
        version: mockConfig.version,
        private: mockConfig.private,
      };

      // 4. Fire the native execution engine!
      // This runs writeTemplateContents, installNewPackage, and tasks.ts spinners
      await executePortableTemplate({
        config: mockConfig,
        template: template,
        input: mockInput,
        skipInstall: false,
      });
    });
}
