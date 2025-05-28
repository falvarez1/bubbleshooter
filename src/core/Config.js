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
    
    // Physics
    SHOOTING_SPEED: 30,        // Increased from 20 to 30
    MAX_SHOOTING_SPEED: 75,    // Increased from 30 to 45
    WALL_BOUNCE_DAMPING: 0.95,
    
    // Colors
    BUBBLE_COLORS: [
        0xFF0000, // Pure Red - vibrant and distinct
        0x0080FF, // Sky Blue - clear contrast from red
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
        MAX_DEPTH: 2,                // Maximum propagation depth (1-4)
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
        USE_ANIMATED_STYLE: false,     // true = flowing laser, false = static dots
        
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
            INTENSITY: 3.5            // Overall brightness (0.5-3.0)
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
        batchSize: 5            // Transform batch size
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
        quality: { particleSegments: 4, useLighting: false, glowEffects: false }
    },
    medium: {
        poolSize: 300,
        colorSplash: { waveParticles: 20, spiralParticles: 4, transformParticles: 8, maxClusterSize: 15, spiralEveryNth: 2 },
        bubblePop: { particles: 15 },
        bombExplosion: { particles: 30 },
        lightning: { particles: 30, electricArcs: 15 },
        rainbow: { particles: 20 },
        quality: { particleSegments: 6, useLighting: false, glowEffects: true }
    },
    high: {
        poolSize: 500,
        colorSplash: { waveParticles: 35, spiralParticles: 6, transformParticles: 15, maxClusterSize: 20, spiralEveryNth: 1 },
        bubblePop: { particles: 20 },
        bombExplosion: { particles: 40 },
        lightning: { particles: 40, electricArcs: 20 },
        rainbow: { particles: 30 },
        quality: { particleSegments: 8, useLighting: true, glowEffects: true }
    },
    ultra: {
        poolSize: 800,
        colorSplash: { waveParticles: 50, spiralParticles: 8, transformParticles: 20, maxClusterSize: 30, spiralEveryNth: 1 },
        bubblePop: { particles: 30 },
        bombExplosion: { particles: 60 },
        lightning: { particles: 50, electricArcs: 30 },
        rainbow: { particles: 40 },
        quality: { particleSegments: 12, useLighting: true, glowEffects: true }
    }
};

// Apply preset function
export function applyParticlePreset(presetName, particleConfig = PARTICLE_CONFIG) {
    const preset = PARTICLE_PRESETS[presetName];
    if (preset) {
        Object.assign(particleConfig, preset);
        particleConfig.preset = presetName;
        console.log(`Applied particle preset: ${presetName}`);
        return true;
    }
    return false;
}