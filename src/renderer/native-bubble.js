const SELECTOR = '[role="switch"], input[type="checkbox"], .q-switch';

export function findNativeBubbleControl(doc) {
    const root = doc.querySelector(".setting-main") || doc;
    const labels = [...root.querySelectorAll("*")].filter(element =>
        element.children.length === 0 && element.textContent.trim() === "聊天气泡"
    );
    for (const label of labels) {
        let node = label.parentElement;
        for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
            const found = [...node.querySelectorAll(SELECTOR)].filter(element => !element.closest(".enhancedqq-host"));
            const outer = found.filter(element => !found.some(other => other !== element && other.contains(element)));
            if (outer.length === 1) return outer[0];
            if (outer.length > 1) break;
        }
    }
    return null;
}

export function readNativeBubbleControl(control) {
    if (!control) return null;
    const elements = [control, ...control.querySelectorAll(SELECTOR)];
    for (const element of elements) {
        if (element.matches('input[type="checkbox"]')) return element.checked;
        const value = element.getAttribute("aria-checked");
        if (value === "true" || value === "false") return value === "true";
        const state = element.getAttribute("data-state");
        if (state === "checked" || state === "unchecked") return state === "checked";
        try {
            const component = element.__vueParentComponent;
            for (const value of [component?.props?.modelValue, component?.props?.checked, component?.props?.value]) {
                if (typeof value === "boolean") return value;
            }
        } catch { /* Ignore inaccessible Vue props. */ }
        if (element.classList.contains("q-switch--checked") || element.classList.contains("is-checked")) return true;
        if (element.classList.contains("q-switch--unchecked") || element.classList.contains("is-unchecked")) return false;
    }
    return null;
}

export function createNativeBubbleGuard(doc, report = () => {}) {
    let enabled = false;
    let attempted = false;
    let last = "";
    let queued = false;
    function publish(status, control) {
        if (last === status) return;
        last = status;
        const nodes = control ? [control, ...control.querySelectorAll("*")].slice(0, 6).map(element => {
            let booleanProps = [];
            try { booleanProps = Object.entries(element.__vueParentComponent?.props || {}).filter(([, value]) => typeof value === "boolean").map(([key, value]) => `${key}:${value}`).slice(0, 8); } catch { /* Ignore inaccessible Vue props. */ }
            return { tag: element.tagName, className: String(element.className || "").slice(0, 100), aria: element.getAttribute("aria-checked"), state: element.getAttribute("data-state"), booleanProps };
        }) : [];
        report(status, control ? { tag: control.tagName, className: String(control.className || "").slice(0, 160), aria: control.getAttribute("aria-checked"), nodes } : null);
    }
    function check() {
        if (!enabled) return;
        const control = findNativeBubbleControl(doc);
        if (!control) return publish("missing", null);
        const checked = readNativeBubbleControl(control);
        if (checked === false) { attempted = false; return publish("off", control); }
        if (checked === null) return publish("unknown", control);
        if (attempted) return publish("pending", control);
        attempted = true;
        publish("turning-off", control);
        try { control.click(); } catch { return publish("unknown", control); }
        setTimeout(check, 200);
    }
    const observer = new MutationObserver(() => {
        if (queued || !enabled) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; check(); });
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-checked", "checked", "data-state"] });
    return {
        setEnabled(value) { enabled = value === true; if (!enabled) { attempted = false; last = ""; } else check(); },
        check,
        disconnect() { observer.disconnect(); }
    };
}
