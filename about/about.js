const app = getApp();

Page({
  data: {
    version: '1.0.0',
    features: [
      {
        icon: '/assets/icons/ai.png',
        title: 'AI 助手',
        desc: '智能问答\n学业顾问'
      },
      {
        icon: '/assets/icons/schedule.png',
        title: '智能课表',
        desc: '自动提醒\n灵活查询'
      },
      {
        icon: '/assets/icons/score.png',
        title: '成绩分析',
        desc: 'GPA 计算\n学分追踪'
      },
      {
        icon: '/assets/icons/shopping.png',
        title: '校园商城',
        desc: '便捷购物\n快速配送'
      },
      {
        icon: '/assets/icons/lost.png',
        title: '寻物启事',
        desc: 'AI 匹配\n快速找回'
      },
      {
        icon: '/assets/icons/community.png',
        title: '校园社区',
        desc: '信息分享\n互动交流'
      }
    ],
    techStack: [
      { name: '前端', desc: '微信小程序 + WXML/WXSS/JS' },
      { name: '后端', desc: 'FastAPI + Python 3.10+' },
      { name: 'AI 模型', desc: 'LangChain + 微调大语言模型' },
      { name: '数据库', desc: 'PostgreSQL + Redis' },
      { name: '部署', desc: 'Docker + 云函数' }
    ],
    contacts: [
      {
        icon: '/assets/icons/email.png',
        label: '邮箱',
        value: 'contact@smartcampus.com'
      },
      {
        icon: '/assets/icons/wechat.png',
        label: '微信公众号',
        value: '智慧校园服务号'
      },
      {
        icon: '/assets/icons/phone.png',
        label: '客服热线',
        value: '400-xxx-xxxx'
      }
    ]
  },

  copyText(e) {
    const text = e.currentTarget.dataset.text;
    wx.setClipboardData({
      data: text,
      success: () => {
        app.toast('已复制到剪贴板');
      }
    });
  }
});
