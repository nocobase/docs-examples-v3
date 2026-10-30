import { defineMigration } from '@nocobase/db';

/**
 * Serial numbers became unique after the first round of the device register. Existing duplicates are not changed
 * automatically: the migration stops and names them, so a person decides which device holds the real number.
 */
export default defineMigration({
  name: '202610300102_add_device_serial_number_unique',
  async up({ builder, query }) {
    const rows = await query
      .selectFrom('devices')
      .select(['assetTag', 'serialNumber'])
      .where('serialNumber', 'is not', null)
      .execute();
    const bySerial = new Map<string, string[]>();
    for (const row of rows as { assetTag: string; serialNumber: string }[])
      bySerial.set(row.serialNumber, [...(bySerial.get(row.serialNumber) ?? []), row.assetTag]);
    const duplicates = [...bySerial].filter(([, tags]) => tags.length > 1);
    if (duplicates.length)
      throw new Error(
        `Devices share serial numbers: ${duplicates.map(([serial, tags]) => `${serial} (${tags.join(', ')})`).join('; ')}. Correct the duplicates before applying this migration.`,
      );
    await builder.alterCollection('devices', (c) => {
      c.unique('serialNumber', { name: 'uq_devices_serial_number' });
    });
  },
  async down({ builder }) {
    await builder.alterCollection('devices', (c) => {
      c.dropConstraint('uq_devices_serial_number');
    });
  },
});
