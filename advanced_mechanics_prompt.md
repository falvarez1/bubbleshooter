# Advanced Game Mechanics Implementation Prompt

## Core Objective
Transform a basic bubble shooter into a feature-rich, engaging game by systematically implementing advanced mechanics, power-ups, and progression systems using a modular, scalable architecture.

## Implementation Philosophy

### Design Principles
- **Progressive Complexity** - Introduce mechanics gradually to avoid overwhelming players
- **Modular Architecture** - Each system should be independent and easily extendable
- **Balanced Gameplay** - Every addition should enhance rather than break core mechanics
- **Performance First** - No mechanic should compromise 60 FPS gameplay
- **Player Agency** - Give players meaningful choices and strategic depth

### Development Approach
1. **Foundation First** - Ensure core bubble shooter mechanics are flawless
2. **System by System** - Implement one major system completely before moving to next
3. **Test and Balance** - Each addition needs thorough playtesting
4. **Polish Every Layer** - Visual and audio feedback for every new mechanic
5. **Performance Monitor** - Optimize continuously throughout development

## System Architecture Requirements

### Core Game Manager
Create a modular `GameManager` class that coordinates:
```javascript
class GameManager {
    constructor() {
        this.powerUpSystem = new PowerUpSystem();
        this.progressionSystem = new ProgressionSystem();
        this.achievementSystem = new AchievementSystem();
        this.particleSystem = new ParticleSystem();
        this.audioSystem = new AudioSystem();
        this.balanceConfig = new BalanceConfig();
    }
}
```

### Event-Driven Architecture
- **Event Bus System** - All systems communicate through events
- **State Management** - Clean separation of game state and presentation
- **Save System** - Persistent data for progression and unlocks
- **Analytics Integration** - Track player behavior and balance data

## Phase 1: Power-Up Foundation System

### Core Power-Up Framework
Implement a flexible power-up system that supports:

#### Base PowerUp Class
```javascript
class PowerUp {
    constructor(type, rarity, effects, duration, cooldown) {
        this.type = type;           // 'bomb', 'rainbow', 'lightning'
        this.rarity = rarity;       // common, rare, epic, legendary
        this.effects = effects;     // visual and gameplay effects
        this.duration = duration;   // how long effect lasts
        this.cooldown = cooldown;   // time between uses
    }
    
    activate(targetPosition, gameState) {
        // Override in subclasses
    }
    
    getVisualEffect() {
        // Return particle/animation data
    }
}
```

#### Essential Power-Ups to Implement
1. **Rainbow Bubble** (Tier 1 Priority)
   - Matches any color it touches
   - Creates cascading matches
   - 15% spawn rate
   - Distinctive rainbow shimmer effect
   - Victory sound and particle explosion

2. **Bomb Bubble** (Tier 1 Priority)
   - Destroys 3x3 grid area regardless of color
   - 10% spawn rate
   - Pulsing red glow with timer effect
   - Screen shake and explosive particles
   - Chain reaction with other bombs

3. **Lightning Bubble** (Tier 2 Priority)
   - Destroys entire row or column (player choice via UI)
   - 8% spawn rate
   - Electric arc visual effects
   - Crackling sound and blue particle trails
   - Momentary screen flash on activation

4. **Precision Aim** (Tier 2 Priority)
   - Extended trajectory with 5+ bounces shown
   - 12% spawn rate as temporary power-up
   - Cyan trajectory lines with distance markers
   - Slow-motion effect during aiming

### Power-Up Spawn System
- **Weighted Random Generation** - Rarer power-ups have lower spawn rates
- **Smart Distribution** - Ensure power-ups appear when most helpful
- **Combo Triggers** - Higher chance after achieving combos
- **Difficulty Scaling** - More powerful power-ups in harder levels

### Visual Integration
- **Distinct Appearances** - Each power-up instantly recognizable
- **Animation States** - Idle, charging, activating, cooldown
- **UI Indicators** - Show available power-ups and cooldowns
- **Preview System** - Show effect area before activation

## Phase 2: Progression & Reward Systems

### Experience and Leveling
```javascript
class ProgressionSystem {
    constructor() {
        this.playerLevel = 1;
        this.experience = 0;
        this.skillPoints = 0;
        this.unlockedFeatures = new Set();
    }
    
    awardExperience(source, amount) {
        // Track XP sources: perfect_shots, combos, level_completion
        // Apply multipliers for consecutive perfect games
        // Trigger level-up celebrations with particle effects
    }
}
```

#### XP Sources & Amounts
- **Perfect Shot** (bubble lands exactly where aimed): 50 XP
- **Bank Shot** (wall bounce before hitting): 75 XP  
- **Combo x3**: 100 XP, **Combo x4**: 200 XP, **Combo x5+**: 300 XP
- **Level Completion**: 500 XP + time bonus
- **First Try Clear**: 200 XP bonus
- **Power-Up Mastery** (effective use): 25 XP per use

### Skill Tree Implementation
Design branching upgrade paths:

#### Precision Branch
- **Aim Assist Level 1** - Show 2 bounce trajectory
- **Aim Assist Level 2** - Show 3 bounce trajectory  
- **Aim Assist Level 3** - Show 5 bounce trajectory + impact prediction
- **Perfect Shot Master** - 20% larger "perfect shot" detection area
- **Bank Shot Specialist** - 50% bonus XP for wall bounces

#### Power Branch  
- **Quick Charge** - Power charging 25% faster
- **Overcharge** - Can charge to 150% power for extra speed
- **Power Efficiency** - Power shots consume 20% less energy
- **Explosive Expert** - Bomb radius increased by 1 bubble
- **Lightning Rod** - Lightning power-ups destroy 2 rows/columns

#### Luck Branch
- **Lucky Shots** - 5% chance any bubble becomes rainbow
- **Power Magnet** - 15% higher power-up spawn rate
- **Cascade Master** - 25% bonus points for chain reactions
- **Second Chances** - 10% chance to recover from bad shots
- **Fortune Favors** - Daily bonus rewards 50% larger

### Achievement System
Implement comprehensive achievement tracking:

#### Skill Achievements
- **Sharpshooter** - Hit exact target 100 times
- **Ricochet Master** - Complete 50 levels using only bank shots
- **Combo King** - Achieve 10x combo
- **Perfectionist** - Complete 10 levels without missing
- **Power Player** - Use 100 power-ups effectively

#### Progress Achievements  
- **Bubble Buster** - Pop 10,000 bubbles
- **Level Legend** - Complete 100 levels
- **Streak Seeker** - Win 20 games in a row
- **Speed Demon** - Complete level in under 30 seconds
- **Patience Master** - Complete level with minimum possible shots

#### Secret Achievements
- **Rainbow Hunter** - Create 50 rainbow bubble matches
- **Demolition Expert** - Destroy 500 bubbles with bombs
- **Lightning Strike** - Clear entire board with single lightning
- **Zen Master** - Play for 1 hour straight in zen mode
- **Explorer** - Try every game mode available

## Phase 3: Daily Challenges & Events

### Daily Challenge System
```javascript
class DailyChallenge {
    constructor() {
        this.challenges = this.generateDailyChallenges();
        this.rewards = new RewardPool();
        this.streakCounter = 0;
    }
    
    generateDailyChallenges() {
        // Rotating challenge types with scaling difficulty
        return [
            new ScoreChallenge(targetScore, timeLimit),
            new EfficiencyChallenge(maxShots, minClears),
            new PowerUpChallenge(requiredPowerUps),
            new ComboChallenge(minComboSize, requiredCount),
            new SpeedChallenge(maxTime, levelsToComplete)
        ];
    }
}
```

#### Challenge Types
1. **Score Attack** - Reach target score within time limit
2. **Efficiency Test** - Clear board with minimum shots
3. **Power Master** - Complete using only specific power-ups
4. **Combo Creator** - Achieve specific combo sequences  
5. **Speed Run** - Complete levels under time pressure
6. **Precision Trial** - Hit exact targets with limited attempts
7. **Survival Mode** - Last as long as possible with increasing speed

#### Reward Structure
- **Daily Completion**: XP bonus, skill points, power-up tokens
- **Weekly Streaks**: Premium currency, exclusive cosmetics
- **Monthly Goals**: Unique cannon skins, special effects
- **Seasonal Events**: Limited-time power-ups, leaderboard rewards

### Event Calendar
- **Power-Up Week** - Double power-up spawn rates
- **Precision Weekend** - Extra XP for perfect shots
- **Combo Celebration** - Bonus rewards for large combos
- **Speed Trials** - Time-based leaderboard competitions
- **Community Goals** - Server-wide objectives with shared rewards

## Phase 4: Advanced Mechanics Integration

### Enhanced Bubble Types
Implement sophisticated bubble variants:

#### Obstacle Bubbles
```javascript
class ObstacleBubble extends Bubble {
    constructor(type) {
        super();
        this.obstacleType = type; // 'block', 'ice', 'chain', 'spike'
        this.durability = this.getTypeDurability();
        this.specialBehavior = this.getTypeBehavior();
    }
}
```

1. **Block Bubbles** - Indestructible barriers that change strategy
2. **Ice Bubbles** - Require 2 hits, crack visually on first hit
3. **Chain Bubbles** - Connected bubbles that must break together
4. **Spike Bubbles** - Pop immediately but don't create matches
5. **Mimic Bubbles** - Change color to match incoming shot

### Environmental Mechanics
```javascript
class EnvironmentSystem {
    constructor() {
        this.gravityWells = [];
        this.movingPlatforms = [];
        this.portalPairs = [];
        this.windZones = [];
    }
    
    updateEnvironmentalEffects(bubbles, deltaTime) {
        // Apply gravity wells, wind, platform movement
        // Update portal connections and teleportation
        // Handle any environmental state changes
    }
}
```

#### Dynamic Elements
- **Gravity Wells** - Attract or repel bubbles in radius
- **Moving Platforms** - Grid sections that shift position
- **Portal Bubbles** - Teleportation between linked points
- **Wind Zones** - Modify bubble trajectory during flight
- **Rotating Sections** - Grid areas that spin during gameplay

### Boss Battle Framework
```javascript
class BossBattle {
    constructor(bossType) {
        this.boss = new Boss(bossType);
        this.phases = this.createBossPhases();
        this.currentPhase = 0;
        this.specialAttacks = [];
    }
    
    updateBossLogic(gameState) {
        // Phase transitions based on health/progress
        // Special attack patterns and timing
        // Environmental changes during battle
        // Victory conditions and rewards
    }
}
```

## Implementation Guidelines

### Code Quality Standards
- **ES6+ Modern JavaScript** with clean class architecture
- **Comprehensive Error Handling** with graceful degradation
- **Performance Monitoring** with frame rate maintenance
- **Memory Management** with proper cleanup and pooling
- **Save System Integration** for all progression data

### Testing Strategy
- **Unit Tests** for core game logic and balance calculations
- **Integration Tests** for system interactions
- **Performance Tests** to ensure 60 FPS with all mechanics active
- **Player Testing** with analytics to track engagement metrics
- **Balance Testing** to ensure no mechanic becomes overpowered

### Balance Considerations
- **Power Progression Curves** - Linear XP requirements with exponential skill point costs
- **Power-Up Rarity Balance** - Common useful, rare game-changing, legendary spectacular
- **Difficulty Scaling** - Gentle learning curve with optional hardcore challenges
- **Reward Psychology** - Variable ratio reinforcement with guaranteed progress
- **Monetization Ethics** - Never pay-to-win, only convenience and cosmetics

### Performance Optimization
- **Object Pooling** for frequently created/destroyed objects
- **Efficient Particle Systems** with GPU-accelerated rendering
- **LOD (Level of Detail)** for complex visual effects
- **Memory Leak Prevention** with proper event cleanup
- **Lazy Loading** for non-essential features

### Analytics Integration
Track key metrics for continuous improvement:
- **Player Retention** - Daily, weekly, monthly active users
- **Feature Usage** - Which power-ups and mechanics are most popular
- **Difficulty Progression** - Where players get stuck or frustrated
- **Monetization Metrics** - What players value most
- **Performance Data** - Frame rates, load times, crash reports

## Success Metrics

### Technical Success
- ✅ 60 FPS maintained with all systems active
- ✅ Load times under 3 seconds on average hardware
- ✅ Memory usage stable over extended play sessions
- ✅ Zero crashes or game-breaking bugs
- ✅ Save/load functionality works 100% reliably

### Gameplay Success
- ✅ Players understand new mechanics without tutorials
- ✅ Each power-up feels distinct and valuable
- ✅ Progression system motivates continued play
- ✅ Daily challenges completed by 60%+ of active players
- ✅ Achievement unlock rate indicates appropriate difficulty

### Engagement Success
- ✅ Average session length increases by 40%
- ✅ Player retention improves across all timeframes
- ✅ Positive feedback on new mechanics exceeds 85%
- ✅ Daily active users show consistent growth
- ✅ Social features drive organic user acquisition

## Final Quality Checklist

Before considering the implementation complete:

### Core Systems
- [ ] All power-ups have distinct visual and gameplay identity
- [ ] Progression system provides consistent advancement
- [ ] Achievement system covers all play styles
- [ ] Daily challenges offer meaningful variety
- [ ] Save system preserves all player progress

### Polish & Juice
- [ ] Every mechanic has satisfying audio-visual feedback
- [ ] Animations are smooth and convey appropriate game feel
- [ ] UI clearly communicates all system states
- [ ] Particle effects enhance rather than distract
- [ ] Screen shake and juice feel impactful but not overwhelming

### Balance & Flow
- [ ] Learning curve is smooth from simple to complex
- [ ] No single strategy dominates all situations
- [ ] Random elements feel fair and exciting
- [ ] Skill expression is rewarded appropriately
- [ ] Player choices feel meaningful and impactful

Create a bubble shooter that evolves from a simple puzzle game into a deep, engaging experience that players will want to master and return to daily!