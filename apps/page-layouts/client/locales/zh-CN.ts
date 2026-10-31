import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  layouts: {
    brand: 'Northstar Supply',
    title: '商品目录',
    longTitle: '用于区域配送与季节性补货计划的商品目录',
    description: '浏览演示商品，比较不同的页面布局。',
    product: '商品',
    sku: 'SKU',
    category: '分类',
    warehouse: '仓库',
    views: '查看方式',
    lighting: '灯具',
    furniture: '家具',
    summary: '摘要',
    details: '详情',
    longHeading: '长标题',
    shortHeading: '短标题',
    filters: '商品筛选',
    search: '搜索商品',
    searchPlaceholder: '按商品名称搜索',
    filterHelp: '打开子页面时保留筛选状态，刷新后复原。',
    clear: '清除搜索',
    empty: '没有匹配的商品。',
    missing: '此演示商品不存在。',
    handling: '搬运说明',
    handlingNote:
      '搬运说明 {{number}}：保留商品原包装。发货前检查外箱，并存放在干燥、平整的货架上。',
    done: '完成',
    summaryTitle: '商品摘要',
    drawerTitle: '商品详情',
    readOnly: '用于布局示例的虚构商品数据。',
    back: '返回商品目录',
    detailDescription: '此页面覆盖目录时，应用导航仍可使用。',
    detailSections: '商品信息栏目',
    overview: '概览',
    guide: '目录指南',
    guideDescription: '不带应用侧边栏的独立页面。',
    guideBody:
      '登录后可以浏览商品目录。商品名称、仓库与搬运说明均为虚构数据，此示例不修改库存。',
    openCatalog: '打开商品目录',
  },
};

export default zhCN;
