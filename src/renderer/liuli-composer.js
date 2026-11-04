function visible(element) {
    if (!element || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
}

export function findMultiSelectToolbar(root = document) {
    for (const list of root.querySelectorAll(".aio ul, .aio [role='list'], .message-panel ul, .message-panel [role='list']")) {
        if (!visible(list)) continue;
        const labels = new Set([...list.querySelectorAll(":scope > li, :scope > [role='listitem']")].map(item => item.textContent.replace(/\s+/g, "").trim()));
        if (labels.has("逐条转发") && labels.has("合并转发")) return list;
    }
    return null;
}

export function installLiuliComposerFix() {
    function install() {
        const style = document.createElement("style");
        style.textContent = `
body[data-enhancedqq-composer="ready"] #liuli-input-overlay { display:flex !important; left:var(--enhancedqq-input-left) !important; top:var(--enhancedqq-input-top) !important; align-items:center !important; }
body[data-enhancedqq-composer="waiting"] #liuli-input-overlay, body[data-enhancedqq-composer="multi"] #liuli-input-overlay { display:none !important; }
body[data-enhancedqq-composer="multi"] .chat-input-area:not([data-enhancedqq-multi-inside]) { display:none !important; }
.chat-input-area[data-enhancedqq-multi-inside] { background:transparent !important; box-shadow:none !important; border:0 !important; }
.chat-input-area[data-enhancedqq-multi-inside]::before { display:none !important; }
.chat-input-area[data-enhancedqq-multi-inside] > :not([data-enhancedqq-multi-keep]) { display:none !important; }
`;
        document.head.append(style);
        let queued = false, observedBox = null;
        const resize = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
        function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
        function update() {
            queued = false;
            const toolbar = findMultiSelectToolbar();
            const area = document.querySelector(".chat-input-area");
            for (const node of document.querySelectorAll("[data-enhancedqq-multi-keep]")) delete node.dataset.enhancedqqMultiKeep;
            if (area) delete area.dataset.enhancedqqMultiInside;
            if (toolbar) {
                if (area?.contains(toolbar)) {
                    let child = toolbar;
                    while (child.parentElement && child.parentElement !== area) child = child.parentElement;
                    if (child.parentElement === area) { child.dataset.enhancedqqMultiKeep = "1"; area.dataset.enhancedqqMultiInside = "1"; }
                }
                document.body.dataset.enhancedqqComposer = "multi";
                return;
            }
            if (document.body.dataset.enhancedqqComposer === "multi") delete document.body.dataset.enhancedqqComposer;
            const overlay = document.getElementById("liuli-input-overlay");
            const box = area?.querySelector(".msg-input") || area;
            if (!overlay || !visible(box)) { document.body.dataset.enhancedqqComposer = "waiting"; return; }
            const rect = box.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 20 || rect.bottom < 0 || rect.top > innerHeight) { document.body.dataset.enhancedqqComposer = "waiting"; return; }
            if (resize && observedBox !== box) { resize.disconnect(); resize.observe(box); observedBox = box; }
            const buttonHeight = overlay.querySelector("#liuli-func-toggle")?.getBoundingClientRect().height || 28;
            const top = Math.round(rect.bottom - (Math.min(rect.height, 44) + buttonHeight) / 2);
            const left = Math.round(rect.left + 6);
            if (document.body.style.getPropertyValue("--enhancedqq-input-left") !== `${left}px`) document.body.style.setProperty("--enhancedqq-input-left", `${left}px`);
            if (document.body.style.getPropertyValue("--enhancedqq-input-top") !== `${top}px`) document.body.style.setProperty("--enhancedqq-input-top", `${top}px`);
            document.body.dataset.enhancedqqComposer = "ready";
        }
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });
        for (const event of ["resize", "scroll", "focus", "hashchange"]) window.addEventListener(event, schedule, true);
        schedule();
    }
    if (document.body && document.head) install(); else document.addEventListener("DOMContentLoaded", install, { once: true });
}
