export async function runTests() {
    const results = document.getElementById('results');
    results.innerHTML = '';
    let passed = 0;
    let failed = 0;

    function log(message, type = 'log') {
        const div = document.createElement('div');
        div.className = type;
        div.textContent = message;
        results.appendChild(div);
    }

    function assert(condition, message) {
        if (condition) {
            log(`[PASS] ${message}`, 'pass');
            passed++;
        } else {
            log(`[FAIL] ${message}`, 'fail');
            failed++;
        }
    }

    async function setup() {
        window.chrome.storage.local.clear();
    }

    try {
        log('--- Starting Tests ---');

        // Test 1: Add History Item
        await setup();
        const item1 = {
            originalText: "test prompt",
            optimizedResult: "better prompt",
            endpoint: "gpt-4",
            strategy: "optimize",
            // Timestamp will be added by service or passed in? 
            // The plan said StorageService.addHistoryItem(item), let's assume item has content, implementation adds ID/Time if missing, or we pass full object.
            // Let's pass the raw data and expect the service to hydrate it.
        };
        
        // Wait... plan said "uuid and apply timestamp". So we pass partial data.
        await StorageService.addHistoryItem(item1);
        
        const history1 = await StorageService.getHistory();
        assert(history1.length === 1, "Should have 1 item after adding");
        assert(history1[0].originalText === "test prompt", "Original text should match");
        assert(!!history1[0].id, "Should have generated an ID");
        assert(!!history1[0].timestamp, "Should have generated a timestamp");


        // Test 2: Retention Rule (Auto-Prune > 7 days)
        await setup();
        const oldTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
        const recentTime = Date.now() - (1 * 24 * 60 * 60 * 1000); // 1 day ago

        // We need to verify standard adding works, but to test pruning we might need to manually inject old data 
        // OR mock Date.now(). For simplicity, let's inject "old" data via storage directly, then call addHistoryItem to trigger prune.
        
        const oldItem = {
            id: 'old-1', originalText: 'old', optimizedResult: 'old', timestamp: oldTime
        };
        const recentItem = {
            id: 'recent-1', originalText: 'recent', optimizedResult: 'recent', timestamp: recentTime
        };

        // Inject manually
        await window.chrome.storage.local.set({ [KEYS.HISTORY]: [recentItem, oldItem] }); // Note: KEYS.HISTORY might not exist yet in source code
        
        // Trigger generic add to run prune logic
        await StorageService.addHistoryItem({ originalText: "trigger", optimizedResult: "trigger" });

        const history2 = await StorageService.getHistory();
        // Should have: recent-1, trigger (new). old-1 should be gone.
        assert(history2.length === 2, `Should have 2 items (pruned 1). Found: ${history2.length}`);
        const foundOld = history2.find(x => x.id === 'old-1');
        assert(!foundOld, "Old item should be removed");


        // Test 3: Search
        await setup();
        await StorageService.addHistoryItem({ originalText: "apple pie", optimizedResult: "delicious dessert" });
        await StorageService.addHistoryItem({ originalText: "banana bread", optimizedResult: "tasty loaf" });
        await StorageService.addHistoryItem({ originalText: "cherry tart", optimizedResult: "sweet treat" });

        const searchRes = await StorageService.getHistory({ query: "Pie" }); // Case insensitive
        assert(searchRes.length === 1, "Search 'Pie' should return 1 result");
        assert(searchRes[0].originalText.includes("apple"), "Should be the apple pie entry");

        const searchRes2 = await StorageService.getHistory({ query: "TASTY" });
        assert(searchRes2.length === 1, "Search 'TASTY' should return 1 result");


        // Test 4: Sorting (Time Descending)
        await setup();
        // Inject unordered
        const t1 = 1000;
        const t2 = 3000;
        const t3 = 2000;
        
        await window.chrome.storage.local.set({ 
            [KEYS.HISTORY]: [
                { id: '1', timestamp: t1 },
                { id: '2', timestamp: t2 },
                { id: '3', timestamp: t3 }
            ] 
        });

        const sorted = await StorageService.getHistory();
        assert(sorted[0].timestamp === t2, "First item should be newest (t2)");
        assert(sorted[1].timestamp === t3, "Second item should be middle (t3)");
        assert(sorted[2].timestamp === t1, "Last item should be oldest (t1)");


        log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`, failed === 0 ? 'pass' : 'fail');

    } catch (e) {
        log(`CRITICAL ERROR: ${e.message}`, 'fail');
        console.error(e);
    }
}
