// Test script to verify Chain Lightning ghost bubble fix
// Run in browser console: fetch('test_chain_lightning_fix.js').then(r => r.text()).then(eval);

(function() {
    console.log('=== Testing Chain Lightning Ghost Bubble Fix ===');
    
    // Test 1: Check if event handler is registered
    function testEventHandler() {
        console.log('\n1. Checking GameLogic event handler:');
        const game = window.game;
        if (!game) {
            console.error('✗ Game instance not found');
            return false;
        }
        
        const eventBus = game.gameManager?.eventBus;
        if (!eventBus) {
            console.error('✗ EventBus not found');
            return false;
        }
        
        // Check if destroyBubble event has listeners
        const hasDestroyBubbleEvent = eventBus._events && eventBus._events['destroyBubble'];
        if (hasDestroyBubbleEvent) {
            console.log('✓ destroyBubble event handler is registered');
            return true;
        } else {
            console.error('✗ destroyBubble event handler not found');
            return false;
        }
    }
    
    // Test 2: Monitor Chain Lightning destruction
    function monitorChainLightning() {
        console.log('\n2. Monitoring Chain Lightning destruction:');
        const game = window.game;
        if (!game) return;
        
        let destroyCount = 0;
        let ghostCount = 0;
        
        // Monitor destroyBubble events
        const originalEmit = game.gameManager.eventBus.emit;
        game.gameManager.eventBus.emit = function(event, data) {
            if (event === 'destroyBubble') {
                destroyCount++;
                console.log(`  [${destroyCount}] Bubble destruction triggered for:`, data.bubble?.id);
            }
            return originalEmit.call(this, event, data);
        };
        
        // Monitor instance removal
        if (game.bubbleInstances) {
            const originalRemove = game.bubbleInstances.removeBubble;
            game.bubbleInstances.removeBubble = function(bubble) {
                console.log(`  [Instance] Removing bubble from renderer:`, bubble?.id);
                return originalRemove.call(this, bubble);
            };
        }
        
        console.log('✓ Monitoring active. Use Chain Lightning to test.');
        console.log('  Press "0" key to spawn Chain Lightning bubble');
        
        // Check for ghost bubbles after Chain Lightning
        setTimeout(() => {
            checkForGhosts();
        }, 3000);
    }
    
    // Test 3: Check for ghost bubbles
    function checkForGhosts() {
        console.log('\n3. Checking for ghost bubbles:');
        const game = window.game;
        if (!game) return;
        
        let gridCount = 0;
        let instanceCount = 0;
        const ghostBubbles = [];
        
        // Count grid bubbles
        for (let y = 0; y < 12; y++) {
            for (let x = 0; x < 9; x++) {
                const bubble = game.gameState.getBubbleAt(x, y);
                if (bubble && !bubble.isDestroyed) {
                    gridCount++;
                    
                    // Check if it exists in instance renderer
                    if (game.bubbleInstances?.hasInstance(bubble)) {
                        instanceCount++;
                    } else if (bubble.useInstancedRendering) {
                        ghostBubbles.push({x, y, id: bubble.id});
                    }
                }
            }
        }
        
        // Count visual instances
        const visualCount = game.bubbleInstances?.getActiveCount() || 0;
        
        console.log(`  Grid bubbles: ${gridCount}`);
        console.log(`  Instance matches: ${instanceCount}`);
        console.log(`  Visual instances: ${visualCount}`);
        
        if (ghostBubbles.length > 0) {
            console.error(`✗ Found ${ghostBubbles.length} ghost bubbles:`, ghostBubbles);
        } else if (Math.abs(gridCount - visualCount) > 1) { // Allow 1 for shooting bubble
            console.warn(`⚠ Possible inconsistency: Grid=${gridCount}, Visual=${visualCount}`);
        } else {
            console.log('✓ No ghost bubbles detected');
        }
        
        return ghostBubbles;
    }
    
    // Clean up any existing ghost bubbles
    function cleanupGhosts() {
        console.log('\n4. Cleaning up ghost bubbles:');
        const game = window.game;
        if (!game) return;
        
        let cleaned = 0;
        const ghosts = checkForGhosts();
        
        ghosts.forEach(ghost => {
            const bubble = game.gameState.getBubbleAt(ghost.x, ghost.y);
            if (bubble) {
                // Force removal from grid and instance renderer
                game.gameState.setBubbleAt(ghost.x, ghost.y, null);
                if (game.bubbleInstances?.hasInstance(bubble)) {
                    game.bubbleInstances.removeBubble(bubble);
                }
                bubble.isDestroyed = true;
                bubble.destroy();
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            console.log(`✓ Cleaned ${cleaned} ghost bubbles`);
        } else {
            console.log('✓ No ghost bubbles to clean');
        }
    }
    
    // Run tests
    console.log('Running tests...');
    testEventHandler();
    monitorChainLightning();
    
    // Add helper functions to window
    window.checkChainLightningGhosts = checkForGhosts;
    window.cleanupChainLightningGhosts = cleanupGhosts;
    
    console.log('\n=== Test Setup Complete ===');
    console.log('Helper functions available:');
    console.log('  checkChainLightningGhosts() - Check for ghost bubbles');
    console.log('  cleanupChainLightningGhosts() - Clean up ghost bubbles');
    console.log('\nUse Chain Lightning (press "0" key) to test the fix');
})();