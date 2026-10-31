import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  appearance: {
    ...systemZhCN.appearance,
    themes: { ...systemZhCN.appearance.themes, brand: '品牌' },
  },
  products: {
    title: '商品目录',
    description: '使用你偏好的外观浏览商品目录。',
    reset: '重置商品',
    name: '商品',
    sku: 'SKU',
    price: '价格',
    priceLabel: '价格（美元）',
    stock: '库存',
    availability: '供货状态',
    outOfStock: '缺货',
    lowStock: '库存不足',
    inStock: '有货',
    inventory: '库存',
    editHint: '点击商品名称编辑商品信息。',
    memoryNotice: '刷新页面后商品编辑将复原。外观偏好保存在当前浏览器中。',
    appliedMode: '当前模式：{{mode}}',
    savedAppearance: '所选外观应用于整个应用。',
    editTitle: '编辑商品',
    editDescription: '修改本次浏览中的商品名称和价格。',
    nameRequired: '请输入商品名称。',
    priceInvalid: '请输入大于或等于零的价格。',
    notFound: '未找到商品。',
  },
};

export default zhCN;
