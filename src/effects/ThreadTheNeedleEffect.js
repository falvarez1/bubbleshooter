import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Thread the Needle Effect
 * Rewards players for making precise shots through tight gaps between bubbles
 * with dramatic slow-motion, camera zoom, and visual effects
 */
export class ThreadTheNeedleEffect {
    constructor(scene, camera, gameManager) {
        this.scene = scene;
        this.camera = camera;
        this.gameManager = gameManager;
        
        // Effect configuration
        this.config = {
            // Gap detection thresholds
            MAX_GAP_WIDTH: CONFIG.BUBBLE_RADIUS * 3.0,  // 1.5x bubble diameter
            MIN_GAP_WIDTH: CONFIG.BUBBLE_RADIUS * 2.2,  // Just wider than bubble
            DETECTION_RADIUS: CONFIG.BUBBLE_RADIUS * 5, // Look for gaps within this radius
            
            // Scoring
            TIGHT_GAP_MULTIPLIER: 2.0,    // For gaps < 1.3x diameter
            NORMAL_GAP_MULTIPLIER: 1.5,   // For gaps < 1.5x diameter
            WALL_BOUNCE_BONUS: 0.5,       // Additional multiplier for wall bounces
            
            // Visual effects
            SLOWMO_DURATION: 0.2,          // Seconds of slow motion
            SLOWMO_SCALE: 0.5,             // Time scale during slow motion
            ZOOM_DURATION: 0.4,            // Camera zoom duration
            ZOOM_AMOUNT: 1.3,              // Camera zoom factor
            TRAIL_DURATION: 1.5,           // Light trail duration
            TRAIL_SEGMENTS: 20,            // Number of trail segments
            
            // Achievement tracking
            MIN_ACHIEVEMENT_GAP: CONFIG.BUBBLE_RADIUS * 2.5,
            ACHIEVEMENT_COOLDOWN: 1.0      // Prevent multiple triggers
        };
        
        // State tracking
        this.state = {
            isActive: false,
            slowmoTimeRemaining: 0,
            zoomProgress: 0,
            isZoomingIn: false,
            isZoomingOut: false,
            lastTriggerTime: 0,
            totalPrecisionShots: 0,
            bestGapSize: Infinity,
            currentMultiplier: 1.0,
            wallBounceCount: 0
        };
        
        // Camera state for zoom effect
        this.originalCameraZ = this.camera.position.z;
        this.targetCameraZ = this.originalCameraZ;
        this.zoomTarget = new THREE.Vector3();
        
        // Light trail visualization
        this.trailPoints = [];
        this.trailLine = null;
        this.trailMaterial = null;
        this.createTrailVisualization();
        
        // Gap detection cache
        this.gapCache = {
            lastCheckPosition: new THREE.Vector3(),
            lastCheckTime: 0,
            checkInterval: 16, // Check every frame at 60fps
            nearbyBubbles: []
        };
        
        // Metallic text shader for "PRECISION!" display
        this.metallicTextShader = {
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                varying vec2 vUv;
                
                void main() {
                    // Metallic shine effect
                    float shine = sin((vUv.x - time * 2.0) * 10.0) * 0.5 + 0.5;
                    shine = pow(shine, 3.0);
                    
                    // Base metallic color
                    vec3 metalColor = mix(color, vec3(1.0, 0.9, 0.7), shine * 0.7);
                    
                    // Edge glow
                    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    edge = pow(edge, 0.5);
                    
                    gl_FragColor = vec4(metalColor * (0.7 + edge * 0.3), 1.0);
                }
            `
        };
        
        // Particle system for gap visualization
        this.gapParticles = [];
        this.maxGapParticles = 50;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Statistics for achievements
        this.statistics = {
            totalThreads: 0,
            tightestGap: Infinity,
            wallBounceThreads: 0,
            consecutiveThreads: 0,
            lastThreadTime: 0
        };
    }
    
    /**
     * Setup event listeners for bubble movement
     */
    setupEventListeners() {
        // Listen for bubble movement to check gaps
        this.gameManager.eventBus.on('bubbleMoving', (data) => {
            if (!data.bubble || !data.bubble.isMoving) return;
            this.checkForGaps(data.bubble);
        });
        
        // Listen for wall bounces
        this.gameManager.eventBus.on('wallBounce', (data) => {
            if (this.state.isActive) {
                this.state.wallBounceCount++;
            }
        });
        
        // Listen for bubble attachment to reset state
        this.gameManager.eventBus.on('bubbleAttached', () => {
            this.resetState();
        });
    }
    
    /**
     * Create trail visualization components
     */
    createTrailVisualization() {
        // Create material for light trail
        this.trailMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                opacity: { value: 1.0 },
                color: { value: new THREE.Color(0x00ffff) }
            },
            vertexShader: `
                attribute float lineDistance;
                varying float vLineDistance;
                varying vec3 vPosition;
                
                void main() {
                    vLineDistance = lineDistance;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float opacity;
                uniform vec3 color;
                varying float vLineDistance;
                
                void main() {
                    // Animated glow along the trail
                    float glow = sin(vLineDistance * 10.0 - time * 5.0) * 0.5 + 0.5;
                    glow = pow(glow, 2.0);
                    
                    // Fade out over distance
                    float fade = 1.0 - vLineDistance;
                    fade = pow(fade, 2.0);
                    
                    vec3 finalColor = color + vec3(glow * 0.5);
                    gl_FragColor = vec4(finalColor, opacity * fade);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        // Create line geometry for trail
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.TRAIL_SEGMENTS * 3);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        this.trailLine = new THREE.Line(geometry, this.trailMaterial);
        this.trailLine.visible = false;
        this.scene.add(this.trailLine);
    }
    
    /**
     * Check if bubble is passing through a tight gap
     */
    checkForGaps(bubble) {
        const now = Date.now();
        
        // Throttle checks for performance
        if (now - this.gapCache.lastCheckTime < this.gapCache.checkInterval) {
            return;
        }
        
        // Don't trigger if recently activated
        if (now - this.state.lastTriggerTime < this.config.ACHIEVEMENT_COOLDOWN * 1000) {
            return;
        }
        
        this.gapCache.lastCheckTime = now;
        
        // Get nearby bubbles using spatial grid if available
        const nearbyBubbles = this.getNearbyBubbles(bubble);
        
        if (nearbyBubbles.length < 2) return; // Need at least 2 bubbles to form a gap
        
        // Check all pairs of nearby bubbles for gaps
        for (let i = 0; i < nearbyBubbles.length - 1; i++) {
            for (let j = i + 1; j < nearbyBubbles.length; j++) {
                const bubble1 = nearbyBubbles[i];
                const bubble2 = nearbyBubbles[j];
                
                // Check if the moving bubble is passing through the gap
                const gapInfo = this.calculateGapInfo(bubble, bubble1, bubble2);
                
                if (gapInfo && gapInfo.isThreading) {
                    this.triggerEffect(bubble, gapInfo);
                    return; // Only trigger once per pass
                }
            }
        }
    }
    
    /**
     * Get nearby bubbles for gap checking
     */
    getNearbyBubbles(movingBubble) {
        const nearbyBubbles = [];
        const checkRadius = this.config.DETECTION_RADIUS;
        
        // Use collision system's spatial grid if available
        if (this.gameManager.collisionSystem && this.gameManager.collisionSystem.spatialGrid) {
            const grid = this.gameManager.collisionSystem.spatialGrid;
            const candidates = grid.getNearby(
                movingBubble.position.x,
                movingBubble.position.y,
                checkRadius
            );
            
            // Filter to only include stationary bubbles
            candidates.forEach(bubble => {
                if (bubble && !bubble.isMoving && !bubble.isDestroyed) {
                    nearbyBubbles.push(bubble);
                }
            });
        } else {
            // Fallback: check all grid bubbles
            const gameState = this.gameManager.gameState;
            if (!gameState || !gameState.bubbleGrid) return nearbyBubbles;
            
            for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                    const bubble = gameState.bubbleGrid[y][x];
                    if (bubble && !bubble.isDestroyed && !bubble.isMoving) {
                        const distance = movingBubble.position.distanceTo(bubble.position);
                        if (distance <= checkRadius) {
                            nearbyBubbles.push(bubble);
                        }
                    }
                }
            }
        }
        
        return nearbyBubbles;
    }
    
    /**
     * Calculate gap information between two bubbles
     */
    calculateGapInfo(movingBubble, bubble1, bubble2) {
        // Get positions
        const p = movingBubble.position;
        const p1 = bubble1.position;
        const p2 = bubble2.position;
        
        // Calculate gap center and width
        const gapCenter = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const gapWidth = p1.distanceTo(p2) - (bubble1.radius + bubble2.radius);
        
        // Check if gap is within valid range
        if (gapWidth < this.config.MIN_GAP_WIDTH || gapWidth > this.config.MAX_GAP_WIDTH) {
            return null;
        }
        
        // Calculate if bubble is passing through the gap
        // Project bubble position onto the line between the two gap bubbles
        const gapVector = new THREE.Vector3().subVectors(p2, p1);
        const gapLength = gapVector.length();
        gapVector.normalize();
        
        const toBubble = new THREE.Vector3().subVectors(p, p1);
        const projection = toBubble.dot(gapVector);
        
        // Check if projection is within the gap
        if (projection < 0 || projection > gapLength) {
            return null;
        }
        
        // Calculate perpendicular distance to gap line
        const projectedPoint = new THREE.Vector3()
            .copy(gapVector)
            .multiplyScalar(projection)
            .add(p1);
        
        const perpendicularDistance = p.distanceTo(projectedPoint);
        
        // Check if bubble is close enough to the gap line
        const maxDistance = movingBubble.radius + gapWidth / 2;
        if (perpendicularDistance > maxDistance) {
            return null;
        }
        
        // Check if bubble is actually passing through (using velocity)
        const velocity = movingBubble.velocity;
        if (velocity.length() < 0.1) return null;
        
        // Project velocity onto perpendicular to gap
        const toGap = new THREE.Vector3().subVectors(gapCenter, p);
        const isApproaching = velocity.dot(toGap) > 0;
        
        if (!isApproaching) return null;
        
        // Calculate how tight the gap is
        const gapRatio = gapWidth / (movingBubble.radius * 2);
        const isTight = gapRatio < 1.3;
        
        return {
            isThreading: true,
            gapWidth: gapWidth,
            gapRatio: gapRatio,
            gapCenter: gapCenter,
            bubble1: bubble1,
            bubble2: bubble2,
            isTight: isTight,
            perpendicularDistance: perpendicularDistance
        };
    }
    
    /**
     * Trigger the Thread the Needle effect
     */
    triggerEffect(bubble, gapInfo) {
        this.state.isActive = true;
        this.state.lastTriggerTime = Date.now();
        
        // Calculate score multiplier based on gap tightness
        let multiplier = gapInfo.isTight ? 
            this.config.TIGHT_GAP_MULTIPLIER : 
            this.config.NORMAL_GAP_MULTIPLIER;
        
        // Add wall bounce bonus
        if (this.state.wallBounceCount > 0) {
            multiplier += this.config.WALL_BOUNCE_BONUS * this.state.wallBounceCount;
        }
        
        this.state.currentMultiplier = multiplier;
        
        // Update statistics
        this.statistics.totalThreads++;
        this.statistics.tightestGap = Math.min(this.statistics.tightestGap, gapInfo.gapWidth);
        if (this.state.wallBounceCount > 0) {
            this.statistics.wallBounceThreads++;
        }
        
        // Check for consecutive threads
        const timeSinceLastThread = Date.now() - this.statistics.lastThreadTime;
        if (timeSinceLastThread < 5000) {
            this.statistics.consecutiveThreads++;
        } else {
            this.statistics.consecutiveThreads = 1;
        }
        this.statistics.lastThreadTime = Date.now();
        
        // Trigger visual effects
        this.startSlowMotion();
        this.startCameraZoom(gapInfo.gapCenter);
        this.showPrecisionText(gapInfo);
        this.createLightTrail(bubble, gapInfo);
        this.createGapParticles(gapInfo);
        
        // Play special sound effect
        this.gameManager.playSound('precision_shot', {
            volume: 0.8,
            rate: gapInfo.isTight ? 1.2 : 1.0
        });
        
        // Emit event for score system
        this.gameManager.eventBus.emit('threadTheNeedle', {
            bubble: bubble,
            gapInfo: gapInfo,
            multiplier: multiplier,
            wallBounces: this.state.wallBounceCount,
            consecutive: this.statistics.consecutiveThreads
        });
        
        // Achievement check
        if (this.statistics.totalThreads >= 10) {
            this.gameManager.eventBus.emit('achievementUnlocked', {
                id: 'thread_master',
                name: 'Thread Master',
                description: 'Make 10 precision shots through tight gaps'
            });
        }
    }
    
    /**
     * Start slow motion effect
     */
    startSlowMotion() {
        this.state.slowmoTimeRemaining = this.config.SLOWMO_DURATION;
        
        // Apply time scale to game
        if (this.gameManager.gameState) {
            this.gameManager.gameState.timeScale = this.config.SLOWMO_SCALE;
        }
    }
    
    /**
     * Start camera zoom effect
     */
    startCameraZoom(targetPosition) {
        this.state.isZoomingIn = true;
        this.state.isZoomingOut = false;
        this.state.zoomProgress = 0;
        
        // Set zoom target
        this.zoomTarget.copy(targetPosition);
        this.targetCameraZ = this.originalCameraZ / this.config.ZOOM_AMOUNT;
        
        // Store original camera target
        this.originalCameraTarget = new THREE.Vector3(0, 0, 0);
    }
    
    /**
     * Show "PRECISION!" text with metallic effect
     */
    showPrecisionText(gapInfo) {
        // Calculate bonus text based on factors
        let bonusText = '';
        if (gapInfo.isTight) {
            bonusText = ' TIGHT GAP!';
        }
        if (this.state.wallBounceCount > 0) {
            bonusText += ` +${this.state.wallBounceCount} BOUNCES`;
        }
        
        // Use visual text display with metallic shader styling
        this.gameManager.visualTextDisplay.notificationManager.show({
            text: 'PRECISION!' + bonusText,
            type: 'precision_thread',
            className: 'thread-needle-text metallic-shine',
            priority: 4,
            duration: 2500,
            position: this.gameManager.visualTextDisplay.worldToScreen(gapInfo.gapCenter),
            customStyle: {
                fontSize: '48px',
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #FFD700, #FFA500, #FFD700)',
                webkitBackgroundClip: 'text',
                webkitTextFillColor: 'transparent',
                textShadow: '0 0 20px rgba(255, 215, 0, 0.8)',
                animation: 'metallic-shine 1s ease-in-out'
            }
        });
        
        // Show multiplier
        this.gameManager.visualTextDisplay.showFloatingScore(
            gapInfo.gapCenter,
            `${this.state.currentMultiplier.toFixed(1)}x`
        );
    }
    
    /**
     * Create light trail showing the perfect trajectory
     */
    createLightTrail(bubble, gapInfo) {
        // Store trail points
        this.trailPoints = [];
        const segments = this.config.TRAIL_SEGMENTS;
        
        // Create trail from bubble's previous positions (if tracked)
        // For now, create a straight line through the gap
        const startPos = bubble.position.clone();
        const direction = bubble.velocity.clone().normalize();
        
        for (let i = 0; i < segments; i++) {
            const t = i / (segments - 1);
            const offset = direction.clone().multiplyScalar(-t * CONFIG.BUBBLE_RADIUS * 5);
            const point = startPos.clone().add(offset);
            this.trailPoints.push(point);
        }
        
        // Update trail geometry
        const positions = this.trailLine.geometry.attributes.position;
        for (let i = 0; i < segments; i++) {
            const point = this.trailPoints[i];
            positions.setXYZ(i, point.x, point.y, point.z);
        }
        positions.needsUpdate = true;
        
        // Make trail visible
        this.trailLine.visible = true;
        this.trailMaterial.uniforms.opacity.value = 1.0;
        this.trailMaterial.uniforms.time.value = 0;
        
        // Color based on gap tightness
        const color = gapInfo.isTight ? 
            new THREE.Color(0xFFD700) : // Gold for tight gaps
            new THREE.Color(0x00FFFF);  // Cyan for normal gaps
        this.trailMaterial.uniforms.color.value = color;
    }
    
    /**
     * Create particles to highlight the gap
     */
    createGapParticles(gapInfo) {
        const particleCount = 20;
        const { gapCenter, bubble1, bubble2, gapWidth } = gapInfo;
        
        // Create particles along the gap
        for (let i = 0; i < particleCount; i++) {
            const t = i / (particleCount - 1);
            const position = new THREE.Vector3().lerpVectors(
                bubble1.position,
                bubble2.position,
                t
            );
            
            // Add some randomness
            position.x += (Math.random() - 0.5) * gapWidth * 0.3;
            position.y += (Math.random() - 0.5) * gapWidth * 0.3;
            
            // Create particle with outward velocity
            const velocity = new THREE.Vector3()
                .subVectors(position, gapCenter)
                .normalize()
                .multiplyScalar(Math.random() * 3 + 2);
            
            // Use particle pool if available
            if (this.gameManager.gameState && this.gameManager.gameState.particlePool) {
                this.gameManager.gameState.particlePool.spawn(
                    position.x,
                    position.y,
                    position.z,
                    gapInfo.isTight ? 0xFFD700 : 0x00FFFF,
                    0.3,
                    velocity
                );
            }
        }
    }
    
    /**
     * Reset state after effect completes
     */
    resetState() {
        this.state.isActive = false;
        this.state.wallBounceCount = 0;
        this.state.currentMultiplier = 1.0;
        
        // Hide trail
        if (this.trailLine) {
            this.trailLine.visible = false;
        }
    }
    
    /**
     * Update the effect animations
     */
    update(deltaTime) {
        // Update slow motion
        if (this.state.slowmoTimeRemaining > 0) {
            this.state.slowmoTimeRemaining -= deltaTime;
            
            if (this.state.slowmoTimeRemaining <= 0) {
                // End slow motion
                if (this.gameManager.gameState) {
                    this.gameManager.gameState.timeScale = 1.0;
                }
                this.state.slowmoTimeRemaining = 0;
            }
        }
        
        // Update camera zoom
        if (this.state.isZoomingIn || this.state.isZoomingOut) {
            this.state.zoomProgress += deltaTime / this.config.ZOOM_DURATION;
            
            if (this.state.zoomProgress >= 1.0) {
                if (this.state.isZoomingIn) {
                    // Start zooming out
                    this.state.isZoomingIn = false;
                    this.state.isZoomingOut = true;
                    this.state.zoomProgress = 0;
                    this.targetCameraZ = this.originalCameraZ;
                } else {
                    // Zoom complete
                    this.state.isZoomingOut = false;
                    this.camera.position.z = this.originalCameraZ;
                    this.camera.lookAt(0, 0, 0);
                }
            } else {
                // Smooth interpolation
                const t = this.easeInOutCubic(this.state.zoomProgress);
                
                if (this.state.isZoomingIn) {
                    // Zoom in toward gap
                    this.camera.position.z = THREE.MathUtils.lerp(
                        this.originalCameraZ,
                        this.targetCameraZ,
                        t
                    );
                    
                    // Pan camera toward gap center
                    const panAmount = t * 0.3;
                    this.camera.lookAt(
                        this.zoomTarget.x * panAmount,
                        this.zoomTarget.y * panAmount,
                        0
                    );
                } else {
                    // Zoom out to original
                    this.camera.position.z = THREE.MathUtils.lerp(
                        this.targetCameraZ,
                        this.originalCameraZ,
                        t
                    );
                    
                    // Pan back to center
                    const panAmount = (1 - t) * 0.3;
                    this.camera.lookAt(
                        this.zoomTarget.x * panAmount,
                        this.zoomTarget.y * panAmount,
                        0
                    );
                }
            }
        }
        
        // Update trail animation
        if (this.trailLine && this.trailLine.visible) {
            this.trailMaterial.uniforms.time.value += deltaTime * 2;
            this.trailMaterial.uniforms.opacity.value -= deltaTime / this.config.TRAIL_DURATION;
            
            if (this.trailMaterial.uniforms.opacity.value <= 0) {
                this.trailLine.visible = false;
            }
        }
    }
    
    /**
     * Easing function for smooth animations
     */
    easeInOutCubic(t) {
        return t < 0.5 ?
            4 * t * t * t :
            1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    /**
     * Get current statistics for achievements
     */
    getStatistics() {
        return {
            ...this.statistics,
            currentStreak: this.statistics.consecutiveThreads
        };
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        if (this.trailLine) {
            this.scene.remove(this.trailLine);
            this.trailLine.geometry.dispose();
            this.trailMaterial.dispose();
        }
        
        // Clear particles
        this.gapParticles = [];
    }
}