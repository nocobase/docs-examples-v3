import { defineMigration } from '@nocobase/db';

/**
 * Device requests and the tables of `@nocobase/lifecycle`: the transition log and effect runs every lifecycle of the
 * application shares, and the stored versions of administrator-set lifecycle parameters (the library's default
 * collection names). Spelled out here rather than taken from the library, so the migration stays what it was.
 */
export default defineMigration({
  name: '202610300201_create_device_requests',
  async up({ builder }) {
    await builder.createCollection('deviceRequests', (c) => {
      c.string('id', { length: 36, primaryKey: true, nullable: false });
      c.string('requestNo', { length: 20, nullable: false });
      c.string('requesterId', { length: 255, nullable: false });
      c.string('category', { length: 16, nullable: false });
      c.string('reason', { length: 500, nullable: false });
      c.string('status', { length: 32, nullable: false });
      c.datetimeTz('statusChangedAt', { nullable: false });
      c.integer('lifecycleVersion', { nullable: false, defaultValue: 0 });
      c.boolean('needsApproval', { nullable: false, defaultValue: false });
      c.string('decisionComment', { length: 500, nullable: false, defaultValue: '' });
      c.string('decidedById', { length: 255, nullable: true });
      c.string('deviceId', { length: 36, nullable: true });
      c.string('issuedById', { length: 255, nullable: true });
      c.datetime('createdAt', { nullable: false });
      c.datetime('updatedAt', { nullable: false });
      c.unique('requestNo');
      c.index(['status', 'statusChangedAt']);
      c.index(['requesterId', 'createdAt']);
    });

    await builder.createCollection('lifecycleTransitions', (c) => {
      c.bigInt('id').primary().autoIncrement().notNull();
      c.string('lifecycle').notNull();
      c.string('recordId').notNull();
      c.string('transition').notNull();
      c.string('from');
      c.string('to').notNull();
      c.string('actorId').notNull();
      c.json('input').notNull().defaultTo({});
      c.datetimeTz('at').notNull();
      c.integer('version').notNull();
      c.string('requestId');
      c.string('requestKey').notNull();
      c.index(['lifecycle', 'recordId', 'id'], { name: 'lifecycle_transitions_record' });
      c.unique(['lifecycle', 'recordId', 'version'], { name: 'lifecycle_transitions_version' });
      c.unique(['lifecycle', 'recordId', 'requestKey'], { name: 'lifecycle_transitions_request' });
    });

    await builder.createCollection('lifecycleEffectRuns', (c) => {
      c.bigInt('id').primary().autoIncrement().notNull();
      c.bigInt('transitionId').notNull();
      c.string('lifecycle').notNull();
      c.string('recordId').notNull();
      c.string('effect').notNull();
      c.boolean('stayBound').notNull();
      c.string('status').notNull();
      c.integer('attempts').notNull().defaultTo(0);
      c.integer('maxAttempts').notNull().defaultTo(1);
      c.json('result');
      c.text('error');
      c.datetimeTz('createdAt').notNull();
      c.datetimeTz('updatedAt').notNull();
      c.datetimeTz('claimedAt');
      c.datetimeTz('runAfter');
      c.json('continuation');
      c.datetimeTz('continuationDueAt');
      c.datetimeTz('continuationAbandonedAt');
      c.index(['status', 'id'], { name: 'lifecycle_effect_runs_status' });
      c.index(['lifecycle', 'recordId', 'id'], { name: 'lifecycle_effect_runs_record' });
      c.index(['continuationDueAt'], { name: 'lifecycle_effect_runs_continuation_due' });
      c.index(['continuationAbandonedAt'], { name: 'lifecycle_effect_runs_continuation_abandoned' });
    });

    await builder.createCollection('lifecycleParameterHeads', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.string('scope').notNull();
      c.string('groupKey').notNull();
      c.string('status').notNull();
      c.integer('revision').notNull();
      c.unique(['scope', 'groupKey'], { name: 'lifecycle_parameter_heads_group' });
    });
    await builder.createCollection('lifecycleParameterVersions', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.json('payload').notNull();
      c.json('selectionCounts').notNull();
    });
    await builder.createCollection('lifecycleParameterSelections', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.string('versionId', { length: 64 }).notNull();
      c.string('ruleKey').notNull();
      c.integer('group').notNull();
      c.string('type').notNull();
      c.string('referenceId').notNull();
      c.index(['versionId'], { name: 'lifecycle_parameter_selections_version' });
    });
    await builder.createCollection('lifecycleParameterRequests', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.string('actorId').notNull();
      c.text('fingerprint').notNull();
      c.integer('revision').notNull();
    });
    await builder.createCollection('lifecycleParameterSnapshots', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.json('payload').notNull();
    });
    await builder.createCollection('lifecycleParameterUsages', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.json('payload').notNull();
      c.string('recordKey', { length: 64 }).notNull();
      c.datetimeTz('at').notNull();
      c.index(['recordKey', 'at', 'id'], { name: 'lifecycle_parameter_usages_record' });
    });
  },
  async down({ builder }) {
    for (const name of [
      'lifecycleParameterUsages',
      'lifecycleParameterSnapshots',
      'lifecycleParameterRequests',
      'lifecycleParameterSelections',
      'lifecycleParameterVersions',
      'lifecycleParameterHeads',
      'lifecycleEffectRuns',
      'lifecycleTransitions',
      'deviceRequests',
    ])
      await builder.dropCollection(name);
  },
});
