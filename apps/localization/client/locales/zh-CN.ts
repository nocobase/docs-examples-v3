import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import systemZhCN from './system/zh-CN.js';
import type { AppResource } from './en-US.js';

const zhCN = {
  ...systemZhCN,
  ...fileUi,
  navigation: { ...systemZhCN.navigation, catalog: '商品目录' },
  catalog: {
    title: '商品目录',
    description: '演示商品。修改只保存在当前浏览器标签页中，刷新后恢复。',
    search: '搜索商品',
    empty: '没有匹配的商品。',
    count_one: '{{count}} 件商品',
    count_other: '{{count}} 件商品',
    name: '商品名称',
    price: '价格（美元）',
    stock: '库存',
    updated: '更新时间',
    edit: '编辑',
    editTitle: '编辑商品',
    editDescription: '修改演示商品名称，保存后查看翻译后的确认文案。',
    required: '请输入商品名称。',
    save: '保存',
    saving: '保存中…',
    saved: '已保存“{{name}}”。',
    simulateFailure: '模拟保存失败',
    failed: '模拟保存失败。输入仍然保留；关闭模拟失败后重试。',
    notFound: '该演示商品不存在。',
    shipping: '两个工作日内发货。',
    language: '语言',
    examples: '翻译示例',
    fallbackTitle: '缺失翻译',
    fallbackHelp: '日语资源有意省略发货说明，该项会回退到配置的默认语言。',
    pluginTitle: '插件文案',
    pluginHelp: '这个标签来自多语言插件的命名空间，由应用覆盖。',
    currentLocale: '当前语言：{{locale}}',
    cancel: '取消',
  },
  overrides: {
    '@nocobase/app-plugin-i18n': { language: { label: '商店语言' } },
  },
} satisfies AppResource;
export default zhCN;
