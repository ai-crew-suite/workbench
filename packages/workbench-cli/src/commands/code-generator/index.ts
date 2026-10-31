
import { Command } from 'commander';
import path from 'node:path';
import inquirer from 'inquirer';
import {
  executePortableTemplate,
  loadPortableTemplate
} from '@backstage/cli-module-new';

interface GeneratorOptions {
  owner?: string;
  dryRun?: boolean;
}

export default async function codeGeneratorCommand(program: Command) {
  program
    .command('code-generator [plugin-name]')
    .description('Scaffold an internal plugin using corporate workbench configurations')
    .option('-o, --owner <team>', 'Specify the team owner handle for the CODEOWNERS registry')
    .option('--dry-run', 'Simulate file structure mapping without writing assets onto the disk')
    .action(async (pluginName: string | undefined, options: GeneratorOptions) => {

      // 1. Interactive prompt fallback if the required positional argument is missing
      let TargetPluginName = pluginName?.trim();
      if (!TargetPluginName) {
        const answers = await inquirer.prompt<{ promptName: string }>([
          {
            type: 'input',
            name: 'promptName',
            message: 'Enter the ID/name of the plugin you want to scaffold [required]:',
            validate: (value: string) => {
              if (!value.trim()) {
                return 'Please enter a valid plugin name';
              }
              if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
                return 'Plugin IDs must be lowercase and contain only letters, digits, and dashes.';
              }
              return true;
            },
          },
        ]);
        TargetPluginName = answers.promptName.trim();
      }

      // 2. Unify baseline tool configurations (Safely bypasses root package.json loops)
      const workbenchConfig = {
        isUsingDefaultTemplates: false,
        templatePointers: [],
        license: 'Apache-2.0',
        version: '0.1.0',
        private: true,
        packageNamePrefix: '@workbench/',
        packageNamePluginInfix: 'plugin-',
      };

      // 3. Resolve internal file tree locations pointing to your distributed blueprint assets
      const templatePath = path.resolve(
        __dirname,
        '..',
        '..',
        'templates',
        'workbench-plugin',
        'template.yaml'
      );

      const template = await loadPortableTemplate({
        name: 'workbench-frontend-plugin',
        description: 'Internal corporate workbench frontend plugin blueprint',
        target: templatePath,
      });

      // 4. Transform variables into the exact parameter schemas demanded by the execution conductor
      const targetInput = {
        roleParams: {
          role: 'frontend-plugin',
          name: TargetPluginName,
          pluginId: TargetPluginName,
        },
        packageName: `${workbenchConfig.packageNamePrefix}${workbenchConfig.packageNamePluginInfix}${TargetPluginName}`,
        packagePath: `plugins/${TargetPluginName}`,
        owner: options.owner || '@workbench/platform-maintainers',
        license: workbenchConfig.license,
        version: workbenchConfig.version,
        private: workbenchConfig.private,
      };

      // 5. Invoke the native Backstage compilation lifecycle pipeline
      await executePortableTemplate({
        config: workbenchConfig,
        template: template,
        input: targetInput,
        skipInstall: options.dryRun ?? false,
      });
    });
}
