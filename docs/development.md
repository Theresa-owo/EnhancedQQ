# 开发约定

## 运行结构

LiteLoaderQQNT 从 `manifest.json` 发现插件，并分别加载主进程、预加载和渲染进程入口。主进程在 QQNT 消息事件上缓存并恢复消息，已恢复记录按账号隔离存储；预加载桥只向界面传递标记所需的消息 ID、方向和开关状态。渲染进程通过 `onSettingWindowCreated(view)` 挂载设置页；设置页样式放在 Shadow DOM 内，避免覆盖 QQ 和其他插件。Shadow DOM 会继承琉璃写在页面上的 `--ll-*` 动态色板变量，因此壁纸取色和明暗变化可以直接传入插件。

`src/renderer/config.js` 提供配置边界：它规范化 `features` 分区，更新前重新读取磁盘配置，并保留其他字段。遇到比当前更新的配置版本或写入失败时会抛出错误；设置界面显示该错误。旧版外观字段被保留，但不用于控制界面。

当前 LiteLoader profile 被多个 QQ 进程共用，因此 EnhancedQQ 配置也是共享的。同时修改同一份配置时没有跨进程锁，应避免在多个窗口同时编辑。当前 Tab 选择使用 QQ 本地存储，切换只控制可见的设置区域。

设置页的 Tab、标题、分组、文字和材质尺寸参考琉璃 1.3.2 的 `assets/panel.css`；不在 EnhancedQQ 内另设主题色或明暗模式。

Telegram 气泡的开关及原项目消息配置放在“聊天 → 外观”。样式从 `src/vendor/telegram-theme/telegram.scss` 提取消息相关 mixin 并生成；`telegram-bubbles.compat.css` 处理琉璃层级和 QQ 气泡装扮的视觉冲突。`patches/liuli-1.3.2-telegram.patch` 只在 Telegram 气泡启用时暂停琉璃对消息名称、分组、头像和引用的相应重排。

QQ 主题源色配置放在 `features.themeColor`；默认继续跟随壁纸。`patches/liuli-1.3.2-theme-color.patch` 让琉璃从 EnhancedQQ 读取固定源色，并在配置变更时重新生成 MCU 色板。Telegram 气泡默认引用琉璃的主题容器色，也可通过 `features.telegramBubbles.colorMode` 选择统一或分别设置；旧版分别指定的气泡颜色不会被丢弃。

发送排版开关保存在 `features.pangu.enabled`，默认开启。主进程只处理 QQ 的文本发送请求，保留提及和非文本元素，跳过机器人命令及本插件的红包口令；TTS 语音发送不经过文本消息排版。排版规则由参考插件锁定版本的 pangu.js 提供。

## 添加功能

1. 先明确功能的触发位置、作用范围及是否需要访问账号或消息数据。
2. 把功能逻辑放在独立模块中，通过 LiteLoader 支持的生命周期接入；不要把额外逻辑塞进配置界面。
3. 需要配置时，在配置模块中增加明确的默认值和校验，并保持既有字段兼容。不要为尚不存在的功能添加占位开关。
4. 设置 UI 使用本插件的 Shadow DOM，真实可用后再加入界面；同时覆盖有意义的行为测试。
5. 使用 README 中的 Node 命令测试，把 `manifest.json`、`assets` 和 `src` 更新到 LiteLoader 插件目录，再重启需要加载新版的 QQ 进程并检查实际界面。

`preview/` 是纯本地预览，使用浏览器本地存储和合成消息模拟配置与标记；它不能证明 QQ 主进程、LiteLoader 集成或真实撤回交互已通过验证。
