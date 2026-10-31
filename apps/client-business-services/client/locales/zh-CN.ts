import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  serviceProducts: {
    title: '商品目录',
    description: '编辑商品，观察列表和两个变更计数同步更新。',
    catalog: '商品',
    name: '商品名称',
    sku: 'SKU',
    edit: '编辑',
    editor: '编辑商品',
    select: '请选择要编辑的商品。',
    save: '保存修改',
    saving: '保存中…',
    cancel: '取消请求',
    saved: '商品已保存。',
    failed: '保存失败，已保留草稿。',
    cancelled: '请求已取消。请刷新列表，确认服务端是否已保存修改。',
    required: '请输入 1–80 个字符的商品名称。',
    refresh: '刷新列表',
    loadFailed: '无法加载商品，请点击刷新列表重试。',
    mode: '响应模式',
    normal: '正常',
    slow: '慢请求（3 秒）',
    fail: '失败',
    primary: '目录变更',
    secondary: '第二个视图',
    count: '成功修改：{{count}}',
    hide: '隐藏第二个视图',
    show: '显示第二个视图',
    scope:
      '计数只统计当前浏览器应用收到的成功响应。商品修改在刷新页面后保留，服务端重启后复原。',
    slowHint: '慢请求先保存，再延迟返回响应。取消只停止等待，不撤销保存。',
  },
};

export default zhCN;
