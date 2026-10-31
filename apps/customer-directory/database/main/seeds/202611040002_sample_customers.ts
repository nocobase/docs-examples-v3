import { defineSeed } from '@nocobase/db';
export default defineSeed({
  name: '202611040002_sample_customers', sample: true,
  async run(context) {
    const names = ['Acorn Studio', 'Alpine Goods', 'Amber Kitchen', 'Atlas Bikes', 'Birch & Co', 'Blue Harbor', 'Cedar Market', 'Cloud Nine', 'Coral Works', 'Dawn Supply', 'Elm Design', 'Field Notes', 'Forest Lane', 'Golden Hour', 'Harbor Books', 'Juniper Lab', 'Lake House', 'Maple Coffee', 'Northstar Goods', 'Olive Grove', 'Pine Workshop', 'River Press', 'Willow Home'];
    for (const [i, name] of names.entries()) {
      const id = `customer-${String(i + 1).padStart(2, '0')}`;
      if (await context.repository('customers').findOne({ filter: { id } })) continue;
      await context.repository('customers').createOne({ values: {
        id, name, contact: ['Avery Morgan', 'Jordan Lee', 'Casey Rivera', 'Taylor Chen'][i % 4],
        email: `contact${i + 1}@example.test`, status: i % 4 === 0 ? 'inactive' : 'active',
      } });
    }
  },
});
