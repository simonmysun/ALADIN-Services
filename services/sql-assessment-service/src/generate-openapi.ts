/**
 * CLI script — writes the generated OpenAPI specification to openapi.json
 * in the project root.
 *
 * Usage (via npm script or Makefile):
 *   npx ts-node src/generate-openapi.ts
 */

import fs from 'fs';
import path from 'path';
import {getSwaggerSpec} from './openapi';

const outputPath = path.resolve(__dirname, '..', 'openapi.json');
const spec = getSwaggerSpec();

fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');

console.log(`OpenAPI spec written to ${outputPath}`);
