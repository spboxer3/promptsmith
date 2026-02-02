/**
 * Mock Chrome Storage API for In-Browser Testing
 */
class MockChromeStorage {
    constructor() {
        this.store = {};
    }

    get(keys) {
        return new Promise((resolve) => {
            if (typeof keys === 'string') {
                resolve({ [keys]: this.store[keys] });
            } else if (Array.isArray(keys)) {
                const result = {};
                keys.forEach(k => result[k] = this.store[k]);
                resolve(result);
            } else {
                resolve(this.store);
            }
        });
    }

    set(items) {
        return new Promise((resolve) => {
            Object.assign(this.store, items);
            resolve();
        });
    }

    clear() {
        this.store = {};
    }
}

// Global Mock
window.chrome = {
    storage: {
        local: new MockChromeStorage()
    },
    runtime: {
        lastError: null
    }
};

console.log("Mock Chrome Storage initialized.");
