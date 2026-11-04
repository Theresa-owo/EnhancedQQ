# EnhancedQQ

EnhancedQQ 是一个 Windows QQNT 的 LiteLoaderQQNT 插件，提供消息防撤回、发送排版、Telegram 风格气泡、在线文字转语音、红包辅助和 QQ 更新屏蔽。设置界面与[琉璃主题](https://github.com/LilycleHeart/qqnt-liuli-theme)的色板和动效相协调。

## 功能

| 分类 | 功能 |
| --- | --- |
| 聊天 → 消息功能 | 保留撤回的消息、可选显示自己撤回的消息、发送时自动 Pangu 排版、浏览器打开 B 站视频分享 |
| 聊天 → 菜单与回应 | 自定义消息右键菜单、完整 Emoji 回应面板、快捷回应及群成员头像右键管理 |
| 聊天 → 外观 | QQ 主题色与明暗模式、Telegram 气泡、对方昵称位置、自己头像显隐、气泡颜色 |
| 聊天 → 语音 | 微软 Edge 在线 TTS、音色选择、聊天框快捷开关 |
| 杂项 → 红包 | 普通 / 拼手气、专属和文字红包的自动处理与独立开关；文字口令可选发送后撤回 |
| 杂项 → QQ 更新 | 屏蔽 QQ 更新配置及更新操作，隐藏 QQ 的检查更新入口 |
| 关于 → EnhancedQQ 更新 | 自动或手动检查 GitHub 正式 Release，查看发布页并选择安装插件更新 |

Telegram 气泡可统一跟随主题、使用“自己主色 / 对方次色”、统一自定义颜色或分别指定颜色。主色 / 次色模式中，对方可以选主题中性灰或主题次色，昵称默认跟随主题强调色。

## 兼容环境

- Windows 版 QQNT。当前组合曾在 **QQ 9.9.37-54395、LiteLoaderQQNT 1.4.1 和琉璃 1.3.2** 上测试。
- 群头衔设置的兼容组件目前只适配 **QQ 9.9.37-54395 x64**，并在使用前核对内核文件；其他版本仍可使用秒级禁言。组件及其依赖 MinHook 的源码、许可证和构建脚本均位于 `src/native`。
- 琉璃上游声明支持 Windows QQ 9.9.36；9.9.37 是本项目使用补丁的测试组合，其他 QQ、加载器或琉璃版本不保证兼容。
- 安装源码依赖需要 [Node.js](https://nodejs.org/) 20 或更新版本、npm 和 [Git](https://git-scm.com/)。
- TTS 使用在线服务，需要联网。琉璃不是防撤回和 Pangu 的前置条件；需要完整的琉璃外观、主题色与气泡联动时请一并安装琉璃及下文的兼容补丁。

## 安装

### 1. 安装 LiteLoaderQQNT

先安装 Windows 版 QQNT，然后按照 [LiteLoaderQQNT 官方安装文档](https://liteloaderqqnt.github.io/guide/install.html)安装加载器。简要步骤如下：

1. 完全退出 QQ，备份准备修改的 QQ 启动文件。到 [LiteLoaderQQNT Releases](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT/releases) 下载并解压加载器到固定目录，例如 `D:\LiteLoaderQQNT`。
2. Windows QQNT 会检查自身文件。根据正在使用的 QQ 版本，按官方文档配置对应的文件校验补丁，或使用其列出的[社区安装工具](https://github.com/Mzdyl/LiteLoaderQQNT_Install)。本仓库不包含 QQ 可执行文件或文件校验补丁。
3. 手动安装时，找到 QQ 当前版本的 `resources\app` 目录；通常位于 `QQNT\versions\<版本号>\resources\app`，旧目录结构也可能直接位于 `QQNT\resources\app`。在其中创建 `app_launcher\LiteLoader.js`，将下面的路径替换成实际的加载器目录：

   ```js
   require(String.raw`D:\LiteLoaderQQNT`);
   ```

4. 将同一 `resources\app\package.json` 的 `main` 改为 `./app_launcher/LiteLoader.js`。安装工具可能已经完成步骤 3～4；具体路径以实际安装为准。
5. 如果 LiteLoaderQQNT 1.4.1 在新版 Electron 下因 `dirent.path` 报错而无法扫描插件，可将加载器 `src/main/store.js` 中 `scanPluginDirectory` 的路径拼接改为 `path.join(LiteLoader.path.plugins, dirent.name, "manifest.json")`。本仓库也提供对应的 [`liteloader-1.4.1-dirent.patch`](patches/liteloader-1.4.1-dirent.patch)；已修复的版本无需重复修改。
6. 启动 QQ，在设置左侧找到 **LiteLoaderQQNT**。看不到入口时，先检查加载器、QQ 版本及文件校验补丁是否匹配。QQ 更新后若启动入口被覆盖，需要重新按安装文档配置。

在 LiteLoaderQQNT 设置页可查看加载器目录和 **profile / 数据目录**。插件目录是该 profile 下的 `plugins`；如果配置了 `LITELOADERQQNT_PROFILE`，使用它指向的 profile，而不是假定加载器源码目录一定是数据目录。

### 2. 安装 EnhancedQQ

退出 QQ。从 [GitHub Releases](https://github.com/Theresa-owo/EnhancedQQ/releases/latest) 下载 `EnhancedQQ.zip`，将压缩包内的文件解压到 `<profile>\plugins\enhancedqq`。发布包已包含运行依赖，无需另行安装 npm 包。

也可以从源码安装。在 PowerShell 中，将下面的 `$profile` 换成上一步看到的 LiteLoaderQQNT profile 路径：

```powershell
$profile = 'D:\LiteLoaderQQNT'  # 改为自己的 LiteLoaderQQNT profile
$plugins = Join-Path $profile 'plugins'
New-Item -ItemType Directory -Path $plugins -Force | Out-Null
git clone https://github.com/Theresa-owo/EnhancedQQ.git (Join-Path $plugins 'enhancedqq')
Set-Location (Join-Path $plugins 'enhancedqq')
npm ci --omit=dev --ignore-scripts
```

也可以在本仓库的 **Code → Download ZIP** 下载源码，解压到 `plugins\enhancedqq`，然后在该目录运行同一条 `npm ci --omit=dev --ignore-scripts`。检查目录结构，`manifest.json` 应直接位于 `enhancedqq` 内，旁边有 `src`、`assets`、`patches` 和安装后生成的 `node_modules`，不要多套一层文件夹。

```text
<LiteLoaderQQNT profile>/
├─ plugins/
│  ├─ enhancedqq/
│  │  ├─ manifest.json
│  │  ├─ src/
│  │  ├─ patches/
│  │  └─ node_modules/
│  └─ liuli-dsh-theme/      # 可选，见下一步
└─ data/
   └─ enhancedqq/           # 首次运行后生成
```

更新源码后，请在 `enhancedqq` 目录再次运行 `npm ci --omit=dev --ignore-scripts`，然后重启 QQ。保留 `data/enhancedqq` 可保留设置和已恢复的撤回消息。

### 3. 搭配琉璃

1. 从 [琉璃项目](https://github.com/LilycleHeart/qqnt-liuli-theme)安装主题，插件目录应为 `<profile>\plugins\liuli-dsh-theme`，并确保其根目录直接包含 `manifest.json`。
2. 本项目的四份兼容补丁针对琉璃 **1.3.2** 原版提交 [`dfb42b7`](https://github.com/LilycleHeart/qqnt-liuli-theme/commit/dfb42b74899504d3ab259292d208e9621dea1f74)。它们让 Telegram 气泡、B 站分享与琉璃的消息分组、头像、外链、主题取色和明暗模式协同工作。
   全新安装且该目录不存在时，可以使用以下命令取得对应版本：

   ```powershell
   $profile = 'D:\LiteLoaderQQNT'  # 与安装 EnhancedQQ 时相同
   $liuli = Join-Path $profile 'plugins\liuli-dsh-theme'
   git clone https://github.com/LilycleHeart/qqnt-liuli-theme.git $liuli
   git -C $liuli checkout --detach dfb42b74899504d3ab259292d208e9621dea1f74
   ```

3. 先备份 `liuli-dsh-theme\renderer\index.js` 和 `liuli-dsh-theme\renderer\ark-external.js`。对于未经修改的上述版本，在 PowerShell 中执行：

   ```powershell
   $profile = 'D:\LiteLoaderQQNT'  # 与安装 EnhancedQQ 时相同
   $liuli = Join-Path $profile 'plugins\liuli-dsh-theme'
   $patchDir = Join-Path $profile 'plugins\enhancedqq\patches'
   $patches = @(
       (Join-Path $patchDir 'liuli-1.3.2-telegram.patch'),
       (Join-Path $patchDir 'liuli-1.3.2-theme-color.patch'),
       (Join-Path $patchDir 'liuli-1.3.2-theme-mode.patch'),
       (Join-Path $patchDir 'liuli-1.3.2-bili-external.patch')
   )
   git -C $liuli apply --check @patches
   if ($LASTEXITCODE -ne 0) { throw '琉璃补丁不匹配：请检查版本及是否已经应用。' }
   git -C $liuli apply @patches
   if ($LASTEXITCODE -ne 0) { throw '琉璃补丁应用失败。' }
   ```

   如果补丁检查失败，不要强行应用：确认琉璃是对应版本，并检查是否已打过补丁或自行修改过该文件。琉璃更新后也需要重新确认兼容性。
4. 启动 QQ，打开 **设置 → 琉璃** 选择壁纸；再打开 **设置 → EnhancedQQ → 聊天 → 外观** 设置主题色、明暗模式和气泡。启用 Telegram 气泡后，插件会尝试关闭 QQ 的 **设置 → 通用 → 个性化 → 聊天气泡**；若状态未同步，可在该处手动关闭。

### 4. 验证安装

重启 QQ 后，在设置左侧打开 **EnhancedQQ**。如果入口不存在，先确认 LiteLoaderQQNT 已加载、插件目录没有多套一层、`manifest.json` 存在且依赖安装成功。可在 LiteLoaderQQNT 插件列表中检查 EnhancedQQ 是否启用。

## 使用说明

- **防撤回**：在“聊天 → 消息功能”开启“保留撤回的消息”。“显示自己撤回的消息”是独立开关。插件只能恢复运行期间收到且仍在缓存中的消息；离线时已撤回的消息无法补回，媒体能否打开取决于 QQ 是否保留资源。
- **Pangu**：默认开启，发送时调整中英文、数字之间的间距及部分标点。以 `/` 开头的命令和 `@机器人 /命令` 自动跳过；在消息开头输入 `!PanguSkip ` 可跳过这一条，前缀不会发送。EnhancedQQ 自动发送的红包口令不会被排版。
- **B 站视频**：在“聊天 → 消息功能 → 分享”开启“浏览器打开 B 站视频”，点击聊天中的 B 站视频小程序卡片即可在系统默认浏览器打开；其他小程序仍按原来的方式处理。
- **菜单与回应**：在“聊天 → 菜单与回应”选择显示的消息右键菜单项，右键不同类型消息后会发现更多项目。开启“扩展表情回应”后，可按分类或中文名称搜索完整 Unicode Emoji，并在自建的“最近”中找到成功使用过的回应；快捷栏可选择追加到默认项目或只显示自选项目。开启“Reaction 轰炸”后，可在消息右键菜单选择单表情添加 / 取消循环或不重复的随机表情，并设置次数和请求间隔。回应通过 QQ 群消息接口发送，组合 Emoji 的实际可用性以 QQ 返回结果为准。
- **群管理**：开启“聊天 → 菜单与回应 → 头像右键管理”，在群聊里右键其他成员的消息头像。群主可以设置或清除成员头衔；群主与管理员可以输入整数秒禁言，输入 0 秒解除禁言。操作前插件会检查当前账号和目标成员的群权限。
- **外观**：在“聊天 → 外观”选择主题色、亮暗模式、对方昵称位置和自己头像。气泡颜色支持跟随主题、主色 / 次色、统一颜色和分别设置；高级消息样式按日间 / 夜间分别保存。
- **TTS**：在“聊天 → 语音”选择音色并开启 TTS，或通过聊天框左下角“+”菜单切换。开启后发送的纯文字会交给微软 Edge 在线语音合成并作为语音消息发出；失败时保留输入文字。
- **红包**：在“杂项 → 红包”开启需要的类型。普通红包和拼手气红包使用同一开关；文字红包会发送口令，可选择发送后撤回。当前 QQ 对已检查的语音红包只显示手机查看提示，插件无法读取其口令；语音 TTS 领取及直接领取尚未适配。
- **QQ 更新**：在“杂项 → QQ 更新”开启“屏蔽 QQ 更新”。插件会拦截已识别的 QQ 更新配置和下载 / 安装操作，隐藏 QQ 的“检查更新”，并在 QQ 通用设置加载时关闭“有新版本时自动安装 QQ”。关闭该功能后，可在 QQ 通用设置中自行重新开启自动安装。该功能对已加载 EnhancedQQ 的 QQ 进程生效，不删除已有更新文件；尚未加载插件的进程或其他安装工具不受控制。
- **EnhancedQQ 更新**：在“关于”中开启或关闭自动检查，也可手动检查。发现新版后可查看 Release，或选择安装其中的 `EnhancedQQ.zip`；安装完成后重启所有运行中的 QQ。更新会保留旧插件备份及 `data/enhancedqq` 下的设置和数据。QQ 自身更新屏蔽不影响插件检查。

设置保存在 `<profile>\data\enhancedqq\config.json`，同一个 profile 下的账号共用。已恢复的撤回消息保存在 `data\enhancedqq\recalled` 并按账号隔离；这些是本地数据，不包含在本仓库中。

## 开发与测试

```powershell
npm ci --ignore-scripts
node --test tests/*.test.js
node --check src/main.cjs
node --check src/renderer/index.js
```

`src/renderer/` 包含设置、消息布局和主题联动；`src/recall-*.cjs` 处理撤回消息；`patches/` 存放版本限定的加载器与琉璃补丁。`preview/` 提供合成界面，部分预览需要额外提供琉璃 CSS，不能替代真实 QQ 验证。开发约定见 [docs/development.md](docs/development.md)。

发布新版时，将 `manifest.json` 和 `package.json` 的版本设为相同值，并以对应版本号（如 `v0.9.6`）发布 GitHub 正式 Release。工作流会构建包含运行依赖的 `EnhancedQQ.zip` 并附加到 Release；也可运行 `node scripts/package-release.cjs` 手动生成。自动安装需要 Release 资源带 GitHub 提供的 SHA-256 摘要，未提供安装包时仍可打开发布页。

## 致谢与许可

- Telegram 气泡样式基于 [LiteLoaderQQNT-Telegram-Theme](https://github.com/festoney8/LiteLoaderQQNT-Telegram-Theme) 的 `v4` 提交 `42fda79c9ba157831be37d6c31ebebc3f9a4d919`，原始代码及 MIT 许可保留在 `src/vendor/telegram-theme/`。
- Pangu 排版使用 [LiteLoaderQQNT-Pangu](https://github.com/MisaLiu/LiteLoaderQQNT-Pangu) 锁定的 [MisaLiu/pangu.js](https://github.com/MisaLiu/pangu.js) `9d36f9ebf69ce3a88f92711b5b69cad24104af1a`，MIT 许可保留在 `src/vendor/pangu/`。
- 红包接口形状参考 [LiteLoaderQQNT-Grab-RedBag](https://github.com/WJZ-P/LiteLoaderQQNT-Grab-RedBag)；主题兼容适配参考[琉璃](https://github.com/LilycleHeart/qqnt-liuli-theme)。
- 群消息回应接口和 QQ 本地表情资源结构参考 [QQNT-Toolbox](https://github.com/MeiYongAI/QQNT-Toolbox)。
- QQ 更新配置拦截参考 [LiteLoaderQQNT-Kill-Update](https://github.com/xh321/LiteLoaderQQNT-Kill-Update)。
- Emoji 目录来自 Unicode Emoji 18.0 与 CLDR 中文注释，字体使用 Google Noto Color Emoji；来源和许可保留在 `src/vendor/unicode-emoji/`。群头衔协议格式参考 [NapCatQQ](https://github.com/NapNeko/NapCatQQ)。

项目许可见 [GPL-3.0](LICENSE)；第三方代码保留各自的许可声明。
