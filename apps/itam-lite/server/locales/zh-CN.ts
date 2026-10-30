import type { AppServerResource } from './en-US.js';

const zhCN: AppServerResource = {
  notifications: {
    approvalRequested: {
      title: '{{requestNo}} 等待你审批',
      body: '有一个设备领用申请等待资产管理员审批。',
    },
    readyToIssue: {
      title: '{{requestNo}} 可以发放了',
      body: '请选择一台在库设备发放给申请人。',
    },
    approved: {
      title: '{{requestNo}} 已批准',
      body: 'IT 支持会为你发放设备。',
    },
    rejected: {
      title: '{{requestNo}} 被驳回',
      body: '原因：{{comment}}',
    },
    issued: {
      title: '{{requestNo}}：设备已发放',
      body: '设备已登记在你名下。',
    },
  },
};

export default zhCN;
