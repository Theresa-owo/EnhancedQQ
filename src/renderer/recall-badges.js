export function installRecallBadges(api = globalThis.EnhancedQQ) {
    if (!api?.getState || !api?.onState) return;
    let markers = new Map();
    let enabled = true;
    let showOwn = false;
    let queued = false;
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    const observed = new Set();

    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; render(); });
    }

    function messageRow(id) {
        const candidates = [id, `ml-${id}`, `${id}-msgContent`, `${id}-msgContainerMsgContent`, `ark-msg-content-container_${id}`];
        for (const candidate of candidates) {
            const element = document.getElementById(candidate);
            const row = element?.closest?.(".ml-item, .message");
            if (row) return row;
        }
        return null;
    }

    function clearRow(row) {
        row.querySelector(".enhancedqq-recall-badge")?.remove();
        row.classList.remove("enhancedqq-hide-recall");
        delete row.dataset.enhancedqqRecallRow;
    }

    function placeBadge(row, id, self, active) {
        const bubble = row.querySelector(".msg-content-container, .file-message--content, .message-content__wrapper .message-content, .message-content") || row;
        const host = row.querySelector(".message-container") || bubble.parentElement || row;
        let badge = row.querySelector(".enhancedqq-recall-badge");
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "enhancedqq-recall-badge";
            badge.textContent = "已撤回";
            badge.setAttribute("aria-label", "已撤回");
        }
        if (badge.parentElement !== host) host.appendChild(badge);
        host.classList.add("enhancedqq-recall-host");
        if (getComputedStyle(host).position === "static") host.classList.add("enhancedqq-recall-positioned");
        const hostRect = host.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        if (hostRect.width && bubbleRect.width && bubbleRect.height) {
            const x = self ? bubbleRect.left - hostRect.left - 6 : bubbleRect.right - hostRect.left + 6;
            const y = bubbleRect.top - hostRect.top + bubbleRect.height / 2;
            badge.style.left = `${Math.round(x)}px`;
            badge.style.top = `${Math.round(y)}px`;
            badge.style.transform = self ? "translate(-100%, -50%)" : "translate(0, -50%)";
        }
        badge.dataset.enhancedqqRecallId = id;
        active.add(host);
        active.add(bubble);
        if (resizeObserver && !observed.has(host)) { resizeObserver.observe(host); observed.add(host); }
        if (resizeObserver && !observed.has(bubble)) { resizeObserver.observe(bubble); observed.add(bubble); }
    }

    function render() {
        const active = new Set();
        for (const row of document.querySelectorAll("[data-enhancedqq-recall-row]")) {
            const id = row.dataset.enhancedqqRecallRow;
            if (!markers.has(id) || messageRow(id) !== row) clearRow(row);
        }
        for (const [id, self] of markers) {
            const row = messageRow(id);
            if (!row) continue;
            row.dataset.enhancedqqRecallRow = id;
            const hidden = !enabled || (self && !showOwn);
            row.classList.toggle("enhancedqq-hide-recall", hidden);
            if (hidden) row.querySelector(".enhancedqq-recall-badge")?.remove();
            else placeBadge(row, id, self, active);
        }
        for (const node of observed) if (!active.has(node)) { resizeObserver.unobserve(node); observed.delete(node); }
    }

    function update(state) {
        enabled = state?.enabled !== false;
        showOwn = state?.showOwn === true;
        markers = new Map((Array.isArray(state?.markers) ? state.markers : [])
            .filter(item => item && typeof item.id === "string" && typeof item.self === "boolean")
            .map(item => [item.id, item.self]));
        schedule();
    }

    function start() {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = new URL("./recall-badges.css", import.meta.url).href;
        link.id = "enhancedqq-recall-style";
        if (!document.getElementById(link.id)) (document.head || document.documentElement).appendChild(link);
        new MutationObserver(() => { if (markers.size) schedule(); }).observe(document.documentElement, { childList: true, subtree: true });
        window.addEventListener("resize", schedule);
        api.onState(update);
        api.rendererReady?.();
        Promise.resolve(api.getState()).then(update).catch(error => console.warn("[EnhancedQQ] Could not read recall state:", error));
    }
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
}
