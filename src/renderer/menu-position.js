const MENU = ".q-context-menu.aio-right-click-menu, .q-context-menu.group-member-menu";
const originalStyles = new WeakMap();

export function fitContextMenu(menu, view = window) {
    if (!menu?.isConnected || !view?.innerWidth || !view?.innerHeight) return;
    if (!originalStyles.has(menu)) originalStyles.set(menu, { maxHeight: menu.style.maxHeight, overflowY: menu.style.overflowY, boxSizing: menu.style.boxSizing,
        width: menu.style.width, maxWidth: menu.style.maxWidth });
    const original = originalStyles.get(menu);
    menu.style.maxHeight = original.maxHeight; menu.style.overflowY = original.overflowY; menu.style.boxSizing = original.boxSizing;
    menu.style.width = original.width; menu.style.maxWidth = original.maxWidth;
    let rect = menu.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const inputs = view.document?.querySelectorAll ? [...view.document.querySelectorAll(".aio .chat-input-area")] : [view.document?.querySelector?.(".aio .chat-input-area")];
    const inputRect = inputs.map(input => input?.getBoundingClientRect?.()).find(value => value?.height > 0 && value.top > 48 && value.top < view.innerHeight);
    const bottom = inputRect?.height > 0 && inputRect.top > 48 && inputRect.top < view.innerHeight ? inputRect.top - 8 : view.innerHeight - 8;
    if ((rect.right > view.innerWidth - 8 || rect.left < 8) && !original.width) {
        menu.style.boxSizing = "border-box";
        menu.style.width = "max-content";
        menu.style.maxWidth = `${Math.max(32, view.innerWidth - 16)}px`;
        rect = menu.getBoundingClientRect();
    }
    if (rect.height > bottom - 8) {
        menu.style.boxSizing = "border-box";
        menu.style.maxHeight = `${Math.max(32, bottom - 8)}px`;
        menu.style.overflowY = "auto";
        rect = menu.getBoundingClientRect();
    }
    const dx = rect.right > view.innerWidth - 8 ? view.innerWidth - 8 - rect.right : rect.left < 8 ? 8 - rect.left : 0;
    const dy = rect.bottom > bottom ? bottom - rect.bottom : rect.top < 8 ? 8 - rect.top : 0;
    const style = view.getComputedStyle(menu);
    if (dx) {
        const left = Number.parseFloat(style.left);
        if (Number.isFinite(left)) menu.style.left = `${Math.round(left + dx)}px`;
    }
    if (dy) {
        const top = Number.parseFloat(style.top);
        if (Number.isFinite(top)) menu.style.top = `${Math.round(top + dy)}px`;
    }
}

export function installContextMenuPositioning() {
    if (!document.documentElement) { document.addEventListener("DOMContentLoaded", installContextMenuPositioning, { once: true }); return; }
    let queued = false;
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; document.querySelectorAll(MENU).forEach(menu => fitContextMenu(menu)); });
    }
    const observer = new MutationObserver(records => {
        if (records.some(record => record.target?.closest?.(MENU) || [...record.addedNodes].some(node => node.matches?.(MENU) || node.querySelector?.(MENU)))) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("contextmenu", schedule, true);
    window.addEventListener("resize", schedule);
}
