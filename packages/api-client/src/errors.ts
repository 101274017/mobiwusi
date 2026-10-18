import { ServiceFailure } from "@nuanban/application";
import type { ServiceErrorCode } from "@nuanban/contracts";

export type ApiClientErrorKind = "timeout" | "connection" | "protocol" | "service";

export class ApiClientError extends ServiceFailure {
  constructor(code: ServiceErrorCode, message: string, retryable = false, public readonly requestId?: string, public readonly causeValue?: unknown, public readonly kind: ApiClientErrorKind = "service") {
    super(code, message, retryable);
    this.name = "ApiClientError";
  }
}
