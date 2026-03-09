const InboundService = require('../services/inbound.service');
const PushService = require('../services/push.service');
const ResponseUtil = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 入站控制器
 * 处理外部服务的 Webhook 回调
 */
class InboundController {
  /**
   * 处理入站请求
   * POST /api/inbound/:token
   */
  static async handleInbound(req, res) {
    try {
      // 从 URL 获取 token
      const { token } = req.params;

      if (!token) {
        return ResponseUtil.badRequest(res, '缺少接口令牌');
      }

      // 获取 endpoint（由中间件注入）
      const endpoint = req.endpoint;

      if (!endpoint) {
        return ResponseUtil.notFound(res, '接口不存在或已禁用');
      }

      // 检查是否启用了入站配置
      if (!endpoint.inbound_config?.enabled) {
        return ResponseUtil.badRequest(res, '该接口未启用入站接收功能，请在接口配置中开启');
      }

      // 获取请求数据
      const payload = req.body;

      if (!payload || Object.keys(payload).length === 0) {
        return ResponseUtil.badRequest(res, '请求体不能为空');
      }

      logger.info(`[Inbound] 收到入站请求: endpoint=${endpoint.name}, token=${token.substring(0, 8)}...`);

      // 处理入站数据，转换为标准消息格式
      const message = InboundService.processInbound(endpoint, payload);

      // 获取真实 IP
      const getRealIP = (req) => {
        const xRealIP = req.get('X-Real-IP');
        if (xRealIP) return xRealIP;
        const xForwardedFor = req.get('X-Forwarded-For');
        if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
        return req.ip;
      };

      // 执行推送
      const result = await PushService.pushByToken(token, message, getRealIP(req));

      if (result.success) {
        logger.info(`[Inbound] 推送成功: endpoint=${endpoint.name}`);
        return ResponseUtil.success(res, result, '推送成功');
      } else {
        logger.warn(`[Inbound] 部分推送失败: endpoint=${endpoint.name}`);
        return ResponseUtil.error(res, '部分推送失败', 400, 400, result);
      }
    } catch (error) {
      logger.error('[Inbound] 处理失败:', error);
      return ResponseUtil.badRequest(res, error.message);
    }
  }

  /**
   * 测试入站配置
   * POST /api/inbound/:token/test
   */
  static async testInbound(req, res) {
    try {
      const endpoint = req.endpoint;

      if (!endpoint) {
        return ResponseUtil.notFound(res, '接口不存在');
      }

      const payload = req.body;

      if (!payload || Object.keys(payload).length === 0) {
        return ResponseUtil.badRequest(res, '请提供测试数据');
      }

      // 处理入站数据
      const message = InboundService.processInbound(endpoint, payload);

      // 返回解析结果，不实际推送
      return ResponseUtil.success(res, {
        original: payload,
        parsed: message,
      }, '解析成功');
    } catch (error) {
      logger.error('[Inbound] 测试失败:', error);
      return ResponseUtil.badRequest(res, error.message);
    }
  }
}

module.exports = InboundController;
