export class DemoProducts {
  private readonly records = new Map([
    ['lamp', { id: 'lamp', sku: 'LMP-001', name: 'Arc desk lamp' }],
    ['chair', { id: 'chair', sku: 'CHR-002', name: 'Oak studio chair' }],
    ['shelf', { id: 'shelf', sku: 'SHF-003', name: 'Modular shelf' }],
  ]);
  list() {
    return [...this.records.values()].map((product) => ({ ...product }));
  }
  rename(id: string, name: string) {
    const product = this.records.get(id);
    if (!product) return undefined;
    const saved = { ...product, name };
    this.records.set(id, saved);
    return { ...saved };
  }
}
