import type { PartialLocaleResource } from '@nocobase/i18n';
import type enUS from './en-US.js';

// Deliberately partial: template copy and catalog.shipping use the fallback chain.
const jaJP = {
  navigation: {
    catalog: '商品カタログ',
  },
  actions: {
    language: '言語',
    close: '閉じる',
  },
  catalog: {
    title: '商品カタログ',
    description:
      'サンプル商品です。変更は現在のタブ内だけに保存され、再読み込みすると元に戻ります。',
    search: '商品を検索',
    empty: '一致する商品がありません。',
    count_one: '商品 {{count}} 件',
    count_other: '商品 {{count}} 件',
    name: '商品名',
    price: '価格（米ドル）',
    stock: '在庫',
    updated: '更新日時',
    edit: '編集',
    editTitle: '商品を編集',
    editDescription:
      'サンプルの商品名を変更し、保存後のメッセージを確認します。',
    required: '商品名を入力してください。',
    save: '保存',
    saving: '保存中…',
    saved: '「{{name}}」を保存しました。',
    simulateFailure: '保存の失敗を再現',
    failed:
      '保存の失敗を再現しました。入力は保持されています。失敗の再現を解除して再試行してください。',
    notFound: 'このサンプル商品は存在しません。',
    language: '言語',
    examples: '翻訳の例',
    fallbackTitle: '未翻訳の項目',
    fallbackHelp:
      '日本語リソースには発送案内がありません。設定された既定の言語にフォールバックします。',
    pluginTitle: 'プラグインの文言',
    pluginHelp:
      'このラベルは多言語プラグインの名前空間に属し、アプリで上書きしています。',
    currentLocale: '現在の言語：{{locale}}',
    cancel: 'キャンセル',
  },
  overrides: {
    '@nocobase/app-plugin-i18n': {
      language: {
        label: 'ストアの言語',
      },
    },
  },
} satisfies PartialLocaleResource<typeof enUS>;
export default jaJP;
