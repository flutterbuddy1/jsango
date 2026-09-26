import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class AdminGenerateCommand extends BaseCommand {
  public readonly name = 'make:admin';
  public readonly description = 'Generate a new typed AdminResource and model scaffold for JSango Admin';
  public readonly usage = 'jsango make:admin <ModelName> [options]';
  public readonly aliases = ['admin:generate', 'make:resource', 'admin:make'];
  public readonly options = [
    {
      name: 'output',
      short: 'o',
      description: 'Output directory for resource files (default: src/admin)',
      type: 'string' as const,
      default: 'src/admin',
    },
    {
      name: 'group',
      short: 'g',
      description: 'Navigation group name in Admin sidebar',
      type: 'string' as const,
    },
    {
      name: 'icon',
      short: 'i',
      description: 'Lucide icon name (e.g. box, file-text, users, tag, shield)',
      type: 'string' as const,
      default: 'file-text',
    },
    {
      name: 'with-model',
      short: 'm',
      description: 'Also generate corresponding ORM model in src/models',
      type: 'boolean' as const,
      default: true,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const rawName = context.args[0] ? String(context.args[0]) : '';
    if (!rawName) {
      context.output.error('Model name is required. Usage: jsango make:admin <ModelName>');
      return ExitCode.USAGE_ERROR;
    }

    // Capitalize PascalCase
    const modelName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const idName = rawName.toLowerCase() + (rawName.endsWith('s') ? '' : 's');
    const label = modelName.replace(/([A-Z])/g, ' $1').trim();
    const pluralLabel = label.endsWith('s') ? label : `${label}s`;
    const kebabName = rawName.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();

    const outputDir = (context.options['output'] as string | undefined) ?? 'src/admin';
    const groupName = (context.options['group'] as string | undefined) ?? 'Content Management';
    const iconName = (context.options['icon'] as string | undefined) ?? 'file-text';
    const withModel = (context.options['with-model'] as boolean | undefined) ?? true;

    const resourceFileName = `${kebabName}-resource.ts`;
    const resourceFilePath = path.resolve(context.projectRoot, outputDir, resourceFileName);

    // 1. Generate Admin Resource file
    const resourceContent = `import { AdminResource } from '@jsango/admin-core';

export const ${modelName}Resource = new AdminResource({
  id: '${idName}',
  modelName: '${modelName}',
  label: '${label}',
  pluralLabel: '${pluralLabel}',
  navigationGroup: '${groupName}',
  navigationIcon: '${iconName}',
  navigationOrder: 1,
  primaryKey: 'id',
  fields: [
    { name: 'id', type: 'uuid', readonly: true },
    { name: 'title', type: 'text', required: true, label: 'Title', searchable: true },
    { name: 'description', type: 'textarea', label: 'Description', searchable: true },
    { name: 'isActive', type: 'boolean', label: 'Is Active' },
    { name: 'createdAt', type: 'datetime', readonly: true, label: 'Created At' },
    { name: 'updatedAt', type: 'datetime', readonly: true, label: 'Updated At' },
  ],
  listFields: ['id', 'title', 'description', 'isActive', 'createdAt'],
  searchFields: ['title', 'description'],
  filters: [
    { name: 'isActive', type: 'boolean', field: 'isActive' },
  ],
  bulkActions: [
    {
      id: 'bulk-activate',
      label: 'Activate Selected',
      requiresConfirmation: true,
    },
    {
      id: 'bulk-deactivate',
      label: 'Deactivate Selected',
      requiresConfirmation: true,
    },
  ],
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
});
`;

    fs.mkdirSync(path.dirname(resourceFilePath), { recursive: true });
    fs.writeFileSync(resourceFilePath, resourceContent, 'utf8');

    // 2. Generate ORM Model if requested
    let modelFilePath = '';
    if (withModel) {
      const modelDir = path.resolve(context.projectRoot, 'src/models');
      const modelFileName = `${kebabName}.ts`;
      modelFilePath = path.join(modelDir, modelFileName);

      if (!fs.existsSync(modelFilePath)) {
        const modelContent = `import { defineModel, fields } from '@jsango/orm';

export const ${modelName} = defineModel({
  name: '${modelName}',
  table: '${idName}',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    title: fields.string(),
    description: fields.string({ default: '' }),
    isActive: fields.boolean({ default: true }),
    createdAt: fields.string({ default: () => new Date().toISOString() }),
    updatedAt: fields.string({ default: () => new Date().toISOString() }),
  },
});
`;
        fs.mkdirSync(modelDir, { recursive: true });
        fs.writeFileSync(modelFilePath, modelContent, 'utf8');
      }
    }

    if (context.output.isJson) {
      context.output.json({
        success: true,
        resource: {
          name: `${modelName}Resource`,
          file: resourceFilePath,
        },
        model: modelFilePath ? { name: modelName, file: modelFilePath } : null,
      });
    } else {
      context.output.success(`Admin resource generated at: ${path.relative(context.projectRoot, resourceFilePath)}`);
      if (modelFilePath) {
        context.output.success(`ORM model generated at: ${path.relative(context.projectRoot, modelFilePath)}`);
      }
      context.output.info('\nNext steps to activate:');
      context.output.text(`  1. In src/admin/index.ts:`);
      context.output.text(`     registry.register(${modelName}Resource);`);
      context.output.text(`  2. In createOrmAdminQueryAdapter():`);
      context.output.text(`     Add ${modelName} to the models map.`);
    }

    return ExitCode.SUCCESS;
  }
}
