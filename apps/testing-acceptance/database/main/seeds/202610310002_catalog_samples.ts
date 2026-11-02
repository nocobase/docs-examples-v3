import { defineSeed } from '@nocobase/db';
export default defineSeed({
  name: '202610310002_catalog_samples',
  sample: true,
  async run(context) {
    const repository = (name: string) => context.repository(name);
    for (const values of [
      {
        id: 'office',
        title: 'Office',
        internalNote: 'Not part of the public catalog',
      },
      {
        id: 'travel',
        title: 'Travel',
        internalNote: 'Internal purchasing notes',
      },
    ]) {
      if (
        !(await repository('catalogCategories').exists({
          filter: { id: values.id },
        }))
      )
        await repository('catalogCategories').createOne({ values });
    }
    for (const values of [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Canvas Backpack',
        priceCents: 4900,
        published: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Desk Lamp',
        priceCents: 3500,
        published: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Travel Mug',
        priceCents: 1800,
        published: false,
      },
    ]) {
      if (
        !(await repository('catalogProducts').exists({
          filter: { id: values.id },
        }))
      )
        await repository('catalogProducts').createOne({ values });
    }
  },
});
