
// Mock Globals
global.chrome = {
    i18n: {
        getMessage: () => "SystemFallback"
    },
    runtime: {
        getURL: (path) => path
    },
    storage: {
        local: {
            get: () => ({})
        }
    }
};

class MockNode {
    constructor(type, value) {
        this.nodeType = type; // 1=Element, 3=Text
        this.nodeValue = value;
    }
    get textContent() {
        return this.nodeType === 3 ? this.nodeValue : "";
    }
}

class MockElement extends MockNode {
    constructor(tagName) {
        super(1, null);
        this.tagName = tagName;
        this.attributes = {};
        this.childNodes = [];
    }

    get children() {
        return this.childNodes.filter(n => n.nodeType === 1);
    }

    appendChild(child) {
        this.childNodes.push(child);
    }

    getAttribute(name) {
        return this.attributes[name];
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    get textContent() {
         return this.childNodes.map(n => n.textContent).join("");
    }

    set textContent(val) {
        // Wipes all children and replaces with single text node
        this.childNodes = [new MockNode(3, val)];
    }
}

global.document = {
    createTextNode: (text) => new MockNode(3, text)
};

import { I18nService } from "../src/lib/i18n.js";

console.log("--- Testing I18nService.apply ---");

// Setup a button with an icon and text
const btn = new MockElement("BUTTON");
btn.setAttribute("data-i18n", "btnSave");

const icon = new MockElement("I");
icon.setAttribute("class", "fa fa-save");
btn.appendChild(icon); // 1. Icon

const textNode = new MockNode(3, "Save");
btn.appendChild(textNode); // 2. Text

// Mock Root
const root = {
    querySelectorAll: (selector) => {
        if (selector === "[data-i18n]") return [btn];
        return [];
    }
};

// Setup Translations
I18nService.messages = {
    "btnSave": { "message": "Enregistrer" }
};

console.log("Before apply:");
console.log("Button content nodes:", btn.childNodes.length);
console.log("Button text:", btn.textContent);
console.log("Has Icon (Child Element):", btn.children.length > 0);

// Run Apply
I18nService.apply(root);

console.log("After apply:");
console.log("Button content nodes:", btn.childNodes.length);
console.log("Button text:", btn.textContent);
console.log("Has Icon (Child Element):", btn.children.length > 0);

if (btn.textContent.includes("Enregistrer") && btn.children.length > 0) {
    console.log("PASS: Icon preserved and text updated.");
} else {
    console.log("FAIL: State incorrect.");
    if (btn.children.length === 0) console.log("Reason: Icon lost.");
    if (!btn.textContent.includes("Enregistrer")) console.log("Reason: Text not updated.");
    process.exitCode = 1;
}
