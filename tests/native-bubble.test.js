import test from "node:test";
import assert from "node:assert/strict";
import { findNativeBubbleControl, readNativeBubbleControl } from "../src/renderer/native-bubble.js";

function control({ aria = null, input = false, checked = false, modelValue, classes = [] } = {}) {
    return {
        checked, __vueParentComponent: { props: { modelValue } },
        matches: () => input, querySelectorAll: () => [],
        getAttribute: name => name === "aria-checked" ? aria : null,
        classList: { contains: name => classes.includes(name) },
        closest: () => null, contains: () => false
    };
}

test("reads explicit QQ switch states and leaves unknown states unknown", () => {
    assert.equal(readNativeBubbleControl(control({ aria: "true" })), true);
    assert.equal(readNativeBubbleControl(control({ aria: "false" })), false);
    assert.equal(readNativeBubbleControl(control({ input: true, checked: true })), true);
    assert.equal(readNativeBubbleControl(control({ modelValue: false })), false);
    assert.equal(readNativeBubbleControl(control({ classes: ["q-switch--checked"] })), true);
    assert.equal(readNativeBubbleControl(control()), null);
});

test("locates only the switch associated with the exact native label", () => {
    const toggle = control({ aria: "true" });
    const row = { parentElement: null, querySelectorAll: () => [toggle] };
    const label = { children: [], textContent: "聊天气泡", parentElement: row };
    const root = { querySelectorAll: () => [label] };
    const doc = { querySelector: () => root };
    assert.strictEqual(findNativeBubbleControl(doc), toggle);
    label.textContent = "其他气泡";
    assert.equal(findNativeBubbleControl(doc), null);
});
