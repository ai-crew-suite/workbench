/**
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createHash } from 'node:crypto';
import ts from 'typescript';

/** Adds a generated feature to a supported conventional Backstage entrypoint. */
export function registerRuntime(source: string, packageName: string, frontend: boolean, filename: string): string {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    frontend ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (source.includes(`'${packageName}'`) || source.includes(`"${packageName}"`)) {
    throw new Error(`${packageName} is already referenced in ${filename}.`);
  }
  if (!frontend) {
    const starts = calls.filter(call => ts.isPropertyAccessExpression(call.expression)
      && call.expression.name.text === 'start'
      && ts.isIdentifier(call.expression.expression)
      && call.expression.expression.text === 'backend');
    const declaration = file.statements.some(statement => ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some(item => ts.isIdentifier(item.name)
        && item.name.text === 'backend' && item.initializer && ts.isCallExpression(item.initializer)
        && ts.isIdentifier(item.initializer.expression) && item.initializer.expression.text === 'createBackend'));
    if (!declaration || starts.length !== 1) {
      throw new Error(`Unsupported backend entrypoint ${filename}: expected const backend = createBackend() and one backend.start().`);
    }
    let statement: ts.Node = starts[0]!;
    while (statement.parent && !ts.isSourceFile(statement.parent)) statement = statement.parent;
    if (!ts.isExpressionStatement(statement)) throw new Error(`Unsupported backend.start() placement in ${filename}.`);
    const pos = statement.getStart(file);
    return `${source.slice(0, pos)}backend.add(import('${packageName}'));\n${source.slice(pos)}`;
  }

  const imports = file.statements.filter(ts.isImportDeclaration);
  const hasCreateApp = imports.some(item => ts.isStringLiteral(item.moduleSpecifier)
    && item.moduleSpecifier.text === '@backstage/frontend-defaults'
    && item.importClause?.namedBindings && ts.isNamedImports(item.importClause.namedBindings)
    && item.importClause.namedBindings.elements.some(element => element.name.text === 'createApp'
      && (!element.propertyName || element.propertyName.text === 'createApp')));
  const apps = calls.filter(call => ts.isIdentifier(call.expression) && call.expression.text === 'createApp');
  if (!hasCreateApp || apps.length !== 1 || !apps[0]!.arguments[0] || !ts.isObjectLiteralExpression(apps[0]!.arguments[0])) {
    throw new Error(`Unsupported frontend entrypoint ${filename}: expected one createApp({ features: [...] }).`);
  }
  const properties = apps[0]!.arguments[0].properties.filter(property => ts.isPropertyAssignment(property)
    && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'features');
  const features = properties[0];
  if (apps[0]!.arguments[0].properties.some(ts.isSpreadAssignment)
    || properties.length !== 1 || !features || !ts.isPropertyAssignment(features) || !ts.isArrayLiteralExpression(features.initializer)) {
    throw new Error(`Unsupported frontend entrypoint ${filename}: features must be an array literal.`);
  }
  const identifier = `generatedFeature_${createHash('sha256').update(packageName).digest('hex').slice(0, 12)}`;
  let duplicate = false;
  const findIdentifier = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === identifier) duplicate = true;
    ts.forEachChild(node, findIdentifier);
  };
  findIdentifier(file);
  if (duplicate) throw new Error(`Generated import name is already in use in ${filename}.`);
  const array = features.initializer;
  const insertAt = array.end - 1;
  const importAt = imports[0]!.getStart(file);
  if (importAt > insertAt) throw new Error(`Unsupported frontend import placement in ${filename}.`);
  const prefix = array.elements.length && !array.elements.hasTrailingComma ? ',' : '';
  const withFeature = `${source.slice(0, insertAt)}${prefix}\n    ${identifier},\n  ${source.slice(insertAt)}`;
  return `${withFeature.slice(0, importAt)}import ${identifier} from '${packageName}';\n${withFeature.slice(importAt)}`;
}
