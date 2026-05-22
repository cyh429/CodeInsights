import { ipcMain } from 'electron'
import { DINGTALK_IPC_CHANNELS, FEISHU_IPC_CHANNELS, WECHAT_IPC_CHANNELS } from '@codeinsights/shared'
import type {
  DingTalkBotConfigInput,
  DingTalkBridgeState,
  DingTalkConfig,
  DingTalkConfigInput,
  DingTalkMultiBotConfig,
  DingTalkMultiBridgeState,
  DingTalkTestResult,
  FeishuBotConfigInput,
  FeishuBridgeState,
  FeishuChatBinding,
  FeishuConfig,
  FeishuConfigInput,
  FeishuMultiBotConfig,
  FeishuMultiBridgeState,
  FeishuNotifyMode,
  FeishuPresenceReport,
  FeishuTestResult,
  FeishuUpdateBindingInput,
  WeChatBridgeState,
  WeChatConfig,
} from '@codeinsights/shared'
import {
  getDingTalkConfig,
  getDingTalkMultiBotConfig,
  removeDingTalkBot,
  saveDingTalkBotConfig,
  saveDingTalkConfig,
} from '../lib/dingtalk-config'
import { dingtalkBridgeManager } from '../lib/dingtalk-bridge-manager'
import {
  getFeishuConfig,
  getFeishuMultiBotConfig,
  removeFeishuBot,
  saveFeishuBotConfig,
  saveFeishuConfig,
} from '../lib/feishu-config'
import { feishuBridgeManager } from '../lib/feishu-bridge-manager'
import { presenceService } from '../lib/feishu-presence'
import { getWeChatConfig } from '../lib/wechat-config'
import { wechatBridge } from '../lib/wechat-bridge'

export function registerBotHubIpcHandlers(): void {
  // ===== 飞书集成 =====

  // --- 旧 API（向后兼容，操作 bots[0]）---

  // 获取飞书配置
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.GET_CONFIG,
    async (): Promise<FeishuConfig> => {
      return getFeishuConfig()
    }
  )

  // 保存飞书配置（旧格式，操作 bots[0]）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.SAVE_CONFIG,
    async (_, input: FeishuConfigInput): Promise<FeishuConfig> => {
      const config = saveFeishuConfig(input)
      // 配置变更后，重启对应的 Bot
      const multi = getFeishuMultiBotConfig()
      const firstBot = multi.bots[0]
      if (firstBot) {
        if (input.enabled && input.appId && input.appSecret) {
          await feishuBridgeManager.restartBot(firstBot.id)
        } else if (!input.enabled) {
          feishuBridgeManager.stopBot(firstBot.id)
        }
      }
      return config
    }
  )

  // 启动飞书 Bridge（旧格式，启动所有 Bot）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.START_BRIDGE,
    async (): Promise<void> => {
      await feishuBridgeManager.startAll()
    }
  )

  // 停止飞书 Bridge（旧格式，停止所有 Bot）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.STOP_BRIDGE,
    async (): Promise<void> => {
      feishuBridgeManager.stopAll()
    }
  )

  // 获取飞书 Bridge 状态（旧格式，返回第一个 Bot 状态）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.GET_STATUS,
    async (): Promise<FeishuBridgeState> => {
      const states = feishuBridgeManager.getStates()
      const first = Object.values(states.bots)[0]
      return first ?? { status: 'disconnected', activeBindings: 0 }
    }
  )

  // --- 新 API（多 Bot v2）---

  // 获取多 Bot 配置
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.GET_MULTI_CONFIG,
    async (): Promise<FeishuMultiBotConfig> => {
      return getFeishuMultiBotConfig()
    }
  )

  // 保存单个 Bot 配置
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.SAVE_BOT_CONFIG,
    async (_, input: FeishuBotConfigInput) => {
      const saved = saveFeishuBotConfig(input)
      // 配置变更后自动重启或停止（不阻塞保存结果）
      if (saved.enabled && saved.appId && saved.appSecret) {
        feishuBridgeManager.restartBot(saved.id).catch((err) => {
          console.error(`[飞书 IPC] Bot "${saved.name}" 重启失败:`, err)
        })
      } else {
        feishuBridgeManager.stopBot(saved.id)
      }
      return saved
    }
  )

  // 删除 Bot
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.REMOVE_BOT,
    async (_, botId: string) => {
      feishuBridgeManager.stopBot(botId)
      return removeFeishuBot(botId)
    }
  )

  // 启动单个 Bot
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.START_BOT,
    async (_, botId: string) => {
      await feishuBridgeManager.startBot(botId)
    }
  )

  // 停止单个 Bot
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.STOP_BOT,
    async (_, botId: string) => {
      feishuBridgeManager.stopBot(botId)
    }
  )

  // 获取多 Bot 状态
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.GET_MULTI_STATUS,
    async (): Promise<FeishuMultiBridgeState> => {
      return feishuBridgeManager.getStates()
    }
  )

  // 测试飞书连接
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.TEST_CONNECTION,
    async (_, appId: string, appSecret: string): Promise<FeishuTestResult> => {
      return feishuBridgeManager.testConnection(appId, appSecret)
    }
  )

  // 获取活跃绑定列表
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.LIST_BINDINGS,
    async (): Promise<FeishuChatBinding[]> => {
      return feishuBridgeManager.listAllBindings()
    }
  )

  // 更新绑定（工作区/会话）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.UPDATE_BINDING,
    async (_, input: FeishuUpdateBindingInput): Promise<FeishuChatBinding | null> => {
      const bridge = feishuBridgeManager.findBridgeByChatId(input.chatId)
      return bridge?.updateBinding(input) ?? null
    }
  )

  // 移除绑定
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.REMOVE_BINDING,
    async (_, chatId: string): Promise<boolean> => {
      const bridge = feishuBridgeManager.findBridgeByChatId(chatId)
      return bridge?.removeBinding(chatId) ?? false
    }
  )

  // 上报用户在场状态
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.REPORT_PRESENCE,
    async (_, report: FeishuPresenceReport): Promise<void> => {
      presenceService.updatePresence(report)
    }
  )

  // 设置会话通知模式
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.SET_SESSION_NOTIFY,
    async (_, sessionId: string, mode: FeishuNotifyMode): Promise<void> => {
      // 通知模式需要发到所有 Bridge（不确定哪个 Bridge 持有该 session）
      for (const bridge of feishuBridgeManager.getAllBridges().values()) {
        bridge.setSessionNotifyMode(sessionId, mode)
      }
    }
  )

  // ===== 钉钉集成 =====

  // 获取钉钉配置（旧 API，向后兼容）
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.GET_CONFIG,
    async (): Promise<DingTalkConfig> => {
      return getDingTalkConfig()
    }
  )

  // 保存钉钉配置（旧 API，向后兼容）
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.SAVE_CONFIG,
    async (_, input: DingTalkConfigInput): Promise<DingTalkConfig> => {
      return saveDingTalkConfig(input)
    }
  )

  // 测试钉钉连接
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.TEST_CONNECTION,
    async (_, clientId: string, clientSecret: string): Promise<DingTalkTestResult> => {
      return dingtalkBridgeManager.testConnection(clientId, clientSecret)
    }
  )

  // 启动钉钉 Bridge（旧 API，启动第一个 Bot）
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.START_BRIDGE,
    async (): Promise<void> => {
      await dingtalkBridgeManager.startAll()
    }
  )

  // 停止钉钉 Bridge（旧 API，停止所有 Bot）
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.STOP_BRIDGE,
    async (): Promise<void> => {
      dingtalkBridgeManager.stopAll()
    }
  )

  // 获取钉钉 Bridge 状态（旧 API，返回第一个 Bot 状态）
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.GET_STATUS,
    async (): Promise<DingTalkBridgeState> => {
      const states = dingtalkBridgeManager.getStates()
      const first = Object.values(states.bots)[0]
      return first ?? { status: 'disconnected' }
    }
  )

  // --- 钉钉多 Bot v2 API ---

  // 获取多 Bot 配置
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.GET_MULTI_CONFIG,
    async (): Promise<DingTalkMultiBotConfig> => {
      return getDingTalkMultiBotConfig()
    }
  )

  // 保存单个 Bot 配置
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.SAVE_BOT_CONFIG,
    async (_, input: DingTalkBotConfigInput) => {
      const saved = saveDingTalkBotConfig(input)
      // 配置变更后自动重启或停止（不阻塞保存结果）
      if (saved.enabled && saved.clientId && saved.clientSecret) {
        dingtalkBridgeManager.restartBot(saved.id).catch((err) => {
          console.error(`[钉钉 IPC] Bot "${saved.name}" 重启失败:`, err)
        })
      } else {
        dingtalkBridgeManager.stopBot(saved.id)
      }
      return saved
    }
  )

  // 删除 Bot
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.REMOVE_BOT,
    async (_, botId: string) => {
      dingtalkBridgeManager.stopBot(botId)
      return removeDingTalkBot(botId)
    }
  )

  // 启动单个 Bot
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.START_BOT,
    async (_, botId: string) => {
      await dingtalkBridgeManager.startBot(botId)
    }
  )

  // 停止单个 Bot
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.STOP_BOT,
    async (_, botId: string) => {
      dingtalkBridgeManager.stopBot(botId)
    }
  )

  // 获取多 Bot 状态
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.GET_MULTI_STATUS,
    async (): Promise<DingTalkMultiBridgeState> => {
      return dingtalkBridgeManager.getStates()
    }
  )

  // ===== 微信集成 =====

  // 获取微信配置
  ipcMain.handle(
    WECHAT_IPC_CHANNELS.GET_CONFIG,
    async (): Promise<WeChatConfig> => {
      return getWeChatConfig()
    }
  )

  // 开始扫码登录
  ipcMain.handle(
    WECHAT_IPC_CHANNELS.START_LOGIN,
    async (): Promise<void> => {
      await wechatBridge.startLogin()
    }
  )

  // 登出
  ipcMain.handle(
    WECHAT_IPC_CHANNELS.LOGOUT,
    async (): Promise<void> => {
      wechatBridge.logout()
    }
  )

  // 启动 Bridge（用已有凭证）
  ipcMain.handle(
    WECHAT_IPC_CHANNELS.START_BRIDGE,
    async (): Promise<void> => {
      await wechatBridge.start()
    }
  )

  // 停止 Bridge
  ipcMain.handle(
    WECHAT_IPC_CHANNELS.STOP_BRIDGE,
    async (): Promise<void> => {
      wechatBridge.stop()
    }
  )

  // 获取 Bridge 状态
  ipcMain.handle(
    WECHAT_IPC_CHANNELS.GET_STATUS,
    async (): Promise<WeChatBridgeState> => {
      return wechatBridge.getStatus()
    }
  )
}
