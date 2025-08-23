// Test script for ghost bubble cleanup functionality
// Run this in the browser console after the game is loaded

(function testGhostBubbleCleanup() {
    console.log('===== GHOST BUBBLE CLEANUP TEST =====');
    
    // Function to check current state
    function checkState(label) {
        const gridCount = game.gameState.getAllBubbles().filter(b => !b.isDestroyed).length;
        const visualCount = game.bubbleInstances ? game.bubbleInstances.activeBubbles.size : 0;
        const mismatch = gridCount !== visualCount;
        
        console.log(`\n${label}:`);
        console.log(`  Grid bubbles: ${gridCount}`);
        console.log(`  Visual instances: ${visualCount}`);
        console.log(`  State: ${mismatch ? '❌ MISMATCH' : '✅ SYNCED'}`);
        
        return { gridCount, visualCount, mismatch };
    }
    
    // Function to simulate level completion
    function simulateLevelComplete() {
        console.log('\n📍 Simulating level completion...');
        
        // Clear all bubbles
        const allBubbles = game.gameState.getAllBubbles();
        console.log(`  Clearing ${allBubbles.length} bubbles...`);
        
        allBubbles.forEach(bubble => {
            if (bubble && !bubble.isDestroyed) {
                game.gameLogic.destroyBubbleImmediately(bubble, true);
            }
        });
        
        // Trigger victory check (which adds new rows)
        setTimeout(() => {
            console.log('  Triggering victory check...');
            game.gameLogic.checkVictory();
        }, 100);
    }
    
    // Function to manually trigger cleanup
    function runCleanup() {
        console.log('\n🧹 Running manual cleanup...');
        const cleanedCount = game.gameLogic.cleanupGhostBubbles();
        console.log(`  Cleaned ${cleanedCount} ghost bubbles`);
        return cleanedCount;
    }
    
    // Test sequence
    console.log('\n1️⃣  INITIAL STATE CHECK');
    const initial = checkState('Initial state');
    
    if (initial.mismatch) {
        console.log('\n⚠️  Starting with mismatched state - running cleanup first');
        runCleanup();
        checkState('After initial cleanup');
    }
    
    console.log('\n2️⃣  SIMULATING LEVEL COMPLETION');
    simulateLevelComplete();
    
    // Check state after level completion and new rows
    setTimeout(() => {
        console.log('\n3️⃣  STATE AFTER LEVEL COMPLETION');
        const afterLevel = checkState('After level completion');
        
        if (afterLevel.mismatch) {
            console.log('\n⚠️  Ghost bubbles detected after level completion!');
            console.log('  This should have been auto-cleaned. Checking cleanup functionality...');
            
            // Manual cleanup
            const cleaned = runCleanup();
            
            // Final check
            console.log('\n4️⃣  FINAL STATE CHECK');
            const final = checkState('Final state');
            
            if (final.mismatch) {
                console.error('\n❌ CLEANUP FAILED - Ghost bubbles still present!');
                console.log('  Manual investigation needed.');
                
                // Debug info
                console.log('\n📊 Debug Information:');
                console.log('  Bubble instances map size:', game.bubbleInstances.bubbleMap.size);
                console.log('  Active types:', Array.from(game.bubbleInstances.activeTypes));
                
                // Check for specific ghost bubbles
                const gridBubbles = new Set(game.gameState.getAllBubbles().map(b => b.id));
                const visualBubbles = new Set(game.bubbleInstances.bubbleMap.keys());
                
                const ghosts = [];
                visualBubbles.forEach(id => {
                    if (!gridBubbles.has(id)) {
                        ghosts.push(id);
                    }
                });
                
                if (ghosts.length > 0) {
                    console.log(`  Found ${ghosts.length} visual ghosts:`, ghosts);
                }
            } else {
                console.log('\n✅ CLEANUP SUCCESSFUL - All systems synced!');
            }
        } else {
            console.log('\n✅ AUTO-CLEANUP WORKED - No ghost bubbles detected!');
        }
        
        console.log('\n===== TEST COMPLETE =====');
    }, 3000); // Wait for all animations and delays to complete
})();