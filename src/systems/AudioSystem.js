/**
 * Audio System for managing game sounds
 * Handles background music and sound effects
 */
export class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.ambientGain = null;
        this.effectsGain = null;
        this.ambientSource = null;
        this.ambientBuffer = null;
        this.isInitialized = false;
        this.ambientVolume = 0.3; // Base ambient volume
        this.targetAmbientVolume = 0.3;
        this.volumeTransitionSpeed = 0.02;
        this.musicTracks = [
            'music/music_DeepTheme_Audio_Spring_Hazes_34.mp3',
            'music/music_zapsplat_action_break.mp3',
            'music/music_zapsplat_and_action_breakbeat.mp3',
            'music/music_zapsplat_lets_rock.mp3'
        ];
        this.currentTrackIndex = -1;
        this.musicEnabled = true;
        this.musicVolume = 0.3;
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes for volume control
            this.effectsGain = this.audioContext.createGain();
            this.effectsGain.gain.value = 0.7;
            this.effectsGain.connect(this.audioContext.destination);
            
            this.ambientGain = this.audioContext.createGain();
            this.ambientGain.gain.value = this.ambientVolume;
            this.ambientGain.connect(this.audioContext.destination);
            
            // Load sound effects
            await this.loadSounds();
            
            this.isInitialized = true;
            console.log('Audio system initialized');
        } catch (error) {
            console.error('Failed to initialize audio system:', error);
        }
    }
    
    async loadSounds() {
        // Define sound configurations
        const soundConfigs = {
            'plink': {
                frequency: 800,
                duration: 0.1,
                type: 'sine',
                envelope: { attack: 0.01, decay: 0.09 }
            },
            'crunchy_pop': {
                frequencies: [400, 600, 800, 1000],
                duration: 0.3,
                type: 'sawtooth',
                envelope: { attack: 0.02, decay: 0.28 }
            },
            'ambient_hum': {
                frequency: 110,
                duration: 2,
                type: 'sine',
                loop: true
            }
        };
        
        // Generate procedural sounds
        for (const [name, config] of Object.entries(soundConfigs)) {
            this.sounds[name] = await this.generateSound(config);
        }
    }
    
    async generateSound(config) {
        const sampleRate = this.audioContext.sampleRate;
        const duration = config.duration;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        if (config.frequencies) {
            // Multi-frequency sound (crunchy)
            for (let i = 0; i < length; i++) {
                let sample = 0;
                const t = i / sampleRate;
                
                config.frequencies.forEach(freq => {
                    sample += Math.sin(2 * Math.PI * freq * t) / config.frequencies.length;
                });
                
                // Apply envelope
                let envelope = 1;
                if (config.envelope) {
                    if (t < config.envelope.attack) {
                        envelope = t / config.envelope.attack;
                    } else {
                        envelope = 1 - ((t - config.envelope.attack) / config.envelope.decay);
                    }
                }
                
                // Add some noise for crunchiness
                sample += (Math.random() - 0.5) * 0.1;
                
                data[i] = sample * envelope * 0.3;
            }
        } else {
            // Single frequency sound
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                let sample;
                
                switch (config.type) {
                    case 'sine':
                        sample = Math.sin(2 * Math.PI * config.frequency * t);
                        break;
                    case 'square':
                        sample = Math.sign(Math.sin(2 * Math.PI * config.frequency * t));
                        break;
                    case 'sawtooth':
                        sample = 2 * ((config.frequency * t) % 1) - 1;
                        break;
                    default:
                        sample = Math.sin(2 * Math.PI * config.frequency * t);
                }
                
                // Apply envelope
                let envelope = 1;
                if (config.envelope) {
                    if (t < config.envelope.attack) {
                        envelope = t / config.envelope.attack;
                    } else {
                        envelope = 1 - ((t - config.envelope.attack) / config.envelope.decay);
                    }
                }
                
                data[i] = sample * envelope * 0.5;
            }
        }
        
        return { buffer, config };
    }
    
    playSound(soundName, volume = 1.0) {
        if (!this.isInitialized || !this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        const source = this.audioContext.createBufferSource();
        source.buffer = sound.buffer;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.effectsGain);
        
        source.start();
    }
    
    async startAmbientAudio() {
        if (!this.isInitialized || this.ambientSource || !this.musicEnabled) return;
        
        // Play a random music track
        await this.playRandomMusicTrack();
    }
    
    async playRandomMusicTrack() {
        if (!this.musicEnabled) return;
        
        // Select a random track different from the current one
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.musicTracks.length);
        } while (newIndex === this.currentTrackIndex && this.musicTracks.length > 1);
        
        this.currentTrackIndex = newIndex;
        const trackUrl = this.musicTracks[this.currentTrackIndex];
        
        try {
            // Fetch and decode the audio file
            const response = await fetch(trackUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = false; // Don't loop individual tracks
            
            // Connect to ambient gain for volume control
            source.connect(this.ambientGain);
            
            // When track ends, play another random track
            source.onended = () => {
                this.ambientSource = null;
                if (this.musicEnabled) {
                    this.playRandomMusicTrack();
                }
            };
            
            // Store reference and start playback
            this.ambientSource = source;
            source.start();
            
            console.log(`Playing music track: ${trackUrl}`);
        } catch (error) {
            console.error('Failed to load music track:', error);
            // Try another track after a delay
            setTimeout(() => {
                if (this.musicEnabled && !this.ambientSource) {
                    this.playRandomMusicTrack();
                }
            }, 1000);
        }
    }
    
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        
        if (!this.musicEnabled) {
            this.stopAmbientAudio();
        } else if (this.isInitialized) {
            if (!this.ambientSource) {
                this.startAmbientAudio();
            }
        }
        
        return this.musicEnabled;
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.ambientVolume = this.musicVolume;
        this.targetAmbientVolume = this.musicVolume;
        
        if (this.ambientGain) {
            this.ambientGain.gain.value = this.musicVolume;
        }
    }
    
    createNoiseBuffer() {
        const bufferSize = 2 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        return buffer;
    }
    
    updateAmbientVolume(swellFactor) {
        // Apply swell factor to the user-set music volume
        // swellFactor is between 0 and 1, where 0 is normal and 1 is maximum swell
        const baseVolume = this.musicVolume;
        const maxVolume = Math.min(this.musicVolume * 2, 1); // Don't exceed 100%
        this.targetAmbientVolume = baseVolume + (maxVolume - baseVolume) * swellFactor;
    }
    
    update() {
        if (!this.isInitialized || !this.ambientGain) return;
        
        // Smoothly transition ambient volume
        const currentVolume = this.ambientGain.gain.value;
        const diff = this.targetAmbientVolume - currentVolume;
        
        if (Math.abs(diff) > 0.001) {
            this.ambientGain.gain.value += diff * this.volumeTransitionSpeed;
        }
    }
    
    stopAmbientAudio() {
        if (this.ambientSource) {
            // Handle both procedural and external audio sources
            if (this.ambientSource.stop) {
                this.ambientSource.stop();
            } else if (this.ambientSource.oscillators) {
                // Procedural audio with multiple oscillators
                this.ambientSource.oscillators.forEach(osc => {
                    if (osc && osc.stop) osc.stop();
                });
            }
            this.ambientSource = null;
        }
    }
}