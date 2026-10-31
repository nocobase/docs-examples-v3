import approvalUi from '../extensions/nocobase-approval-ui/locales/zh-CN.js';
import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  ...approvalUi,
  catalog: {
    demoNav: 'UI 示例',
    tabs: {
      catalog: '商品目录',
      review: '评审区块',
      customize: '组件变体',
    },
    title: '商品目录',
    description: '用示例商品体验组件。修改保留到刷新页面为止。',
    search: '搜索商品…',
    noResults: '没有匹配的商品。',
    name: '商品名称',
    category: '分类',
    availability: '库存状态',
    rowActions: '{{name}} 的操作',
    edit: '编辑',
    editTitle: '编辑商品',
    editDescription: '修改此 UI 示例中的名称，不保存业务记录。',
    cancel: '取消',
    save: '保存修改',
    saving: '正在保存…',
    saved: '商品名称已在当前会话中更新。',
    missing: '此示例商品不存在。',
    required: '请填写内容。',
    failSave: '模拟保存失败',
    failureHint: '使用此演示控件体验保存失败与重试。',
    saveFailed: '模拟保存失败。输入仍然保留，请关闭失败模拟后重试。',
    discardTitle: '放弃修改？',
    discardDescription: '尚未保存的商品名称将丢失。',
    keepEditing: '继续编辑',
    discard: '放弃',
    stock: {
      out: '缺货',
      low: '库存不足',
      available: '有货',
    },
    review: {
      title: '商品评审',
      description:
        '用示例人员和记录展示 Arc desk lamp 的评审界面，不执行审批流程。',
      submitted: '已提交商品资料',
      contentReview: '内容评审',
      waiting: '等待评审',
      initialNote: '商品照片和规格已准备完成。',
      noteAdded: '添加了备注',
      addNote: '添加评审备注',
      note: '评审备注',
      refused: '示例拒绝了本次备注。输入已保留，再次提交可重试。',
      reset: '重置示例',
      progress: '评审进度',
      history: '评审历史',
      actions: '评审备注',
      failNext: '拒绝下一次备注',
      failureReady: '下一次备注将被拒绝',
    },
    custom: {
      title: '库存标签变体',
      description: '同一业务组件用于商品表格和这些卡片。',
      units: '库存 {{count}} 件',
      units_one: '库存 {{count}} 件',
      units_other: '库存 {{count}} 件',
    },
  },
};

export default zhCN;
