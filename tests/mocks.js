export const chrome = {
  runtime: {
    getManifest: () => ({ version: "1.0.0" }),
    openOptionsPage: () => console.log("Opened options page"),
  },
  storage: {
    local: {
      _data: {},
      get: async (keys) => {
        if (typeof keys === "string") {
          return { [keys]: chrome.storage.local._data[keys] };
        } else if (Array.isArray(keys)) {
          const result = {};
          keys.forEach((k) => (result[k] = chrome.storage.local._data[k]));
          return result;
        } else {
          return chrome.storage.local._data; // null/undefined gets all?
        }
      },
      set: async (items) => {
        Object.assign(chrome.storage.local._data, items);
      },
      clear: async () => {
        chrome.storage.local._data = {};
      }
    },
  },
  i18n: {
    getMessage: (key) => key,
  },
};

// Expose to global for files that rely on global chrome
global.chrome = chrome;
