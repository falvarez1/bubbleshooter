// Test script to verify ghost bubble fixes
// Run this in the browser console after loading the game

function testGhostBubbleFix() {
    console.log("=== Testing Ghost Bubble Fix ===");
    
    // Check if the game object exists
    if (typeof game === 'undefined') {
        console.error("Game object not found. Make sure you're on the game page.");
        return;
    }
    
    // Test 1: Check if BubbleLifecycleManager is available
    console.log("\n1. Checking BubbleLifecycleManager:");
    try {
        if (game.gameLogic && game.gameLogic.destroyBubbleImmediately) {
            console.log("✓ GameLogic has updated destroyBubbleImmediately method");
        } else {
            console.error("✗ GameLogic missing updated method");
        }
    } catch (e) {
        console.error("✗ Error checking GameLogic:", e);
    }
    
    // Test 2: Check if BubbleInstances has hasInstance method
    console.log("\n2. Checking BubbleInstances updates:");
    try {
        if (game.bubbleInstances && typeof game.bubbleInstances.hasInstance === 'function') {
            console.log("✓ BubbleInstances has hasInstance method");
        } else {
            console.error("✗ BubbleInstances missing hasInstance method");
        }
    } catch (e) {
        console.error("✗ Error checking BubbleInstances:", e);
    }
    
    // Test 3: Check for destroyed bubbles in grid
    console.log("\n3. Checking for ghost bubbles in grid:");
    let ghostCount = 0;
    let totalBubbles = 0;
    
    for (let y = 0; y < 20; y++) { // Assuming max 20 rows
        for (let x = 0; x < 15; x++) { // Assuming max 15 columns
            const bubble = game.gameState.getBubbleAt(x, y);
            if (bubble) {
                totalBubbles++;
                if (bubble.isDestroyed) {
                    ghostCount++;
                    console.warn(`Ghost bubble found at ${x},${y}!`);
                }
            }
        }
    }
    
    if (ghostCount === 0) {
        console.log(`✓ No ghost bubbles found (${totalBubbles} active bubbles)`);
    } else {
        console.error(`✗ Found ${ghostCount} ghost bubbles out of ${totalBubbles} total`);
    }
    
    // Test 4: Check bubble instances vs grid consistency
    console.log("\n4. Checking visual/grid consistency:");
    const instanceCount = game.bubbleInstances ? game.bubbleInstances.activeBubbles.size : 0;
    console.log(`Grid bubbles: ${totalBubbles}, Visual instances: ${instanceCount}`);
    
    if (Math.abs(totalBubbles - instanceCount) <= 1) { // Allow 1 bubble difference for shooting bubble
        console.log("✓ Visual and grid are in sync");
    } else {
        console.warn(`⚠ Possible inconsistency: ${Math.abs(totalBubbles - instanceCount)} bubble difference`);
    }
    
    // Test 5: Try destroying a random bubble and verify it's gone
    console.log("\n5. Testing bubble destruction:");
    const testBubble = game.gameState.getAllBubbles().find(b => b && !b.isDestroyed);
    if (testBubble) {
        const testId = testBubble.id;
        const testX = testBubble.gridX;
        const testY = testBubble.gridY;
        
        console.log(`Destroying test bubble at ${testX},${testY}`);
        game.gameLogic.destroyBubbleImmediately(testBubble);
        
        // Check if it's really gone
        setTimeout(() => {
            const stillInGrid = game.gameState.getBubbleAt(testX, testY) === testBubble;
            const stillInVisual = game.bubbleInstances && game.bubbleInstances.hasInstance(testId);
            
            if (!stillInGrid && !stillInVisual) {
                console.log("✓ Bubble successfully destroyed and removed from all systems");
            } else {
                console.error(`✗ Bubble not fully removed - Grid: ${stillInGrid}, Visual: ${stillInVisual}`);
            }
        }, 100);
    }
    
    console.log("\n=== Test Complete ===");
    console.log("If you see ghost bubbles, run: cleanupGhostBubbles()");
}

// Function to clean up any existing ghost bubbles
function cleanupGhostBubbles() {
    console.log("Cleaning up ghost bubbles...");
    let cleaned = 0;
    
    for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 15; x++) {
            const bubble = game.gameState.getBubbleAt(x, y);
            if (bubble && bubble.isDestroyed) {
                game.gameState.bubbleGrid[y][x] = null;
                cleaned++;
            }
        }
    }
    
    // Also clean up visual instances
    if (game.bubbleInstances) {
        game.bubbleInstances.bubbleMap.forEach((mapping, bubbleId) => {
            if (mapping.bubble && mapping.bubble.isDestroyed) {
                game.bubbleInstances.removeBubble(mapping.bubble);
                cleaned++;
            }
        });
    }
    
    console.log(`Cleaned up ${cleaned} ghost bubbles`);
    return cleaned;
}

// Export functions to global scope
window.testGhostBubbleFix = testGhostBubbleFix;
window.cleanupGhostBubbles = cleanupGhostBubbles;

console.log("Ghost bubble test loaded. Run testGhostBubbleFix() to test the fixes.");