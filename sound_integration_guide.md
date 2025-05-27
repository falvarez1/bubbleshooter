# Sound Integration Guide for Premium Bubble Shooter

## Sound Effects List

You'll need to procure the following royalty-free sound effects:

### 1. Bubble Actions (6 sounds)
- **bubble-shoot.wav** - When player releases to shoot a bubble (whoosh/pop sound)
- **bubble-bounce.wav** - When bubble hits a wall (soft bounce/tick)
- **bubble-attach.wav** - When bubble snaps to grid position (satisfying click/snap)
- **bubble-pop-single.wav** - When a single bubble is destroyed (soft pop)
- **bubble-pop-multiple.wav** - When 3+ bubbles match and pop (bigger, more satisfying pop)
- **bubble-float.wav** - When floating bubbles drift off screen (airy/floating sound)

### 2. Power-Up Sounds (7 sounds)
- **rainbow-activate.wav** - Shimmering magical sound for rainbow bubble
- **bomb-explode.wav** - Big explosion with bass for bomb bubble
- **lightning-strike.wav** - Electric zap/thunder sound for lightning
- **precision-activate.wav** - High-tech targeting sound for precision aim
- **precision-tick.wav** - Countdown beep/tick for precision timer
- **color-splash.wav** - Liquid splash/wave sound for color splash
- **powerup-spawn.wav** - When power-up appears on grid (sparkle/chime)

### 3. UI/Feedback Sounds (4 sounds)
- **ui-hover.wav** - Subtle hover over interactive elements
- **ui-click.wav** - UI button press (soft click)
- **charge-power.wav** - Building up power for charged shot (rising tone)
- **trajectory-woosh.wav** - Subtle woosh when aiming (very quiet)

### 4. Combo/Scoring (5 sounds)
- **combo-2x.wav** - First combo level (ascending chime)
- **combo-3x.wav** - Second combo level (higher pitched)
- **combo-4x.wav** - Higher combo levels (triumphant sound)
- **score-tick.wav** - Points counting up (cash register tick)
- **bonus-points.wav** - Special score events (celebration sound)

### 5. Game State (6 sounds)
- **game-start.wav** - New game begins (uplifting melody)
- **level-complete.wav** - All bubbles cleared (victory fanfare)
- **game-over.wav** - Lost the game (descending tones)
- **warning.wav** - Bubbles approaching danger line (alert sound)
- **pause.wav** - Game pause (soft swoosh down)
- **resume.wav** - Game unpause (soft swoosh up)

### 6. Particle/Effect Sounds (3 sounds)
- **particle-sparkle.wav** - For visual particle effects (twinkling)
- **screen-shake.wav** - Rumble for bomb explosions (low rumble)
- **electric-arc.wav** - Crackling for lightning effects (electric crackle)

## Sound File Requirements

1. **Format**: WAV or MP3 (WAV preferred for quality)
2. **Sample Rate**: 44.1kHz or 48kHz
3. **Bit Depth**: 16-bit or 24-bit
4. **Length**: Keep sounds short (0.1-2 seconds for effects, up to 5 seconds for fanfares)
5. **Volume**: Normalize to -12dB to prevent clipping

## Recommended Sound Sources

- **Freesound.org** - Community-driven sound library
- **Zapsplat.com** - Free sounds with account
- **OpenGameArt.org** - Game-specific sounds
- **Mixkit.co** - Royalty-free sound effects
- **Soundbible.com** - Public domain sounds

## Integration Instructions

The sound system is already implemented in the game. To activate it:

1. Place all sound files in the `/sounds/` directory
2. The game will automatically load and play sounds when the files are present
3. Missing sound files will be logged to console but won't break the game

## Sound System Features

- **Volume Control**: Master volume, category volumes (effects, music, UI)
- **Sound Pooling**: Prevents audio cutting when same sound plays rapidly
- **Pitch Variation**: Automatic variation for repeated sounds
- **Async Loading**: Critical sounds load first, others load in background
- **Error Handling**: Graceful fallback if sounds fail to load

## Testing Sounds

Once you've added the sound files, test each sound by:
1. Opening the browser console
2. Running: `soundManager.play('soundName')`
3. Example: `soundManager.play('bubbleShoot')`

## Volume Tuning

The system has pre-configured volume levels for each sound. You can adjust them in the `soundDefinitions` object in the code if needed after testing with your actual sound files.