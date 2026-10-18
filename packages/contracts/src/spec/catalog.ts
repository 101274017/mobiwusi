import { definitions } from './models.ts';
import { eventDefinitions } from './events.ts';
import { serviceErrorCodes } from './errors.ts';
import { choice, identifier, integer, literal, object, ref, schemaVersion, text } from './primitives.ts';
export { operations } from './operations.ts';
export { schemaVersion } from './primitives.ts';

const error = object({ code: choice(...serviceErrorCodes), message: text(320), retryable: { type: 'boolean' }, details: object({ current_version: integer(1), conflict_id: identifier }) }, ['details']);
export const serviceDefinitions = {
  ...definitions,
  ...eventDefinitions,
  ServiceErrorCode: choice(...serviceErrorCodes),
  ErrorEnvelope: object({ error, request_id: identifier, schema_version: literal(schemaVersion) }),
};
export const serviceSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `urn:nuanban:services:${schemaVersion}`, $defs: serviceDefinitions };
export const successEnvelope = (name: string) => object({ data: ref(name), request_id: identifier, schema_version: literal(schemaVersion) });
