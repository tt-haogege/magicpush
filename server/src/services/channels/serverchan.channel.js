const axios = require('axios');
const BaseChannel = require('./base.channel');

/**
 * Server酱适配器
 * 官方文档: https://sct.ftqq.com/
 */
class ServerChanChannel extends BaseChannel {
  constructor(config) {
    super(config);
    this.sendKey = config.sendKey;
    this.apiUrl = `https://sctapi.ftqq.com/${config.sendKey}.send`;
  }

  async send(message) {
    const { title, content, type = 'text' } = message;

    // Server酱标题不能为空
    const messageTitle = title || '通知';

    // 构建消息内容
    let desp = content;
    if (type === 'markdown' || type === 'html') {
      // Server酱支持Markdown，直接使用
      desp = content;
    }

    const payload = {
      title: messageTitle,
      desp: desp,
    };

    // 如果配置了推送渠道，添加到payload
    if (this.config.channel) {
      payload.channel = this.config.channel;
    }

    const response = await axios.post(this.apiUrl, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
      transformRequest: [(data) => {
        // 将对象转换为 URL 编码格式
        const params = new URLSearchParams();
        for (const key in data) {
          params.append(key, data[key]);
        }
        return params.toString();
      }],
    });

    if (response.data.code !== 0) {
      throw new Error(`Server酱发送失败: ${response.data.message}`);
    }

    return {
      success: true,
      messageId: response.data.data?.pushid,
    };
  }

  validate(config) {
    if (!config.sendKey || config.sendKey.trim() === '') {
      return { valid: false, message: 'SendKey不能为空' };
    }
    return { valid: true, message: '' };
  }

  async test() {
    try {
      await this.send({
        title: '测试消息',
        content: '这是一条来自魔法推送的测试消息',
        type: 'text',
      });
      return { success: true, message: '连接测试成功' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  static getName() {
    return 'Server酱';
  }

  static getDescription() {
    return 'Server酱微信推送服务，将消息推送到微信';
  }

  static getConfigFields() {
    return [
      {
        name: 'sendKey',
        label: 'SendKey',
        type: 'text',
        required: true,
        placeholder: '请输入Server酱SendKey',
        description: '从Server酱官网获取的SendKey',
      },
      {
        name: 'channel',
        label: '推送渠道',
        type: 'text',
        required: false,
        placeholder: '可选，如：9',
        description: '指定推送渠道，如9=Android，留空使用默认渠道',
      },
    ];
  }
}

module.exports = ServerChanChannel;
