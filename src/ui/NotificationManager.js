/**
 * NotificationManager
 * Handles multiple simultaneous notifications with smart positioning and queuing
 * Prevents overlapping notifications by using zones and vertical stacking
 */
export class NotificationManager {
    constructor(eventBus = null) {
        this.activeNotifications = new Map();
        this.queue = [];
        this.processing = false;
        this.eventBus = eventBus;
        this.blockingNotificationCount = 0;
        this.pausedTimeouts = new Map();
        this.isPaused = false;
        
        // Define zones for different notification types
        // Each zone has a base position and can stack notifications vertically
        this.zones = {
            // Primary zone - center top for major events (combos, level up)
            primary: { 
                x: '50%', 
                y: '25%',  // Moved up to avoid overlap with center
                priority: 3,
                maxStack: 2
            },
            // Secondary zone - left side for power-ups
            powerup: { 
                x: '30%',  // Moved more inward to avoid edge cutoff
                y: '35%',
                priority: 2,
                maxStack: 3
            },
            // Tertiary zone - right side for scores and minor events  
            score: { 
                x: '70%',  // Moved more inward to avoid edge cutoff
                y: '35%',
                priority: 1,
                maxStack: 4
            },
            // Center zone - for critical announcements (zen moment)
            center: {
                x: '50%',
                y: '45%',  // Slightly higher to give more separation
                priority: 4,
                maxStack: 1
            }
        };
        
        // Track active notifications per zone
        this.zoneOccupancy = {
            primary: [],
            powerup: [],
            score: [],
            center: []
        };
        
        // Notification type to zone mapping
        this.typeToZone = {
            // Major events
            'combo': 'primary',
            'megaClear': 'primary',
            'levelUp': 'primary',
            'zenMoment': 'center',  // Zen moment gets special center treatment
            'victory': 'center',
            
            // Power-ups
            'rainbow': 'powerup',
            'bomb': 'powerup',
            'lightning': 'powerup',
            'precision': 'powerup',
            'colorSplash': 'powerup',
            'powerup': 'powerup',
            
            // Scores and minor events
            'score': 'score',
            'floatingClear': 'score',
            'points': 'score'
        };
        
        // Define which notification types block gameplay
        this.blockingTypes = new Set([
            'zenMoment',
            'levelUp',
            'victory',
            'megaClear'
        ]);
        
        // Initialize DOM container
        this.initializeContainer();
        
        // Listen for pause/resume events if eventBus is available
        if (this.eventBus) {
            this.eventBus.on('gamePaused', () => this.pause());
            this.eventBus.on('gameResumed', () => this.resume());
        }
    }
    
    initializeContainer() {
        // Create container for all notifications if it doesn't exist
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2000;
            `;
            document.body.appendChild(container);
        }
        this.container = document.getElementById('notification-container');
        
        // Initialize overlay element (hidden by default)
        this.overlay = null;
    }
    
    /**
     * Show a notification with smart positioning
     * @param {Object} options - Notification options
     * @param {string} options.text - Text to display
     * @param {string} options.type - Type of notification (combo, powerup, score, etc.)
     * @param {number} options.priority - Priority (1-4, higher is more important)
     * @param {number} options.duration - How long to show (ms)
     * @param {string} options.className - Additional CSS class
     * @param {Object} options.position - Optional specific position override
     * @param {boolean} options.immediate - Skip queue and show immediately
     */
    show(options) {
        const notification = {
            id: Date.now() + Math.random(),
            text: options.text || '',
            type: options.type || 'default',
            priority: options.priority || 1,
            duration: options.duration || 2000,
            className: options.className || '',
            position: options.position || null,
            immediate: options.immediate || false,
            timestamp: Date.now()
        };
        
        // High priority or immediate notifications bypass queue
        if (notification.immediate || notification.priority >= 4) {
            this.displayNotification(notification);
        } else {
            // Add to queue
            this.queue.push(notification);
            this.queue.sort((a, b) => b.priority - a.priority);
            
            if (!this.processing) {
                this.processQueue();
            }
        }
    }
    
    async processQueue() {
        this.processing = true;
        
        while (this.queue.length > 0) {
            const notification = this.queue.shift();
            
            // Skip if notification is too old (> 3 seconds)
            if (Date.now() - notification.timestamp > 3000) {
                continue;
            }
            
            // Display the notification
            await this.displayNotification(notification);
            
            // Small delay between notifications for cascade effect
            await this.delay(150);
        }
        
        this.processing = false;
    }
    
    async displayNotification(notification) {
        // Determine zone
        const zoneName = this.typeToZone[notification.type] || 'primary';
        const zone = this.zones[zoneName];
        
        // Check if this is a blocking notification
        const isBlocking = this.blockingTypes.has(notification.type);
        
        // If blocking, pause the game completely
        if (isBlocking && this.eventBus) {
            this.blockingNotificationCount++;
            if (this.blockingNotificationCount === 1) {
                // First blocking notification, pause everything
                this.eventBus.emit('pauseAll', { 
                    reason: 'notification',
                    notificationType: notification.type 
                });
                
                // Show overlay for better visibility
                this.showBlockingOverlay();
            }
        }
        
        // Calculate position with stacking
        const position = this.calculatePosition(notification, zone, zoneName);
        
        // Create DOM element
        const element = this.createElement(notification, position);
        
        // Track active notification
        this.activeNotifications.set(notification.id, {
            ...notification,
            element,
            zone: zoneName,
            isBlocking
        });
        
        // Add to zone occupancy
        this.zoneOccupancy[zoneName].push(notification.id);
        
        // Add to container
        this.container.appendChild(element);
        
        // Trigger entrance animation
        requestAnimationFrame(() => {
            element.classList.add('notification-enter');
        });
        
        // Set up removal with tracking for pause/resume
        const timeoutId = setTimeout(() => {
            this.removeNotification(notification.id);
        }, notification.duration);
        
        // Update tracking with timeout ID and start time
        const trackedNotification = this.activeNotifications.get(notification.id);
        if (trackedNotification) {
            trackedNotification.timeoutId = timeoutId;
            trackedNotification.startTime = Date.now();
        }
    }
    
    calculatePosition(notification, zone, zoneName) {
        // If specific position provided, clamp it to screen bounds
        if (notification.position) {
            const padding = 100; // Minimum distance from edge
            const x = Math.max(padding, Math.min(window.innerWidth - padding, notification.position.x));
            const y = Math.max(padding, Math.min(window.innerHeight - padding, notification.position.y));
            return {
                x: x + 'px',
                y: y + 'px'
            };
        }
        
        // Get current stack count in this zone
        const stackCount = this.zoneOccupancy[zoneName].length;
        
        // Check for potential overlaps with other zones
        const hasOverlapRisk = this.checkOverlapRisk(zoneName);
        
        // Calculate vertical offset for stacking
        let yOffset = 0;
        if (stackCount > 0 && stackCount < zone.maxStack) {
            // Stack with 70px spacing
            yOffset = stackCount * 70;
        } else if (stackCount >= zone.maxStack) {
            // Zone is full, find alternative zone
            const altZone = this.findAlternativeZone(zoneName);
            if (altZone) {
                return this.calculatePosition(notification, this.zones[altZone], altZone);
            }
        }
        
        // Add additional offset if there's overlap risk
        if (hasOverlapRisk) {
            yOffset += 100; // Add extra spacing to avoid overlap
        }
        
        // Parse base Y position and add offset
        const baseY = parseFloat(zone.y);
        const finalY = `calc(${zone.y} + ${yOffset}px)`;
        
        return {
            x: zone.x,
            y: finalY
        };
    }
    
    findAlternativeZone(currentZone) {
        // Priority order for fallback zones
        const fallbackOrder = {
            'primary': ['powerup', 'score'],
            'powerup': ['primary', 'score'],
            'score': ['powerup', 'primary'],
            'center': ['primary']
        };
        
        const alternatives = fallbackOrder[currentZone] || [];
        
        for (const alt of alternatives) {
            if (this.zoneOccupancy[alt].length < this.zones[alt].maxStack) {
                return alt;
            }
        }
        
        return null;
    }
    
    createElement(notification, position) {
        const element = document.createElement('div');
        
        // Build class list
        const classes = ['game-notification'];
        if (notification.className) {
            classes.push(notification.className);
        }
        classes.push(`notification-type-${notification.type}`);
        classes.push(`notification-priority-${notification.priority}`);
        
        element.className = classes.join(' ');
        element.textContent = notification.text;
        
        // Apply positioning
        element.style.cssText = `
            position: absolute;
            left: ${position.x};
            top: ${position.y};
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;
        
        return element;
    }
    
    removeNotification(id) {
        const notification = this.activeNotifications.get(id);
        if (!notification) return;
        
        const { element, zone, isBlocking } = notification;
        
        // If this was a blocking notification, update counter
        if (isBlocking && this.eventBus) {
            this.blockingNotificationCount--;
            if (this.blockingNotificationCount === 0) {
                // No more blocking notifications, resume everything
                this.eventBus.emit('resumeAll', { 
                    reason: 'notification' 
                });
                
                // Hide overlay
                this.hideBlockingOverlay();
            }
        }
        
        // Trigger exit animation
        element.classList.add('notification-exit');
        
        // Remove from tracking
        this.activeNotifications.delete(id);
        
        // Remove from zone occupancy
        const zoneIndex = this.zoneOccupancy[zone].indexOf(id);
        if (zoneIndex > -1) {
            this.zoneOccupancy[zone].splice(zoneIndex, 1);
        }
        
        // Remove DOM element after animation
        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
        }, 300);
        
        // Reposition remaining notifications in this zone
        this.repositionZone(zone);
    }
    
    repositionZone(zoneName) {
        const zoneNotifications = this.zoneOccupancy[zoneName];
        const zone = this.zones[zoneName];
        
        zoneNotifications.forEach((id, index) => {
            const notification = this.activeNotifications.get(id);
            if (notification && notification.element) {
                const yOffset = index * 70;
                const finalY = `calc(${zone.y} + ${yOffset}px)`;
                
                notification.element.style.top = finalY;
            }
        });
    }
    
    /**
     * Clear all notifications
     */
    clearAll() {
        this.queue = [];
        this.activeNotifications.forEach((notification, id) => {
            this.removeNotification(id);
        });
    }
    
    /**
     * Clear notifications of a specific type
     */
    clearType(type) {
        // Clear from queue
        this.queue = this.queue.filter(n => n.type !== type);
        
        // Clear active notifications
        this.activeNotifications.forEach((notification, id) => {
            if (notification.type === type) {
                this.removeNotification(id);
            }
        });
    }
    
    /**
     * Check if there's a risk of overlap with adjacent zones
     */
    checkOverlapRisk(zoneName) {
        // Define zones that are visually close to each other
        const adjacentZones = {
            'center': ['primary'],
            'primary': ['center', 'powerup', 'score'],
            'powerup': ['primary'],
            'score': ['primary']
        };
        
        const adjacent = adjacentZones[zoneName] || [];
        
        // Check if any adjacent zone has active notifications
        for (const adjZone of adjacent) {
            if (this.zoneOccupancy[adjZone] && this.zoneOccupancy[adjZone].length > 0) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Helper to create delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Check if a zone has space
     */
    hasSpaceInZone(zoneName) {
        const zone = this.zones[zoneName];
        return this.zoneOccupancy[zoneName].length < zone.maxStack;
    }
    
    /**
     * Get notification by ID
     */
    getNotification(id) {
        return this.activeNotifications.get(id);
    }
    
    /**
     * Show overlay for blocking notifications
     */
    showBlockingOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'notification-overlay';
            // Insert overlay BEFORE the notification container so notifications appear on top
            document.body.insertBefore(this.overlay, this.container);
        }
        
        // Force reflow before adding active class for animation
        this.overlay.offsetHeight;
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });
    }
    
    /**
     * Hide overlay for blocking notifications
     */
    hideBlockingOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            // Remove overlay after transition completes
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }, 300);
        }
    }
    
    /**
     * Pause all notifications and their animations
     */
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        
        // Pause all active notification animations
        this.activeNotifications.forEach((notification, id) => {
            if (notification.element) {
                // Pause CSS animations
                const element = notification.element;
                const computedStyle = window.getComputedStyle(element);
                
                // Store current animation state
                element.dataset.animationPlayState = computedStyle.animationPlayState;
                element.style.animationPlayState = 'paused';
                
                // If there's a removal timeout, clear it and store remaining time
                if (notification.timeoutId) {
                    clearTimeout(notification.timeoutId);
                    const elapsed = Date.now() - notification.startTime;
                    const remaining = notification.duration - elapsed;
                    this.pausedTimeouts.set(id, {
                        remaining: Math.max(0, remaining),
                        notification: notification
                    });
                }
            }
        });
        
        // Pause processing of queued notifications
        this.processingPaused = this.processing;
        this.processing = false;
    }
    
    /**
     * Resume all notifications and their animations
     */
    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        
        // Resume all active notification animations
        this.activeNotifications.forEach((notification, id) => {
            if (notification.element) {
                const element = notification.element;
                
                // Resume CSS animations
                element.style.animationPlayState = element.dataset.animationPlayState || 'running';
                delete element.dataset.animationPlayState;
            }
        });
        
        // Restart removal timeouts with remaining time
        this.pausedTimeouts.forEach((pausedData, id) => {
            const notification = this.activeNotifications.get(id);
            if (notification) {
                notification.startTime = Date.now();
                notification.timeoutId = setTimeout(() => {
                    this.removeNotification(id);
                }, pausedData.remaining);
            }
        });
        this.pausedTimeouts.clear();
        
        // Resume processing if it was paused
        if (this.processingPaused) {
            this.processing = true;
            this.processingPaused = false;
            this.processQueue();
        }
    }
}