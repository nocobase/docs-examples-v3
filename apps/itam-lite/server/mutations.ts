import type { Context } from 'hono';
import type { Application } from '@nocobase/app-server/application';
import {
  ApiError,
  executeIdempotentMutation,
  repositoryIdempotencyToken,
} from '@nocobase/app-server/router';
import { databaseManagerToken, type DatabaseConnection } from '@nocobase/db';

export interface BusinessMutation<T> {
  /** Server-owned operation name including its target, such as `devices/<id>:update`. */
  readonly operation: string;
  /** The validated request body: a retry under the same key must send the same one. */
  readonly input: unknown;
  /** Checks that the person may still see the stored result before it is replayed. */
  readonly authorizeReplay: (result: T) => void | Promise<void>;
  /** Every database write goes through `transaction`; `key` is the operation key, kept as the lifecycle request id. */
  readonly execute: (
    transaction: DatabaseConnection,
    key: string | undefined,
  ) => Promise<T>;
}

/**
 * Runs a business write under the transaction receipt the standard Repository writes use (see
 * `.agents/skills/nocobase-app-development/references/submission.md`): the first request with an `Idempotency-Key`
 * writes once, and a retry with the same key and body answers the stored result with `Idempotency-Replayed: true`.
 * The route's own gate has already authorized the action on this attempt, replays included, before this runs.
 */
export function businessMutations(app: Application) {
  return async <T>(c: Context, mutation: BusinessMutation<T>): Promise<T> => {
    const connection = app.container.resolve(databaseManagerToken).connection();
    const protection = app.container.has(repositoryIdempotencyToken)
      ? app.container.resolve(repositoryIdempotencyToken)
      : undefined;
    const key = c.req.header('Idempotency-Key');
    if (!protection || (!protection.required && !key)) {
      // Never drop a key the caller relies on: a request that expects a receipt is refused when none can be kept.
      if (key)
        throw new ApiError({
          status: 'FAILED_PRECONDITION',
          reason: 'IDEMPOTENCY_UNAVAILABLE',
          domain: 'itam-lite',
          message: 'Operation receipts are unavailable.',
        });
      return connection.transaction((transaction) =>
        mutation.execute(transaction, undefined),
      );
    }
    if (!key)
      throw new ApiError({
        status: 'INVALID_ARGUMENT',
        reason: 'OPERATION_KEY_REQUIRED',
        domain: 'itam-lite',
        message: 'Business writes require an Idempotency-Key header.',
      });
    const principal = await protection.principal(c);
    if (!principal)
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        reason: 'PRINCIPAL_REQUIRED',
        domain: 'itam-lite',
        message: 'An authenticated principal is required.',
      });
    const result = await executeIdempotentMutation<T>({
      connection,
      key,
      principal,
      operation: mutation.operation,
      input: mutation.input,
      authorize: () => undefined,
      authorizeReplay: mutation.authorizeReplay,
      execute: (transaction) => mutation.execute(transaction, key),
    });
    c.header('Idempotency-Replayed', String(result.replayed));
    return result.data;
  };
}
