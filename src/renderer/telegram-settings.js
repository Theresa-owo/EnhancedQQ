import { readConfig, writeConfig } from "./config.js";
import { telegramDefinitions, telegramSettings, telegramValue, validTelegramValue, liuliMode } from "./telegram-config.js";
import { createNativeBubbleGuard } from "./native-bubble.js";
import { THEME_PRESETS, normalizeHex, themeColorSettings } from "./theme-config.js";

export async function mountTelegramSettings(host, controller, themeController, api) {
    const [source] = await Promise.all([controller.ready, themeController.ready]);
    let mode = liuliMode(document.body, matchMedia("(prefers-color-scheme: dark)"));
    let pending = Promise.resolve();
    let nativeStatus = "";
    const guard = createNativeBubbleGuard(document, (status, detail) => {
        nativeStatus = status;
        globalThis.EnhancedQQ?.nativeBubbleStatus?.(status, detail);
        updateNativeStatus();
    });

    function updateNativeStatus() {
        const target = host.querySelector("[data-native-status]");
        if (!target) return;
        const messages = { off: "QQ 个性化聊天气泡已关闭", "turning-off": "正在关闭 QQ 个性化聊天气泡…", pending: "正在确认 QQ 聊天气泡状态…", missing: "等待 QQ 通用设置加载", unknown: "无法确认 QQ 聊天气泡开关状态" };
        target.textContent = controller.settings.enabled ? (messages[nativeStatus] || "正在检查 QQ 聊天气泡设置…") : "";
    }

    function saveFeature(feature, change) {
        pending = pending.catch(() => {}).then(async () => {
            const status = host.querySelector("[data-telegram-status]");
            if (status) status.textContent = "正在保存…";
            try {
                const config = await readConfig(api);
                const next = feature === "themeColor" ? themeColorSettings(config, themeController.settings.mode) : telegramSettings(config);
                change(next);
                await writeConfig(api, { features: { [feature]: next } });
                if (feature === "themeColor") themeController.setCurrent(next); else controller.setCurrent(next);
                globalThis.EnhancedQQ?.configChanged?.();
                render("设置已保存");
            } catch (error) {
                render(error?.message || "保存失败");
            }
        });
        return pending;
    }
    const save = change => saveFeature("telegramBubbles", change);
    const saveTheme = change => saveFeature("themeColor", change);

    function button(label, className, action) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = className;
        element.textContent = label;
        element.addEventListener("click", action);
        return element;
    }

    function colorChooser(label, value, onCommit, { alpha = false, active = true } = {}) {
        const box = document.createElement("div"); box.className = "theme-color-choice";
        const line = document.createElement("div"); line.className = "option-row";
        const title = document.createElement("div"); title.className = "field-label"; title.textContent = label;
        const controls = document.createElement("div"); controls.className = "telegram-controls";
        const text = document.createElement("input"); text.type = "text"; text.className = "telegram-value"; text.value = value;
        text.setAttribute("aria-label", label); text.title = "输入后按回车或移开焦点保存";
        const picker = document.createElement("input"); picker.type = "color"; picker.value = normalizeHex(value.slice(0, 7)) || "#1d9bf0";
        picker.setAttribute("aria-label", `${label}取色器`);
        function commit(raw) {
            const normalized = alpha && /^#[\da-f]{8}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : normalizeHex(raw);
            if (!normalized) { const status = host.querySelector("[data-telegram-status]"); if (status) status.textContent = alpha ? "颜色请输入 #RRGGBB 或 #RRGGBBAA" : "颜色请输入 #RRGGBB"; return; }
            onCommit(normalized);
        }
        text.addEventListener("change", () => commit(text.value));
        text.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); commit(text.value); } });
        picker.addEventListener("input", () => { text.value = picker.value + (alpha && text.value.length === 9 ? text.value.slice(7) : ""); });
        picker.addEventListener("change", () => commit(text.value));
        controls.append(picker, text); line.append(title, controls); box.append(line);
        const presets = document.createElement("div"); presets.className = "theme-presets"; presets.setAttribute("role", "group"); presets.setAttribute("aria-label", `${label}预设颜色`);
        for (const preset of THEME_PRESETS) {
            const item = button("", "theme-preset", () => commit(preset.color));
            item.style.backgroundColor = preset.color;
            item.setAttribute("aria-label", `${label}预设${preset.name}`);
            item.setAttribute("title", preset.name);
            item.setAttribute("aria-pressed", String(active && value.slice(0, 7).toLowerCase() === preset.color));
            presets.append(item);
        }
        box.append(presets);
        if (alpha) {
            const slider = document.createElement("input"); slider.type = "range"; slider.min = "0"; slider.max = "100";
            slider.value = String(value.length === 9 ? Math.round(parseInt(value.slice(7), 16) * 100 / 255) : 100);
            slider.className = "telegram-alpha"; slider.setAttribute("aria-label", `${label}不透明度`);
            slider.addEventListener("input", () => { const suffix = Math.round(Number(slider.value) * 255 / 100).toString(16).padStart(2, "0"); text.value = text.value.slice(0, 7) + (suffix === "ff" ? "" : suffix); });
            slider.addEventListener("change", () => commit(text.value)); box.append(slider);
        }
        return box;
    }

    function settingRow(definition) {
        const editMode = mode;
        const row = document.createElement("div");
        row.className = "telegram-option";
        const top = document.createElement("div");
        top.className = "option-row";
        const label = document.createElement("label");
        label.className = "field-label";
        label.textContent = definition.title;
        const controls = document.createElement("div");
        controls.className = "telegram-controls";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "telegram-value";
        input.value = telegramValue(definition, controller.settings, editMode);
        input.setAttribute("aria-label", definition.title);
        input.title = "输入后按回车或移开焦点保存";
        const commit = value => {
            const cleaned = value.trim();
            if (!validTelegramValue(definition, cleaned)) {
                const status = host.querySelector("[data-telegram-status]");
                if (status) status.textContent = definition.type === "color" ? "颜色请输入 #RRGGBB 或 #RRGGBBAA" : "请输入有效的设置值";
                return;
            }
            save(next => { next[editMode][definition.key] = cleaned; });
        };
        input.addEventListener("change", () => commit(input.value));
        input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); commit(input.value); } });
        if (definition.type === "color") {
            const picker = document.createElement("input");
            picker.type = "color";
            picker.value = input.value.slice(0, 7);
            picker.setAttribute("aria-label", `${definition.title}取色`);
            picker.addEventListener("input", () => { input.value = picker.value + (input.value.length === 9 ? input.value.slice(7) : ""); });
            picker.addEventListener("change", () => commit(input.value));
            controls.append(picker);
        }
        controls.append(input);
        const reset = button("↺", "telegram-reset-one", () => save(next => { delete next[editMode][definition.key]; }));
        reset.setAttribute("aria-label", `重置${definition.title}`);
        controls.append(reset);
        top.append(label, controls);
        row.append(top);
        if (definition.type === "color") {
            const alpha = document.createElement("input");
            alpha.type = "range"; alpha.min = "0"; alpha.max = "100";
            alpha.value = String(input.value.length === 9 ? Math.round(parseInt(input.value.slice(7), 16) * 100 / 255) : 100);
            alpha.className = "telegram-alpha";
            alpha.setAttribute("aria-label", `${definition.title}不透明度`);
            alpha.addEventListener("input", () => {
                const hex = Math.round(Number(alpha.value) * 255 / 100).toString(16).padStart(2, "0");
                input.value = input.value.slice(0, 7) + (hex === "ff" ? "" : hex);
            });
            alpha.addEventListener("change", () => commit(input.value));
            row.append(alpha);
        }
        if (definition.description) {
            const hint = document.createElement("p"); hint.className = "field-hint"; hint.textContent = definition.description; row.append(hint);
        }
        return row;
    }

    function render(message = "") {
        const open = new Set([...host.querySelectorAll("details[open]")].map(item => item.dataset.group));
        host.replaceChildren();
        const title = document.createElement("div"); title.className = "group"; title.textContent = "外观"; host.append(title);
        const themeTitle = document.createElement("div"); themeTitle.className = "appearance-heading"; themeTitle.textContent = "QQ 主题"; host.append(themeTitle);
        const appearanceRow = document.createElement("div"); appearanceRow.className = "option-row appearance-mode-row";
        const appearanceLabel = document.createElement("div"); appearanceLabel.className = "field-label"; appearanceLabel.textContent = "明暗模式";
        const appearanceButtons = document.createElement("div"); appearanceButtons.className = "segments"; appearanceButtons.setAttribute("role", "group"); appearanceButtons.setAttribute("aria-label", "QQ 明暗模式");
        for (const [value, text] of [["qq", "跟随 QQ"], ["system", "跟随系统"], ["light", "亮色"], ["dark", "暗色"]]) {
            const item = button(text, "", () => saveTheme(next => { next.mode = value; }));
            item.classList.toggle("is-active", themeController.settings.mode === value); item.setAttribute("aria-pressed", String(themeController.settings.mode === value)); appearanceButtons.append(item);
        }
        appearanceRow.append(appearanceLabel, appearanceButtons); host.append(appearanceRow);
        const appearanceHint = document.createElement("p"); appearanceHint.className = "field-hint"; appearanceHint.textContent = "同步 QQ、琉璃和 Telegram 气泡的明暗外观。"; host.append(appearanceHint);
        const sourceRow = document.createElement("div"); sourceRow.className = "option-row";
        sourceRow.classList.add("appearance-mode-row");
        const sourceLabel = document.createElement("div"); sourceLabel.className = "field-label"; sourceLabel.textContent = "颜色来源";
        const sourceButtons = document.createElement("div"); sourceButtons.className = "segments"; sourceButtons.setAttribute("role", "group"); sourceButtons.setAttribute("aria-label", "QQ 主题色来源");
        for (const [value, text] of [["wallpaper", "跟随壁纸"], ["fixed", "自定义"]]) {
            const item = button(text, "", () => saveTheme(next => { if (value === "fixed" && next.source === "wallpaper") next.color = normalizeHex(document.body.dataset.liuliSource) || next.color; next.source = value; }));
            item.classList.toggle("is-active", themeController.settings.source === value); item.setAttribute("aria-pressed", String(themeController.settings.source === value)); sourceButtons.append(item);
        }
        sourceRow.append(sourceLabel, sourceButtons); host.append(sourceRow);
        const wallpaperColor = normalizeHex(document.body.dataset.liuliSource);
        const sourceHint = document.createElement("p"); sourceHint.className = "field-hint"; sourceHint.textContent = "选择预设或自定义颜色后，琉璃会据此生成 QQ 的日夜主题色板。" + (themeController.settings.source === "wallpaper" && wallpaperColor ? ` 当前壁纸源色 ${wallpaperColor}。` : ""); host.append(sourceHint);
        const shownThemeColor = themeController.settings.source === "wallpaper" ? wallpaperColor || themeController.settings.color : themeController.settings.color;
        host.append(colorChooser("QQ 主题色", shownThemeColor, color => saveTheme(next => { next.source = "fixed"; next.color = color; }), { active: themeController.settings.source === "fixed" }));

        const bubbleTitle = document.createElement("div"); bubbleTitle.className = "appearance-heading"; bubbleTitle.textContent = "Telegram 气泡"; host.append(bubbleTitle);
        const field = document.createElement("div"); field.className = "field";
        const row = document.createElement("div"); row.className = "option-row";
        const label = document.createElement("div"); label.className = "field-label"; label.textContent = "启用 Telegram 气泡";
        const segments = document.createElement("div"); segments.className = "segments"; segments.setAttribute("role", "group"); segments.setAttribute("aria-label", "Telegram 气泡");
        for (const [value, text] of [[false, "关闭"], [true, "开启"]]) {
            const item = button(text, "", () => save(next => { next.enabled = value; }));
            item.classList.toggle("is-active", controller.settings.enabled === value);
            item.setAttribute("aria-pressed", String(controller.settings.enabled === value));
            segments.append(item);
        }
        row.append(label, segments); field.append(row);
        const hint = document.createElement("p"); hint.className = "field-hint"; hint.textContent = "启用时使用 Telegram 消息样式，并关闭 QQ 个性化聊天气泡。"; field.append(hint);
        const native = document.createElement("p"); native.className = "field-hint"; native.dataset.nativeStatus = ""; field.append(native);
        host.append(field);
        if (controller.settings.enabled) {
            const nicknameRow = document.createElement("div"); nicknameRow.className = "option-row telegram-mode appearance-mode-row";
            const nicknameLabel = document.createElement("div"); nicknameLabel.className = "field-label"; nicknameLabel.textContent = "对方昵称位置";
            const nicknameButtons = document.createElement("div"); nicknameButtons.className = "segments"; nicknameButtons.setAttribute("role", "group"); nicknameButtons.setAttribute("aria-label", "对方昵称位置");
            for (const [value, text] of [["above", "消息上方"], ["inside", "气泡内顶部"], ["below", "消息下方"]]) {
                const item = button(text, "", () => save(next => { next.nicknamePosition = value; }));
                item.classList.toggle("is-active", controller.settings.nicknamePosition === value); item.setAttribute("aria-pressed", String(controller.settings.nicknamePosition === value)); nicknameButtons.append(item);
            }
            nicknameRow.append(nicknameLabel, nicknameButtons); host.append(nicknameRow);
            if (controller.settings.nicknamePosition === "inside") {
                const nicknameHint = document.createElement("p"); nicknameHint.className = "field-hint"; nicknameHint.textContent = "连续消息的昵称显示在第一条气泡内。"; host.append(nicknameHint);
            }
            const avatarRow = document.createElement("div"); avatarRow.className = "option-row telegram-mode";
            const avatarLabel = document.createElement("div"); avatarLabel.className = "field-label"; avatarLabel.textContent = "显示自己的头像";
            const avatarButtons = document.createElement("div"); avatarButtons.className = "segments"; avatarButtons.setAttribute("role", "group"); avatarButtons.setAttribute("aria-label", "显示自己的头像");
            for (const [value, text] of [[false, "关闭"], [true, "开启"]]) {
                const item = button(text, "", () => save(next => { next.showSelfAvatar = value; }));
                item.classList.toggle("is-active", controller.settings.showSelfAvatar === value); item.setAttribute("aria-pressed", String(controller.settings.showSelfAvatar === value)); avatarButtons.append(item);
            }
            avatarRow.append(avatarLabel, avatarButtons); host.append(avatarRow);
            const avatarHint = document.createElement("p"); avatarHint.className = "field-hint"; avatarHint.textContent = "开启后，连续发送的消息只在最后一条显示头像。"; host.append(avatarHint);
            const colorModeRow = document.createElement("div"); colorModeRow.className = "option-row telegram-mode appearance-mode-row";
            const colorModeLabel = document.createElement("div"); colorModeLabel.className = "field-label"; colorModeLabel.textContent = "气泡颜色";
            const colorModeButtons = document.createElement("div"); colorModeButtons.className = "segments"; colorModeButtons.setAttribute("role", "group"); colorModeButtons.setAttribute("aria-label", "气泡颜色模式");
            for (const [value, text] of [["theme", "跟随主题"], ["theme-split", "主色 / 次色"], ["unified", "统一颜色"], ["separate", "分别设置"]]) {
                const item = button(text, "", () => save(next => { next.colorMode = value; }));
                item.classList.toggle("is-active", controller.settings.colorMode === value); item.setAttribute("aria-pressed", String(controller.settings.colorMode === value)); colorModeButtons.append(item);
            }
            colorModeRow.append(colorModeLabel, colorModeButtons); host.append(colorModeRow);
            const colorModeHint = document.createElement("p"); colorModeHint.className = "field-hint"; colorModeHint.textContent = "主色 / 次色：自己的气泡跟随主题主色，对方使用主题中性灰或次色，昵称跟随主题。"; host.append(colorModeHint);
            if (controller.settings.colorMode === "theme-split") {
                const toneRow = document.createElement("div"); toneRow.className = "option-row telegram-mode appearance-mode-row";
                const toneLabel = document.createElement("div"); toneLabel.className = "field-label"; toneLabel.textContent = "对方气泡色调";
                const toneButtons = document.createElement("div"); toneButtons.className = "segments"; toneButtons.setAttribute("role", "group"); toneButtons.setAttribute("aria-label", "对方气泡色调");
                for (const [value, text] of [["neutral", "主题中性灰"], ["secondary", "主题次色"]]) {
                    const item = button(text, "", () => save(next => { next.splitTone = value; }));
                    item.classList.toggle("is-active", controller.settings.splitTone === value); item.setAttribute("aria-pressed", String(controller.settings.splitTone === value)); toneButtons.append(item);
                }
                toneRow.append(toneLabel, toneButtons); host.append(toneRow);
            }
            const modeRow = document.createElement("div"); modeRow.className = "option-row telegram-mode";
            const modeLabel = document.createElement("div"); modeLabel.className = "field-label"; modeLabel.textContent = "编辑气泡配色";
            const modeButtons = document.createElement("div"); modeButtons.className = "segments"; modeButtons.setAttribute("role", "group"); modeButtons.setAttribute("aria-label", "编辑配色");
            for (const [value, text] of [["light", "日间"], ["dark", "夜间"]]) {
                const item = button(text, "", () => { mode = value; render(); });
                item.classList.toggle("is-active", mode === value); item.setAttribute("aria-pressed", String(mode === value)); modeButtons.append(item);
            }
            modeRow.append(modeLabel, modeButtons); host.append(modeRow);
            const modeHint = document.createElement("p"); modeHint.className = "field-hint"; modeHint.textContent = "日间和夜间分别保存，聊天界面跟随琉璃当前明暗模式。输入后按回车保存。"; host.append(modeHint);
            const definitions = telegramDefinitions(source, mode);
            const editMode = mode;
            if (controller.settings.colorMode === "unified") {
                const configured = controller.settings.uniform?.[editMode];
                const currentTheme = editMode === liuliMode(document.body, matchMedia("(prefers-color-scheme: dark)")) ? normalizeHex(getComputedStyle(document.body).getPropertyValue("--ll-primary-container")) : null;
                const fallback = source[editMode]["--tg-message-self-bg-color"].defaultValue;
                const value = /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(configured || "") ? configured : currentTheme || fallback;
                host.append(colorChooser("统一气泡颜色", value, color => save(next => { next.uniform[editMode] = color; }), { alpha: true }));
            } else if (controller.settings.colorMode === "separate") {
                for (const [side, labelText] of [["self", "自己的气泡颜色"], ["others", "对方的气泡颜色"]]) {
                    const definition = definitions.find(item => item.key === `--tg-message-${side}-bg-color`);
                    const value = telegramValue(definition, controller.settings, editMode);
                    host.append(colorChooser(labelText, value, color => save(next => { next[editMode][definition.key] = color; }), { alpha: true }));
                }
            }
            const advanced = document.createElement("details"); advanced.className = "telegram-advanced"; advanced.dataset.group = "advanced"; advanced.open = open.has("advanced");
            const advancedTitle = document.createElement("summary"); advancedTitle.textContent = "高级消息样式"; advanced.append(advancedTitle);
            for (const group of ["自己的消息", "他人的消息", "其他设定"]) {
                const items = definitions.filter(item => item.group === group && !["--tg-message-self-bg-color", "--tg-message-others-bg-color"].includes(item.key));
                if (!items.length) continue;
                const details = document.createElement("details"); details.className = "telegram-group"; details.dataset.group = group; details.open = open.has(group);
                const summary = document.createElement("summary"); summary.textContent = `${group}（${items.length}）`; details.append(summary);
                items.forEach(item => details.append(settingRow(item)));
                advanced.append(details);
            }
            const resetMode = mode;
            const reset = button("恢复当前模式默认", "telegram-reset-mode", () => save(next => { for (const definition of definitions) delete next[resetMode][definition.key]; delete next.uniform[resetMode]; }));
            advanced.append(reset); host.append(advanced);
        }
        const status = document.createElement("p"); status.className = "save-status"; status.dataset.telegramStatus = ""; status.setAttribute("role", "status"); status.textContent = message; host.append(status);
        updateNativeStatus();
    }

    controller.onChange(() => { guard.setEnabled(controller.settings.enabled); render(); });
    themeController.onChange(() => render());
    new MutationObserver(() => { if (themeController.settings.source === "wallpaper") render(); }).observe(document.body, { attributes: true, attributeFilter: ["data-liuli-source"] });
    guard.setEnabled(controller.settings.enabled);
    render();
}
