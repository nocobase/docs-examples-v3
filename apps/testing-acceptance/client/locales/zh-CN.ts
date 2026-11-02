import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  products: {
    title: '商品',
    description: '创建草稿，检查价格，再发布到公开目录。',
    name: '商品名称',
    price: '价格（分）',
    save: '创建草稿',
    saving: '正在保存…',
    saved: '草稿已创建。',
    failed: '无法保存商品，填写内容已保留，请重试。',
    loading: '正在加载商品…',
    loadFailed: '无法加载商品。',
    retry: '重试',
    empty: '暂无商品。',
    status: '状态',
    draft: '草稿',
    published: '已发布',
    publish: '发布',
    actions: '操作',
    refresh: '刷新',
    publicCatalog: '公开目录',
    export: '下载 CSV',
    readOnly: '当前账号可以查看商品，但不能创建或发布。',
    denied: '当前账号没有商品访问权限。',
    publishFailed: '无法发布商品，请刷新后重试。',
  },
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
