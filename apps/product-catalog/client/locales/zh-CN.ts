import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  catalog: {
    title: '商品目录',
    heading: '发现日常好物',
    description: '浏览已发布商品。价格以美元显示。',
    product: '商品',
    price: '价格（美元）',
    app: '应用',
    docs: 'API 文档',
    download: '下载 CSV',
    downloadHint:
      'CSV 包含当前账号有权查看的商品，包括草稿。请先使用有查看权限的账号登录。',
    limit: '展示前 50 件已发布商品，下载最多包含 500 条有权查看的记录。',
    empty: '暂无已发布商品。',
    view: '查看商品',
    create: '创建商品',
    publish: '发布商品',
    viewer: '目录查看者',
    editor: '目录编辑者',
  },
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
};

export default zhCN;
