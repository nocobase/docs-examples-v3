import agentChat from '../extensions/nocobase-agent-chat/locales/zh-CN.js';
import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  ...agentChat,
  agentDemo: {
    newSkill: '新建 Skill',
    skillDetails: 'Skill 详情',
    connectRuntime: '连接运行环境',

    models: '模型服务',
    skills: 'Skills',
    runtimes: '运行环境',
    agents: '机器 Agent',
    usage: '用量',
    releaseNotes: '起草发布说明',
    releaseNotesError: '无法打开发布说明。请检查 Skill 和模型配置后重试。',
  },
};

export default zhCN;
