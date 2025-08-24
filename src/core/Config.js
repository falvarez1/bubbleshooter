/**
 * Game Configuration
 * Central location for all game constants and settings
 */

export const CONFIG = {
    // Bubble settings
    BUBBLE_RADIUS: 0.5,
    GRID_WIDTH: 11,
    GRID_HEIGHT: 14,
    HEX_WIDTH: 1.0, // Bubble diameter
    HEX_HEIGHT: 0.866, // sqrt(3)/2 * diameter for hexagonal packing
    
    // Sound
    SOUND_ENABLED: true,
    SOUND_VOLUME: 0.5,
    SOUND_MUTE: false,

    // Music
    MUSIC_VOLUME: 0.5,
    MUSIC_ENABLED: false,

    // Bloom Post-Processing
    BLOOM: {
        ENABLED: true,
        STRENGTH: 1.2,
        RADIUS: 0.85,
        THRESHOLD: 0.25,
        // Selective bloom categories - more specific
        CATEGORIES: {
            trajectoryLine: true,        // The main trajectory line
            trajectoryGlow: true,        // Extra glow layer on trajectory
            impactIndicator: true,       // Target indicator at trajectory end
            impactRing: true,           // Ring at impact point
            collisionParticles: false,  // Particles from bubble collisions
            explosionParticles: true,   // Particles from explosions
            powerUpEffects: true,       // Power-up visual effects
            wallImpact: false,          // Wall bounce particles
            shootingParticles: false    // Shooting effect particles
        }
    },

    // Physics
    SHOOTING_SPEED: 30,        // Increased from 20 to 30
    MAX_SHOOTING_SPEED: 75,    // Increased from 30 to 45
    WALL_BOUNCE_DAMPING: 0.95,
    
    // Colors
    BUBBLE_COLORS: [
        0xFF0000, // Pure Red - vibrant and distinct
        0x0000ff, // Deep Blue - clear contrast from red
        0xFFD700, // Gold/Yellow - bright and distinguishable
        0x00FF00, // Bright Green - pure green, very distinct
        0xFF1493, // Deep Pink - different from red
        0x9400D3, // Dark Violet - deep purple, good contrast
        0xFF8C00, // Dark Orange - distinct from yellow/red
        0x00CED1  // Dark Turquoise - distinct from blue
    ],
    
    // Game mechanics
    PARTICLE_COUNT: 30,
    COMBO_TIMEOUT: 2000,
    DANGER_LINE: -7,  // Moved from -5 to -7 (lower on screen)
    
    // Position Configuration
    SHOOTER_Y: -8,    // Y position of shooting bubble (was -6)
    GRID_TOP_Y: 6,    // Top position of bubble grid
    CEILING_Y: 7,     // Ceiling position for collision
    
    // Wall boundaries - calculated from grid width
    // Wall position = (GRID_WIDTH * HEX_WIDTH) / 2 + small margin
    WALL_LIMIT: 6.0,  // Was 5.5, now 6.0 for 11 bubbles
    
    // Impact Physics Configuration
    IMPACT_PHYSICS: {
        // Spring physics
        SPRING_CONSTANT: 0.5,        // How tight the spring is (0.1-1.0)
        DAMPING: 0.45,               // How quickly motion settles (0.8-0.95)
        POSITION_MULTIPLIER: 15,     // Speed of position updates
        
        // Visual effects
        SCALE_RESPONSE: 0.15,        // How much bubbles scale on impact (0.1-0.5)
        CONNECTION_ANIMATION: 1.2,   // Base animation intensity (0.5-2.0)
        
        // Force calculations
        ATTACHMENT_FORCE: 0.06,      // Force multiplier for attachment impacts
        DIRECT_HIT_FORCE: 0.08,      // Force multiplier for direct hits
        NEIGHBOR_FORCE: 1.2,         // Multiplier for neighbor impacts
        PROPAGATION_MULTIPLIER: 0.6, // Force reduction for propagation
        
        // Propagation settings
        MAX_DEPTH: 3,                // Maximum propagation depth (1-4)
        MIN_FORCE: 0.02,             // Minimum force to continue propagation
        PROPAGATION_DELAY: 20,       // Delay between propagation levels (ms)
        ANGLE_FACTOR: 0.3,           // Minimum angle factor (0-1)
        FALLOFF_RATE: 0.6,           // Force reduction per level (0.4-0.8)
        
        // Special effects
        NEW_ROW_DROP_FORCE: 2.0      // Drop force for new row bubbles
    },
    
    // Trajectory Visual Configuration
    TRAJECTORY: {
        // Style selection
        USE_ANIMATED_STYLE: true,     // true = flowing laser, false = static dots
        
        // Dot count
        NORMAL_DOT_COUNT: 10,         // Number of dots in normal mode
        PRECISION_DOT_COUNT: 80,      // Number of dots in precision aim mode
        
        // Size settings
        BASE_SIZE_MIN: 0.12,          // Minimum dot size (increased from 0.1)
        BASE_SIZE_MAX: 0.15,          // Maximum dot size (reduced from 0.25)
        GLOW_SIZE_MULTIPLIER: 2.5,    // Glow size relative to dot
        
        // Opacity settings
        BASE_OPACITY_MIN: 0.8,        // Minimum opacity
        BASE_OPACITY_MAX: 1.0,        // Maximum opacity (increases along path)
        MIN_DOT_OPACITY: 0.7,         // Never go below this opacity
        MIN_GLOW_OPACITY: 0.4,        // Minimum glow opacity
        GLOW_OPACITY_MULTIPLIER: 0.5, // Glow opacity relative to dot
        
        // Emissive settings
        EMISSIVE_INTENSITY: 3.5,      // Normal mode emissive intensity
        EMISSIVE_INTENSITY_PRECISION: 5, // Precision aim emissive intensity
        EMISSIVE_MIN_MULTIPLIER: 0.8, // Minimum emissive multiplier
        
        // Animation settings (for animated style)
        ANIMATION_SPEED: 4,           // Overall animation speed multiplier
        FLOW_SPEED: 0.09,             // How fast dots flow forward
        PULSE_RANGE: 0.3,             // Pulse variation (0.7 to 1.0)
        BRIGHTNESS_RANGE: 0.3,        // Brightness variation
        WAVE_AMPLITUDE: 0.05,         // Side-to-side wave motion
        WAVE_FREQUENCY: 3,            // Wave oscillation speed
        
        // Laser beam settings (for animated laser style)
        LASER: {
            FLOW_SPEED: 1.0,          // How fast energy flows along beam (1-20)
            PULSE_SPEED: 6.0,         // How fast the beam pulses (1-30) 
            WAVE_FREQUENCY: 8.0,      // Main wave frequency (1-20)
            PACKET_FREQUENCY: 12.0,   // Energy packet frequency (1-15)
            HIGHLIGHT_FREQUENCY: 9.0, // Highlight frequency (1-10)
            WAVE_AMPLITUDE: 0.9,      // Wave strength (0.1-1.0)
            PACKET_AMPLITUDE: 2.5,    // Energy packet brightness (0.1-2.0)
            HIGHLIGHT_AMPLITUDE: 4.0, // Highlight brightness (0.1-3.0)
            BEAM_RADIUS: 0.12,        // Beam thickness (0.02-0.15)
            GLOW_RADIUS: 0.22,        // Glow thickness (0.05-0.25)
            OPACITY: 1.0,             // Overall opacity (0.1-1.0)
            INTENSITY: 3.5,           // Overall brightness (0.5-3.0)
            
            // Power-responsive settings
            POWER_SCALING: {
                THICKNESS_MULTIPLIER: 1.6,    // Max thickness multiplier at full power
                INTENSITY_MULTIPLIER: 2.0,    // Max intensity multiplier at full power
                FLOW_SPEED_MULTIPLIER: 3.0,   // Max flow speed multiplier at full power
                PARALLEL_BEAMS_THRESHOLD: 0.8, // Power level to show multiple beams
                MAX_PARALLEL_BEAMS: 3,        // Maximum number of parallel beams
                POWER_SURGE_THRESHOLD: 0.9,   // Power level to trigger surge effects
                SURGE_INTENSITY: 5.0,         // Intensity multiplier for power surge
                CRACKLING_FREQUENCY: 15.0,    // Frequency of crackling effects
                CRACKLING_AMPLITUDE: 1.5      // Amplitude of crackling effects
            },
            
            // Bounce effects
            BOUNCE_EFFECTS: {
                FLASH_INTENSITY: 8.0,         // Brightness of bounce flash
                FLASH_DURATION: 0.3,          // Duration of bounce flash (seconds)
                FLASH_RADIUS: 0.4,            // Size of bounce flash effect
                DISPERSION_PARTICLES: 12,     // Number of dispersion particles
                REFRACTION_ANGLE: 0.2,        // Visual refraction angle at bounce
                CONFIDENCE_FADE: 0.7          // Opacity reduction after each bounce
            },
            
            // Color coding
            COLOR_CODING: {
                OPTIMAL_SHOT_HUE: 120,        // Green hue for optimal shots (0-360)
                RISKY_SHOT_HUE: 0,            // Red hue for risky shots (0-360)
                RISK_THRESHOLD: 0.3,          // Risk assessment threshold
                COLOR_TRANSITION_SPEED: 2.0,  // Speed of color transitions
                SATURATION_BOOST: 0.3,        // Saturation increase for color coding
                RAINBOW_CYCLE_SPEED: 2.0      // Speed of rainbow cycling for rainbow bubbles
            },
            
            // Collision prediction
            PREDICTION: {
                ATTACHMENT_GLOW_SIZE: 0.3,    // Size of attachment point glow
                ATTACHMENT_GLOW_INTENSITY: 4.0, // Intensity of attachment glow
                MATCH_GROUP_HIGHLIGHT: 0.5,   // Opacity of match group highlighting
                CASCADE_TRAIL_OPACITY: 0.4,   // Opacity of cascade prediction trails
                PREDICTION_CONFIDENCE: 0.8    // Confidence threshold for predictions
            }
        },
        
        // Static style settings
        STATIC_OPACITY_MIN: 0.3,      // Original static minimum opacity
        STATIC_OPACITY_MAX: 0.7,      // Original static maximum opacity
        STATIC_SIZE_MIN: 0.05,        // Original static minimum size
        STATIC_SIZE_MAX: 0.15,        // Original static maximum size
        STATIC_EMISSIVE: 2,           // Original static emissive intensity
        STATIC_EMISSIVE_PRECISION: 3  // Original precision emissive
    }
};

// Particle Effects Configuration
export const PARTICLE_CONFIG = {
    // Performance preset: 'low', 'medium', 'high', 'ultra'
    preset: 'ultra',
    
    // Individual settings (override preset)
    poolSize: 300,              // Total particle pool size
    
    // Color Splash Power-Up
    colorSplash: {
        waveParticles: 20,      // Main explosion particles (was 50->20)
        spiralParticles: 4,     // Per-bubble spiral (was 8->4)
        transformParticles: 8,  // Color change particles (was 20->8)
        maxClusterSize: 15,     // Max bubbles affected
        spiralEveryNth: 2,      // Create spiral every N bubbles
        transformDelay: 80,     // Delay between transforms
        batchSize: 5,           // Transform batch size
        checkForMatches: false  // Enable/disable automatic match checking after transformation
    },
    
    // Regular bubble pop
    bubblePop: {
        particles: 15,          // Particles per pop
        size: 0.2,
        speed: 10,
        decay: 0.02
    },
    
    // Bomb explosion
    bombExplosion: {
        particles: 30,          // Particles for bomb
        size: 0.3,
        speed: 15,
        decay: 0.025
    },
    
    // Lightning effects
    lightning: {
        particles: 30,          // Electric burst particles
        arcSegments: 5,         // Lightning path segments
        electricArcs: 15        // Destruction effect particles
    },
    
    // Rainbow effects
    rainbow: {
        particles: 20,
        size: 0.15,
        speed: 8
    },
    
    // Rocket Exhaust Spark Effects
    rocketExhaust: {
        // Base particle counts
        baseParticles: 4,           // Base number of exhaust sparks
        powerMultiplier: 1.2,       // Multiplier for high power (1x to 2.2x)
        burstParticles: 6,          // Extra particles for power burst
        burstThreshold: 0.6,        // Power level to trigger burst
        
        // Spark geometry
        sparkBaseSize: 0.05,        // Base spark size
        sparkPowerSize: 0.03,       // Additional size per power unit
        sparkLength: 4.0,           // Length multiplier for cylinder
        sparkTaper: {
            base: 0.3,              // Base width ratio
            tip: 0.1                // Tip width ratio
        },
        sparkSegments: 4,           // Radial segments for performance
        
        // Exhaust physics
        baseSpeed: 4,               // Minimum exhaust velocity
        maxSpeed: 10,               // Maximum exhaust velocity  
        speedVariation: 0.6,        // Random speed variation (±30%)
        coneSpread: {
            base: 0.3,              // Base cone angle (radians)
            power: 0.5              // Additional spread per power unit
        },
        burstConeAngle: 0.4,        // Burst particle cone angle
        
        // Visual properties
        colors: {
            low: 0x1e90ff,          // Blue for low power
            medium: 0xff8c00,       // Dark orange for medium power
            high: 0xff4500,         // Bright orange-red for high power
            burst: {
                intensity: 0.8,     // Base white intensity
                yellow: 0.9,        // Yellow component
                orange: 0.3         // Orange component  
            }
        },
        colorThresholds: {
            medium: 0.4,            // Power level for medium color
            high: 0.7               // Power level for high color
        },
        
        // Material properties
        opacity: 0.5,               // Base spark opacity
        blending: 'additive',       // Blending mode for bright sparks
        depthWrite: true,          // Allow overlapping sparks
        
        // Animation properties
        decay: 0.04,                // How fast sparks fade
        shrinkRate: 0.97,           // Scale reduction per frame
        burstDecay: 0.08,           // Faster decay for burst sparks
        orientToVelocity: true,     // Align sparks with movement
        minVelocityForOrientation: 0.1  // Minimum velocity to maintain orientation
    },
    
    // Visual quality
    quality: {
        particleSegments: 8,    // Sphere segments (6 for performance, 8+ for quality)
        useLighting: true,     // Use MeshBasicMaterial vs MeshStandardMaterial
        glowEffects: true,      // Enable glow meshes
        animateParticles: true  // Animate particle properties
    }
};

// Performance presets
export const PARTICLE_PRESETS = {
    low: {
        poolSize: 150,
        colorSplash: { waveParticles: 10, spiralParticles: 2, transformParticles: 4, maxClusterSize: 10, spiralEveryNth: 3 },
        bubblePop: { particles: 8 },
        bombExplosion: { particles: 15 },
        lightning: { particles: 15, electricArcs: 8 },
        rainbow: { particles: 10 },
        rocketExhaust: { baseParticles: 2, burstParticles: 3, sparkSegments: 3 },
        quality: { particleSegments: 4, useLighting: false, glowEffects: false }
    },
    medium: {
        poolSize: 300,
        colorSplash: { waveParticles: 20, spiralParticles: 4, transformParticles: 8, maxClusterSize: 15, spiralEveryNth: 2 },
        bubblePop: { particles: 15 },
        bombExplosion: { particles: 30 },
        lightning: { particles: 30, electricArcs: 15 },
        rainbow: { particles: 20 },
        rocketExhaust: { baseParticles: 3, burstParticles: 4, sparkSegments: 4 },
        quality: { particleSegments: 6, useLighting: false, glowEffects: true }
    },
    high: {
        poolSize: 500,
        colorSplash: { waveParticles: 35, spiralParticles: 6, transformParticles: 15, maxClusterSize: 20, spiralEveryNth: 1 },
        bubblePop: { particles: 20 },
        bombExplosion: { particles: 40 },
        lightning: { particles: 40, electricArcs: 20 },
        rainbow: { particles: 30 },
        rocketExhaust: { baseParticles: 4, burstParticles: 6, sparkSegments: 4 },
        quality: { particleSegments: 8, useLighting: true, glowEffects: true }
    },
    ultra: {
        poolSize: 800,
        colorSplash: { waveParticles: 50, spiralParticles: 8, transformParticles: 20, maxClusterSize: 30, spiralEveryNth: 1 },
        bubblePop: { particles: 30 },
        bombExplosion: { particles: 60 },
        lightning: { particles: 50, electricArcs: 30 },
        rainbow: { particles: 40 },
        rocketExhaust: { baseParticles: 5, burstParticles: 8, sparkSegments: 6 },
        quality: { particleSegments: 12, useLighting: true, glowEffects: true }
    }
};

// Apply preset function
export function applyParticlePreset(presetName, particleConfig = PARTICLE_CONFIG) {
    const preset = PARTICLE_PRESETS[presetName];
    if (preset) {
        // Deep merge preset values instead of overwriting entire objects
        for (const key in preset) {
            if (preset.hasOwnProperty(key)) {
                if (typeof preset[key] === 'object' && preset[key] !== null && !Array.isArray(preset[key])) {
                    // For objects, merge properties instead of replacing
                    if (!particleConfig[key]) {
                        particleConfig[key] = {};
                    }
                    Object.assign(particleConfig[key], preset[key]);
                } else {
                    // For primitives, replace directly
                    particleConfig[key] = preset[key];
                }
            }
        }
        particleConfig.preset = presetName;
        console.log(`Applied particle preset: ${presetName}`);
        return true;
    }
    return false;
}