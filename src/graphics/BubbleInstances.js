import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Instanced Bubble Renderer
 * Uses GPU instancing to render many bubbles with a single draw call
 */
export class BubbleInstances {
    constructor(scene, maxBubbles = 200) {
        this.scene = scene;
        this.maxBubbles = maxBubbles;
        
        // Bubble tracking and management
        this.bubbleMap = new Map(); // bubbleId -> { index, type, bubble }
        this.availableIndices = []; // Pool of reusable indices
        this.nextIndex = 0;
        this.activeBubbles = new Set();
        
        // Initialize available indices pool
        for (let i = 0; i < maxBubbles; i++) {
            this.availableIndices.push(i);
        }
        
        // Configurable special effects
        this.effects = {
            // Core effects
            enablePBR: true,              // Physically based rendering
            enableTransmission: true,     // Glass-like transparency
            enableClearcoat: true,        // Glossy outer layer
            enableSheen: true,            // Soft fabric-like highlights
            enableEnvironmentMap: true,   // Environment reflections
            
            // Animation effects
            enablePulse: true,            // Subtle size pulsing
            enableColorShift: true,       // Chromatic aberration
            enableDistortion: true,       // Heat/water distortion
            enableSparkles: true,         // Sparkle particles inside
            enableRainbow: true,          // Iridescent rainbow effect
            
            // Advanced effects
            enableSubsurface: true,       // Subsurface scattering
            enableCaustics: true,         // Light caustics patterns
            enableFoam: true,             // Soap foam texture
            enableWobble: true,           // Vertex wobble animation
            enableHolographic: false,     // Holographic effect (performance heavy)
            
            // Performance settings
            highQualityNormals: true,     // Use high-quality normal calculations
            adaptiveQuality: true,         // Adjust quality based on performance
            enableGlowMesh: false          // Enable glow mesh for enhanced visuals
        };
        
        // Create shared geometry (high quality)
        this.geometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS, 3);
        
        // Create instanced mesh
        this.instancedMesh = new THREE.InstancedMesh(
            this.geometry,
            this.createBubbleMaterial(),
            maxBubbles
        );
        
        // Set instance count to maximum but all instances start invisible (scale = 0)
        this.instancedMesh.count = maxBubbles;
        this.instancedMesh.frustumCulled = false; // Prevent frustum culling issues
        this.instancedMesh.renderOrder = 1; // Render after bloom objects
        
        // Create glow effect mesh (slightly larger, back-side rendering)
        this.glowGeometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS * 1.05, 2);
        this.glowMesh = new THREE.InstancedMesh(
            this.glowGeometry,
            this.createGlowMaterial(),
            maxBubbles
        );
        this.glowMesh.count = maxBubbles;
        this.glowMesh.frustumCulled = false;
        this.glowMesh.renderOrder = 1;
                       
        // Set up instance attributes
        this.setupInstanceAttributes();
        
        scene.add(this.instancedMesh);

        // Always add glow mesh to scene for now (will optimize later)
        scene.add(this.glowMesh);
        
        console.log('BubbleInstances initialized:', {
            maxBubbles: this.maxBubbles,
            instancedMeshCount: this.instancedMesh.count,
            glowMeshCount: this.glowMesh.count,
            hasInstanceAttributes: !!this.instancedMesh.geometry.getAttribute('instanceColor')
        });
    }
    
    createBubbleMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                lightPosition: { value: new THREE.Vector3(5, 5, 5) },
                lightPosition2: { value: new THREE.Vector3(-5, 5, 5) },
                lightPosition3: { value: new THREE.Vector3(0, -5, 5) },
                ambientLight: { value: 0.3 },
                envMapIntensity: { value: 1.5 },
                roughness: { value: 0.1 },
                metalness: { value: 0.1 },
                clearcoat: { value: 1.0 },
                clearcoatRoughness: { value: 0.0 },
                ior: { value: 1.5 },
                transmission: { value: 0.5 },
                thickness: { value: 0.5 },
                sheenIntensity: { value: 1.0 },
                
                // Effect toggles
                enablePBR: { value: this.effects.enablePBR ? 1.0 : 0.0 },
                enableTransmission: { value: this.effects.enableTransmission ? 1.0 : 0.0 },
                enableClearcoat: { value: this.effects.enableClearcoat ? 1.0 : 0.0 },
                enableSheen: { value: this.effects.enableSheen ? 1.0 : 0.0 },
                enableEnvironmentMap: { value: this.effects.enableEnvironmentMap ? 1.0 : 0.0 },
                enablePulse: { value: this.effects.enablePulse ? 1.0 : 0.0 },
                enableColorShift: { value: this.effects.enableColorShift ? 1.0 : 0.0 },
                enableDistortion: { value: this.effects.enableDistortion ? 1.0 : 0.0 },
                enableSparkles: { value: this.effects.enableSparkles ? 1.0 : 0.0 },
                enableRainbow: { value: this.effects.enableRainbow ? 1.0 : 0.0 },
                enableSubsurface: { value: this.effects.enableSubsurface ? 1.0 : 0.0 },
                enableCaustics: { value: this.effects.enableCaustics ? 1.0 : 0.0 },
                enableFoam: { value: this.effects.enableFoam ? 1.0 : 0.0 },
                enableWobble: { value: this.effects.enableWobble ? 1.0 : 0.0 },
                enableHolographic: { value: this.effects.enableHolographic ? 1.0 : 0.0 }
            },
            vertexShader: `
                attribute vec3 instanceColor;
                attribute float instanceScale;
                attribute float instanceGlow;
                attribute vec3 instanceVibration; // Sympathy vibration offset
                attribute float instanceSympathyGlow; // Sympathy glow intensity
                attribute float instanceSympathyScale; // Sympathy scale multiplier
                
                uniform float time;
                uniform float enableWobble;
                uniform float enablePulse;
                
                varying vec3 vColor;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying float vGlow;
                varying float vSympathyGlow;
                varying vec3 vReflect;
                varying vec3 vRefract;
                varying vec2 vUv;
                varying vec3 vTangent;
                varying vec3 vBitangent;
                
                void main() {
                    vColor = instanceColor;
                    vGlow = instanceGlow;
                    vSympathyGlow = instanceSympathyGlow;
                    vUv = uv;
                    
                    // Early exit for hidden instances - move them far away and cull
                    if (instanceScale < 0.01) {
                        gl_Position = vec4(0.0, 0.0, -10000.0, 1.0);
                        return;
                    }
                    
                    // Wobble effect
                    vec3 wobbleOffset = vec3(0.0);
                    if (enableWobble > 0.5) {
                        float wobbleAmount = 0.02;
                        wobbleOffset = normal * sin(time * 2.0 + position.y * 10.0) * wobbleAmount;
                    }
                    
                    // Pulse effect
                    float pulseScale = 1.0;
                    if (enablePulse > 0.5) {
                        pulseScale = 1.0 + sin(time * 3.0 + float(gl_InstanceID) * 0.5) * 0.03;
                    }
                    
                    // Apply sympathy scale
                    float sympathyScale = max(1.0, instanceSympathyScale);
                    
                    // Transform vertex position with sympathy effects
                    // CRITICAL: Apply instanceScale AFTER matrix transformation to ensure proper hiding
                    vec3 baseTransformed = (position + wobbleOffset) * pulseScale * sympathyScale;
                    vec4 worldPosition = instanceMatrix * vec4(baseTransformed, 1.0);
                    
                    // Add sympathy vibration offset
                    worldPosition.xyz += instanceVibration;
                    
                    worldPosition.xyz *= instanceScale; // Apply scale to final world position
                    vWorldPosition = worldPosition.xyz;
                    
                    // Transform normal properly
                    mat3 normalMatrix = transpose(inverse(mat3(instanceMatrix)));
                    vNormal = normalize(normalMatrix * normal);
                    
                    // Calculate tangent and bitangent for advanced effects
                    vec3 tangent = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
                    vTangent = normalize(tangent - dot(tangent, vNormal) * vNormal);
                    vBitangent = cross(vNormal, vTangent);
                    
                    vec4 mvPosition = modelViewMatrix * worldPosition;
                    vViewPosition = -mvPosition.xyz;
                    
                    // Calculate reflection and refraction vectors
                    vec3 worldNormal = normalize(mat3(modelMatrix) * vNormal);
                    vec3 viewVector = normalize(cameraPosition - vWorldPosition);
                    vReflect = reflect(-viewVector, worldNormal);
                    vRefract = refract(-viewVector, worldNormal, 0.66); // 1.0 / 1.5 (air to glass)
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 lightPosition;
                uniform vec3 lightPosition2;
                uniform vec3 lightPosition3;
                uniform float ambientLight;
                uniform float envMapIntensity;
                uniform float roughness;
                uniform float metalness;
                uniform float clearcoat;
                uniform float clearcoatRoughness;
                uniform float ior;
                uniform float transmission;
                uniform float thickness;
                uniform float sheenIntensity;
                
                // Effect uniforms
                uniform float enablePBR;
                uniform float enableTransmission;
                uniform float enableClearcoat;
                uniform float enableSheen;
                uniform float enableEnvironmentMap;
                uniform float enablePulse;
                uniform float enableColorShift;
                uniform float enableDistortion;
                uniform float enableSparkles;
                uniform float enableRainbow;
                uniform float enableSubsurface;
                uniform float enableCaustics;
                uniform float enableFoam;
                uniform float enableWobble;
                uniform float enableHolographic;
                
                varying vec3 vColor;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying float vGlow;
                varying float vSympathyGlow;
                varying vec3 vReflect;
                varying vec3 vRefract;
                varying vec2 vUv;
                varying vec3 vTangent;
                varying vec3 vBitangent;
                
                // Noise function for effects
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }
                
                // Improved BRDF functions
                float D_GGX(float roughness, float NoH) {
                    float a = roughness * roughness;
                    float a2 = a * a;
                    float NoH2 = NoH * NoH;
                    float b = (NoH2 * (a2 - 1.0) + 1.0);
                    return a2 / (3.14159265 * b * b);
                }
                
                float G_SchlickGGX(float NoV, float roughness) {
                    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
                    return NoV / (NoV * (1.0 - k) + k);
                }
                
                vec3 F_Schlick(float cosTheta, vec3 F0) {
                    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
                }
                
                vec3 BRDF(vec3 L, vec3 V, vec3 N, vec3 albedo, float roughness, float metallic) {
                    vec3 H = normalize(L + V);
                    float NoV = max(dot(N, V), 0.0);
                    float NoL = max(dot(N, L), 0.0);
                    float NoH = max(dot(N, H), 0.0);
                    float VoH = max(dot(V, H), 0.0);
                    
                    vec3 F0 = mix(vec3(0.04), albedo, metallic);
                    
                    float D = D_GGX(roughness, NoH);
                    float G = G_SchlickGGX(NoV, roughness) * G_SchlickGGX(NoL, roughness);
                    vec3 F = F_Schlick(VoH, F0);
                    
                    vec3 specular = (D * G * F) / (4.0 * NoV * NoL + 0.001);
                    vec3 diffuse = (1.0 - F) * (1.0 - metallic) * albedo / 3.14159265;
                    
                    return (diffuse + specular) * NoL;
                }
                
                // Rainbow/iridescent effect
                vec3 iridescence(float angle, float thickness) {
                    float opd = 2.0 * thickness * 1.5 * cos(angle);
                    vec3 phase = vec3(opd) / vec3(650.0, 510.0, 475.0) * 6.28318530718;
                    return sin(phase) * 0.5 + 0.5;
                }
                
                // Subsurface scattering approximation
                vec3 subsurfaceScattering(vec3 L, vec3 V, vec3 N, vec3 color, float thickness) {
                    float NdotL = dot(N, L);
                    float subsurface = pow(max(0.0, -NdotL), 2.0) * thickness;
                    return color * subsurface * 0.5;
                }
                
                void main() {
                    // Discard fragments from hidden instances
                    if (length(vWorldPosition) < 0.01) {
                        discard;
                    }
                    
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 baseColor = vColor;
                    
                    // Color shift effect
                    if (enableColorShift > 0.5) {
                        float shift = sin(time * 2.0 + vWorldPosition.y * 5.0) * 0.1;
                        baseColor = vec3(
                            baseColor.r * (1.0 + shift),
                            baseColor.g * (1.0 - shift * 0.5),
                            baseColor.b * (1.0 + shift * 0.5)
                        );
                    }
                    
                    // Distortion effect on normal
                    if (enableDistortion > 0.5) {
                        vec2 distortUV = vUv * 10.0 + time * 0.5;
                        float distort = noise(distortUV) * 0.1;
                        normal = normalize(normal + vec3(distort, distort, 0.0));
                    }
                    
                    // Multi-point lighting setup
                    vec3 lightDir1 = normalize(lightPosition - vWorldPosition);
                    vec3 lightDir2 = normalize(lightPosition2 - vWorldPosition);
                    vec3 lightDir3 = normalize(lightPosition3 - vWorldPosition);
                    
                    // PBR lighting calculations
                    vec3 lighting = vec3(0.0);
                    if (enablePBR > 0.5) {
                        lighting += BRDF(lightDir1, viewDir, normal, baseColor, roughness, metalness) * 1.0;
                        lighting += BRDF(lightDir2, viewDir, normal, baseColor, roughness, metalness) * 0.7;
                        lighting += BRDF(lightDir3, viewDir, normal, baseColor, roughness, metalness) * 0.5;
                    } else {
                        // Simple lighting fallback
                        float diff1 = max(dot(normal, lightDir1), 0.0);
                        float diff2 = max(dot(normal, lightDir2), 0.0);
                        lighting = baseColor * (diff1 + diff2 * 0.5);
                    }
                    
                    // Enhanced ambient lighting
                    vec3 ambient = baseColor * ambientLight;
                    if (enablePulse > 0.5) {
                        ambient *= (1.0 + 0.2 * sin(time * 0.5));
                    }
                    
                    // Fresnel effect
                    float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
                    float fresnelPower = pow(fresnel, 2.0);
                    
                    // Rainbow/iridescent effect
                    if (enableRainbow > 0.5) {
                        vec3 iridColor = iridescence(acos(dot(viewDir, normal)), 500.0);
                        baseColor = mix(baseColor, iridColor, fresnelPower * 0.5);
                    }
                    
                    // Glass-like transmission effect
                    vec3 transmissionColor = vec3(0.0);
                    if (enableTransmission > 0.5) {
                        transmissionColor = baseColor * transmission * (1.0 - fresnelPower);
                    }
                    
                    // Subsurface scattering
                    vec3 subsurface = vec3(0.0);
                    if (enableSubsurface > 0.5) {
                        subsurface += subsurfaceScattering(lightDir1, viewDir, normal, baseColor, thickness);
                        subsurface += subsurfaceScattering(lightDir2, viewDir, normal, baseColor, thickness) * 0.7;
                    }
                    
                    // Clearcoat layer
                    vec3 clearcoatSpecular = vec3(0.0);
                    if (enableClearcoat > 0.5) {
                        vec3 clearcoatNormal = normal;
                        float clearcoatNoV = max(dot(clearcoatNormal, viewDir), 0.0);
                        vec3 clearcoatF = F_Schlick(clearcoatNoV, vec3(0.04));
                        
                        vec3 H1 = normalize(lightDir1 + viewDir);
                        float clearcoatNoH1 = max(dot(clearcoatNormal, H1), 0.0);
                        clearcoatSpecular += D_GGX(clearcoatRoughness, clearcoatNoH1) * clearcoatF * max(dot(clearcoatNormal, lightDir1), 0.0);
                    }
                    
                    // Sheen effect
                    vec3 sheenColor = vec3(0.0);
                    if (enableSheen > 0.5) {
                        sheenColor = baseColor * sheenIntensity * pow(fresnel, 3.0);
                    }
                    
                    // Sparkles effect
                    vec3 sparkles = vec3(0.0);
                    if (enableSparkles > 0.5) {
                        vec2 sparkleUV = vUv * 30.0;
                        float sparkleNoise = noise(sparkleUV + time * 2.0);
                        if (sparkleNoise > 0.85) {
                            sparkles = vec3(1.0) * pow((sparkleNoise - 0.85) / 0.15, 2.0) * 2.0;
                        }
                    }
                    
                    // Caustics effect
                    vec3 caustics = vec3(0.0);
                    if (enableCaustics > 0.5) {
                        vec2 causticUV = vWorldPosition.xy * 2.0 + time * 0.1;
                        float causticPattern = noise(causticUV) * noise(causticUV * 2.0 + 0.5);
                        caustics = vec3(causticPattern) * 0.3 * max(dot(normal, lightDir1), 0.0);
                    }
                    
                    // Foam texture effect
                    vec3 foam = vec3(0.0);
                    if (enableFoam > 0.5) {
                        vec2 foamUV = vUv * 20.0 + time * 0.05;
                        float foamPattern = smoothstep(0.4, 0.6, noise(foamUV));
                        foam = vec3(foamPattern) * 0.2 * fresnelPower;
                    }
                    
                    // Holographic effect
                    vec3 holographic = vec3(0.0);
                    if (enableHolographic > 0.5) {
                        float holo1 = sin(vWorldPosition.y * 50.0 + time * 2.0) * 0.5 + 0.5;
                        float holo2 = sin(vWorldPosition.x * 50.0 - time * 2.0) * 0.5 + 0.5;
                        vec3 holoColor = vec3(holo1, holo2, 1.0 - holo1 * holo2);
                        holographic = holoColor * fresnelPower * 0.5;
                    }
                    
                    // Environment reflection
                    vec3 reflection = vec3(0.0);
                    if (enableEnvironmentMap > 0.5) {
                        vec3 envColor = mix(vec3(0.1, 0.15, 0.3), vec3(0.3, 0.4, 0.6), vReflect.y * 0.5 + 0.5);
                        reflection = envColor * envMapIntensity * fresnelPower;
                    }
                    
                    // Emissive glow
                    // Add sympathy glow to emissive
                    float totalGlow = vGlow + vSympathyGlow * 2.0; // Sympathy glow is more intense
                    vec3 emissive = baseColor * 0.2 * (1.0 + totalGlow);
                    
                    // Add white hot core for high sympathy glow
                    if (vSympathyGlow > 0.5) {
                        vec3 hotCore = vec3(1.0) * pow(vSympathyGlow, 2.0);
                        emissive = mix(emissive, hotCore, vSympathyGlow);
                    }
                    
                    // Power-up glow effect
                    vec3 powerUpGlow = baseColor * vGlow * (0.5 + 0.3 * sin(time * 3.0));
                    
                    // Combine all lighting components
                    vec3 finalColor = ambient + lighting + transmissionColor + subsurface +
                                     clearcoat * clearcoatSpecular + sheenColor + sparkles +
                                     caustics + foam + holographic + reflection + emissive + powerUpGlow;
                    
                    // Tone mapping for better color range
                    finalColor = finalColor / (finalColor + vec3(1.0));
                    finalColor = pow(finalColor, vec3(1.0 / 2.2)); // Gamma correction
                    
                    // Glass-like transparency with fresnel
                    float alpha = mix(0.7, 0.95, fresnelPower);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true
        });
    }
    
    createGlowMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute vec3 instanceColor;
                attribute float instanceScale;
                attribute float instanceGlow;
                
                varying vec3 vColor;
                varying float vGlow;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vColor = instanceColor;
                    vGlow = instanceGlow;
                    
                    // Early exit for hidden instances
                    if (instanceScale < 0.01) {
                        gl_Position = vec4(0.0, 0.0, -10000.0, 1.0);
                        return;
                    }
                    
                    // Apply scale AFTER matrix transformation for proper hiding
                    vec3 baseTransformed = position * 1.08;
                    vec4 worldPosition = instanceMatrix * vec4(baseTransformed, 1.0);
                    worldPosition.xyz *= instanceScale;
                    vec4 mvPosition = modelViewMatrix * worldPosition;
                    
                    // Pass normal and view position for better glow
                    mat3 normalMatrix = transpose(inverse(mat3(instanceMatrix)));
                    vNormal = normalize(normalMatrix * normal);
                    vViewPosition = -mvPosition.xyz;
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec3 vColor;
                varying float vGlow;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    
                    // Fresnel-based glow intensity
                    float fresnel = 1.0 - max(dot(viewDir, -normal), 0.0);
                    fresnel = pow(fresnel, 1.5);
                    
                    // Animated glow pulse
                    float pulse = 0.5 + 0.5 * sin(time * 2.0);
                    
                    // Base intensity with fresnel enhancement
                    float intensity = 0.15 + fresnel * 0.2 + vGlow * pulse * 0.1;
                    
                    // Color with slight brightness boost
                    vec3 glowColor = vColor * (1.0 + fresnel * 0.5);
                    
                    gl_FragColor = vec4(glowColor, intensity);
                }
            `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }
    
    setupInstanceAttributes() {
        // Set up attributes for main bubble mesh
        const colors = new Float32Array(this.maxBubbles * 3);
        this.instancedMesh.geometry.setAttribute('instanceColor', 
            new THREE.InstancedBufferAttribute(colors, 3));
        
        const scales = new Float32Array(this.maxBubbles);
        scales.fill(0.0); // Start all instances as invisible!
        this.instancedMesh.geometry.setAttribute('instanceScale', 
            new THREE.InstancedBufferAttribute(scales, 1));
        
        // Initialize all instance matrices to be far away
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.makeScale(0.001, 0.001, 0.001);
        hiddenMatrix.setPosition(0, -10000, -10000);
        for (let i = 0; i < this.maxBubbles; i++) {
            this.instancedMesh.setMatrixAt(i, hiddenMatrix);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        
        const glows = new Float32Array(this.maxBubbles);
        this.instancedMesh.geometry.setAttribute('instanceGlow', 
            new THREE.InstancedBufferAttribute(glows, 1));
        
        // Sympathy effect attributes
        const vibrations = new Float32Array(this.maxBubbles * 3);
        this.instancedMesh.geometry.setAttribute('instanceVibration',
            new THREE.InstancedBufferAttribute(vibrations, 3));
        
        const sympathyGlows = new Float32Array(this.maxBubbles);
        this.instancedMesh.geometry.setAttribute('instanceSympathyGlow',
            new THREE.InstancedBufferAttribute(sympathyGlows, 1));
        
        const sympathyScales = new Float32Array(this.maxBubbles);
        sympathyScales.fill(1.0); // Default to normal scale
        this.instancedMesh.geometry.setAttribute('instanceSympathyScale',
            new THREE.InstancedBufferAttribute(sympathyScales, 1));
        
        // Set up attributes for glow mesh (create separate arrays, not shared)
        const glowColors = new Float32Array(this.maxBubbles * 3);
        this.glowMesh.geometry.setAttribute('instanceColor', 
            new THREE.InstancedBufferAttribute(glowColors, 3));
            
        const glowScales = new Float32Array(this.maxBubbles);
        glowScales.fill(0.0); // Start all glow instances as invisible!
        this.glowMesh.geometry.setAttribute('instanceScale', 
            new THREE.InstancedBufferAttribute(glowScales, 1));
            
        const glowGlows = new Float32Array(this.maxBubbles);
        this.glowMesh.geometry.setAttribute('instanceGlow', 
            new THREE.InstancedBufferAttribute(glowGlows, 1));
        
        // Initialize all glow instance matrices to be far away
        for (let i = 0; i < this.maxBubbles; i++) {
            this.glowMesh.setMatrixAt(i, hiddenMatrix);
        }
        this.glowMesh.instanceMatrix.needsUpdate = true;
    }
    
    addBubble(bubble, type = 'grid') {
        // Don't add destroyed bubbles
        if (bubble.isDestroyed) {
            console.warn(`Attempted to add destroyed bubble to instances`);
            return -1;
        }
        
        // Generate unique ID if bubble doesn't have one
        if (!bubble.id) {
            bubble.id = `bubble_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Get available instance index
        if (this.availableIndices.length === 0) {
            console.warn('Maximum bubble instances reached');
            return null;
        }
        
        // Use shift() to take from the beginning of the sorted array for consistency
        const instanceIndex = this.availableIndices.shift();
        
        // Store bubble mapping
        this.bubbleMap.set(bubble.id, {
            index: instanceIndex,
            type: type,
            bubble: bubble
        });
        this.activeBubbles.add(bubble);
        
        // Set transform matrix for both meshes
        const matrix = new THREE.Matrix4();
        matrix.setPosition(bubble.position);
        
        // Make sure the matrix is valid
        if (isNaN(bubble.position.x) || isNaN(bubble.position.y) || isNaN(bubble.position.z)) {
            console.error('Invalid bubble position:', bubble.position);
            return null;
        }
        
        this.instancedMesh.setMatrixAt(instanceIndex, matrix);
        if (this.glowMesh) {
            this.glowMesh.setMatrixAt(instanceIndex, matrix);
        }
        
        // Matrix set successfully for instance
        
        // Set color on both meshes
        const color = new THREE.Color(bubble.color);
        const colorAttr = this.instancedMesh.geometry.getAttribute('instanceColor');
        if (colorAttr) {
            colorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
            colorAttr.needsUpdate = true;
        }
        
        if (this.glowMesh) {
            const glowColorAttr = this.glowMesh.geometry.getAttribute('instanceColor');
            if (glowColorAttr) {
                glowColorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
                glowColorAttr.needsUpdate = true;
            }
        }
        
        // Set scale on both meshes - CRITICAL for visibility
        const scaleAttr = this.instancedMesh.geometry.getAttribute('instanceScale');
        if (scaleAttr) {
            scaleAttr.setX(instanceIndex, 1.0);
            scaleAttr.needsUpdate = true;
        } else {
            console.error('Failed to set instanceScale - attribute not found!');
        }
        
        if (this.glowMesh) {
            const glowScaleAttr = this.glowMesh.geometry.getAttribute('instanceScale');
            if (glowScaleAttr) {
                glowScaleAttr.setX(instanceIndex, 1.0);
                glowScaleAttr.needsUpdate = true;
            }
        }
        
        // Set glow on both meshes
        const glowValue = bubble.isPowerUp ? 1.0 : 0.0;
        const glowAttr = this.instancedMesh.geometry.getAttribute('instanceGlow');
        if (glowAttr) {
            glowAttr.setX(instanceIndex, glowValue);
            glowAttr.needsUpdate = true;
        }
        
        if (this.glowMesh) {
            const glowGlowAttr = this.glowMesh.geometry.getAttribute('instanceGlow');
            if (glowGlowAttr) {
                glowGlowAttr.setX(instanceIndex, glowValue);
                glowGlowAttr.needsUpdate = true;
            }
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.glowMesh) {
            this.glowMesh.instanceMatrix.needsUpdate = true;
        }
        
        // Instance count is already set to maxBubbles - no need to change it
        // All unused instances have scale=0 so they're invisible
        
        // // show the log only if debug mode is enabled
        // if (CONFIG.DEBUG_MODE) {
        //     console.log(`Added ${type} bubble with ID ${bubble.id} at instance ${instanceIndex}`, {
        //         position: bubble.position,
        //         activeCount: this.activeBubbles.size,
        //         availableIndices: this.availableIndices.length
        //     });
        // }

        return instanceIndex;
    }
    
    updateBubble(bubble) {
        // Skip updating destroyed bubbles
        if (bubble.isDestroyed) return;
        
        const mapping = this.bubbleMap.get(bubble.id);
        if (!mapping) return;
        
        const instanceIndex = mapping.index;
        
        // Debug: Log shooting bubble updates (disabled)
        // if (mapping.type === 'shooting') {
        //     console.log(`Updating shooting bubble at position:`, bubble.position);
        // }
        
        // Update transform
        const matrix = new THREE.Matrix4();
        // Apply wave offset to position if Mexican wave is active
        const position = bubble.position.clone();
        if (bubble.waveOffset) {
            position.y += bubble.waveOffset;
        }
        matrix.setPosition(position);
        if (bubble.mesh) {
            matrix.makeRotationFromEuler(bubble.mesh.rotation);
            matrix.setPosition(position);
        }
        this.instancedMesh.setMatrixAt(instanceIndex, matrix);
        if (this.glowMesh) {
            this.glowMesh.setMatrixAt(instanceIndex, matrix);
        }
        
        // Update color for rainbow bubbles
        if (bubble.isPowerUp && bubble.powerUpType === 'rainbow' && !bubble.isMoving) {
            // Calculate rainbow color based on time
            const time = Date.now() * 0.001;
            const hue = (time * 0.3) % 1; // Faster cycling speed, synchronized with trajectory
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            
            const colorAttr = this.instancedMesh.geometry.getAttribute('instanceColor');
            if (colorAttr) {
                colorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
                colorAttr.needsUpdate = true;
            }
            
            if (this.glowMesh) {
                const glowColorAttr = this.glowMesh.geometry.getAttribute('instanceColor');
                if (glowColorAttr) {
                    glowColorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
                    glowColorAttr.needsUpdate = true;
                }
            }
        }
        
        // Update scale for animations on both meshes
        const scaleAttr = this.instancedMesh.geometry.getAttribute('instanceScale');
        if (scaleAttr) {
            // Use connectionScale for connection animation, impactScale for spring physics, or 1.0
            let scale = 1.0;
            if (bubble.connectionAnimating) {
                scale = bubble.connectionScale;
            } else if (bubble.impactScale && bubble.impactScale !== 1.0) {
                scale = bubble.impactScale;
            }
            scaleAttr.setX(instanceIndex, scale);
            scaleAttr.needsUpdate = true;
        }
        
        // Update sympathy effect attributes
        const vibrationAttr = this.instancedMesh.geometry.getAttribute('instanceVibration');
        if (vibrationAttr && bubble.vibrationOffset) {
            vibrationAttr.setXYZ(instanceIndex, 
                bubble.vibrationOffset.x, 
                bubble.vibrationOffset.y, 
                bubble.vibrationOffset.z);
            vibrationAttr.needsUpdate = true;
        }
        
        const sympathyGlowAttr = this.instancedMesh.geometry.getAttribute('instanceSympathyGlow');
        if (sympathyGlowAttr) {
            const glowValue = bubble.sympathyGlowIntensity || 0.0;
            sympathyGlowAttr.setX(instanceIndex, glowValue);
            sympathyGlowAttr.needsUpdate = true;
        }
        
        const sympathyScaleAttr = this.instancedMesh.geometry.getAttribute('instanceSympathyScale');
        if (sympathyScaleAttr) {
            const scaleValue = bubble.sympathyScale || 1.0;
            sympathyScaleAttr.setX(instanceIndex, scaleValue);
            sympathyScaleAttr.needsUpdate = true;
        }
        
        if (this.glowMesh) {
            const glowScaleAttr = this.glowMesh.geometry.getAttribute('instanceScale');
            if (glowScaleAttr) {
                let scale = 1.0;
                if (bubble.connectionAnimating) {
                    scale = bubble.connectionScale;
                } else if (bubble.impactScale && bubble.impactScale !== 1.0) {
                    scale = bubble.impactScale;
                }
                glowScaleAttr.setX(instanceIndex, scale);
                glowScaleAttr.needsUpdate = true;
            }
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.glowMesh) {
            this.glowMesh.instanceMatrix.needsUpdate = true;
        }
    }
    
    removeBubble(bubble) {
        const bubbleId = bubble.id || bubble;
        const mapping = this.bubbleMap.get(bubbleId);
        if (!mapping) {
            console.log(`Warning: Tried to remove bubble ${bubbleId} but it was not found in mapping`);
            return false;
        }
        
        const instanceIndex = mapping.index;
        console.log(`[BubbleInstances] Removing bubble ${bubbleId} at instance ${instanceIndex}`);
        
        // CRITICAL: Set scale to 0 in the instance attributes FIRST
        // This ensures the bubble is immediately invisible in the shader
        const scaleAttr = this.instancedMesh.geometry.getAttribute('instanceScale');
        if (scaleAttr) {
            scaleAttr.setX(instanceIndex, 0.0);
            scaleAttr.needsUpdate = true;
        }
        
        if (this.glowMesh) {
            const glowScaleAttr = this.glowMesh.geometry.getAttribute('instanceScale');
            if (glowScaleAttr) {
                glowScaleAttr.setX(instanceIndex, 0.0);
                glowScaleAttr.needsUpdate = true;
            }
        }
        
        // Create a completely zeroed-out matrix to ensure the instance is hidden
        // IMPORTANT: We must update BOTH the matrix AND the scale attribute
        // Move far outside the view frustum to prevent any depth buffer interference
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.makeScale(0.001, 0.001, 0.001); // Near-zero scale instead of exactly 0
        hiddenMatrix.setPosition(0, -10000, -10000); // Move very far away
        
        this.instancedMesh.setMatrixAt(instanceIndex, hiddenMatrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        
        // CRITICAL: Force the instanced mesh to update its world matrix
        // This ensures the changes are applied immediately
        this.instancedMesh.updateMatrix();
        this.instancedMesh.updateMatrixWorld(true);
        
        if (this.glowMesh) {
            this.glowMesh.setMatrixAt(instanceIndex, hiddenMatrix);
            this.glowMesh.instanceMatrix.needsUpdate = true;
            this.glowMesh.updateMatrix();
            this.glowMesh.updateMatrixWorld(true);
        }
        
        // Note: instanceColor is a 3-component attribute (RGB only), not RGBA
        // The shader uses the instanceScale attribute for visibility, not alpha
        // Setting scale to 0 is the correct way to hide instances
        
        // Return the index to the pool for reuse
        this.availableIndices.push(instanceIndex);
        // Sort available indices to maintain consistency
        this.availableIndices.sort((a, b) => a - b);
        
        // Remove from tracking maps
        this.bubbleMap.delete(bubbleId);
        this.activeBubbles.delete(mapping.bubble);
        
        // IMPORTANT: Force the geometry to update
        // This ensures Three.js knows the attributes have changed
        this.instancedMesh.geometry.computeBoundingSphere();
        this.instancedMesh.geometry.computeBoundingBox();
        
        console.log(`[BubbleInstances] Removed bubble ${bubbleId}:`, {
            instanceIndex,
            type: mapping.type,
            position: `(${bubble.position.x.toFixed(1)}, ${bubble.position.y.toFixed(1)})`,
            activeCount: this.activeBubbles.size,
            availableIndices: this.availableIndices.length
        });
        return true;
    }
    
    // New unified methods for bubble management
    getActiveBubbles() {
        return Array.from(this.activeBubbles);
    }
    
    getBubblesByType(type) {
        return Array.from(this.bubbleMap.values())
            .filter(mapping => mapping.type === type)
            .map(mapping => mapping.bubble);
    }
    
    getBubbleMapping(bubble) {
        const bubbleId = bubble.id || bubble;
        return this.bubbleMap.get(bubbleId);
    }
    
    hasInstance(bubbleId) {
        // Check if a bubble instance exists and is visible
        const mapping = this.bubbleMap.get(bubbleId);
        if (!mapping) return false;
        
        // Check if the instance is actually visible (not scaled to 0)
        const scaleAttr = this.instancedMesh.geometry.getAttribute('instanceScale');
        if (scaleAttr) {
            const scale = scaleAttr.getX(mapping.index);
            return scale > 0;
        }
        
        // If no scale attribute, just check if mapping exists
        return true;
    }
    
    setElectricEffect(bubble) {
        const mapping = this.bubbleMap.get(bubble.id);
        if (!mapping) return;
        
        const instanceIndex = mapping.index;
        
        // Set electric blue color
        const color = new THREE.Color(0x00ddff);
        const colorAttr = this.instancedMesh.geometry.getAttribute('instanceColor');
        if (colorAttr) {
            colorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
            colorAttr.needsUpdate = true;
        }
        
        // Set electric glow
        const glowAttr = this.instancedMesh.geometry.getAttribute('instanceGlow');
        if (glowAttr) {
            glowAttr.setX(instanceIndex, 1.0); // Full glow for electrical effect
            glowAttr.needsUpdate = true;
        }
        
        if (this.glowMesh) {
            const glowColorAttr = this.glowMesh.geometry.getAttribute('instanceColor');
            if (glowColorAttr) {
                glowColorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
                glowColorAttr.needsUpdate = true;
            }
            
            const glowGlowAttr = this.glowMesh.geometry.getAttribute('instanceGlow');
            if (glowGlowAttr) {
                glowGlowAttr.setX(instanceIndex, 1.0);
                glowGlowAttr.needsUpdate = true;
            }
        }
    }
    
    updateBubbleType(bubble, newType) {
        const mapping = this.bubbleMap.get(bubble.id);
        if (mapping) {
            const oldType = mapping.type;
            mapping.type = newType;
            
            // When transitioning from shooting to grid, ensure the bubble remains visible
            if (oldType === 'shooting' && newType === 'grid') {
                const instanceIndex = mapping.index;
                
                // Ensure scale is set to 1.0 (visible)
                const scaleAttr = this.instancedMesh.geometry.getAttribute('instanceScale');
                if (scaleAttr) {
                    scaleAttr.setX(instanceIndex, 1.0);
                    scaleAttr.needsUpdate = true;
                }
                
                if (this.glowMesh) {
                    const glowScaleAttr = this.glowMesh.geometry.getAttribute('instanceScale');
                    if (glowScaleAttr) {
                        glowScaleAttr.setX(instanceIndex, 1.0);
                        glowScaleAttr.needsUpdate = true;
                    }
                }
                
                // Update position matrix to ensure proper placement
                const matrix = new THREE.Matrix4();
                matrix.setPosition(bubble.position);
                this.instancedMesh.setMatrixAt(instanceIndex, matrix);
                this.instancedMesh.instanceMatrix.needsUpdate = true;
                
                if (this.glowMesh) {
                    this.glowMesh.setMatrixAt(instanceIndex, matrix);
                    this.glowMesh.instanceMatrix.needsUpdate = true;
                }
            }
            
            // Updated bubble type
            return true;
        }
        return false;
    }
    
    updateBubbleColor(bubble, newColor) {
        const mapping = this.bubbleMap.get(bubble.id);
        if (!mapping) {
            console.warn('updateBubbleColor: No mapping found for bubble:', bubble.id);
            return false;
        }
        
        const instanceIndex = mapping.index;
        const color = new THREE.Color(newColor);
        
        // Ensure the bubble is visible (scale is not 0)
        const scaleAttr = this.instancedMesh.geometry.getAttribute('instanceScale');
        if (scaleAttr) {
            const currentScale = scaleAttr.getX(instanceIndex);
            if (currentScale === 0) {
                console.warn('updateBubbleColor: Bubble is hidden (scale=0), setting to visible:', bubble.id);
                scaleAttr.setX(instanceIndex, 1.0);
                scaleAttr.needsUpdate = true;
            }
        }
        
        // Update instance color using attributes (not setColorAt which may not exist)
        const colorAttr = this.instancedMesh.geometry.getAttribute('instanceColor');
        if (colorAttr) {
            colorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
            colorAttr.needsUpdate = true;
        }
        
        // Update glow color
        if (this.glowMesh) {
            const glowColorAttr = this.glowMesh.geometry.getAttribute('instanceColor');
            if (glowColorAttr) {
                glowColorAttr.setXYZ(instanceIndex, color.r, color.g, color.b);
                glowColorAttr.needsUpdate = true;
            }
            
            // Ensure glow is visible too
            const glowScaleAttr = this.glowMesh.geometry.getAttribute('instanceScale');
            if (glowScaleAttr) {
                const currentGlowScale = glowScaleAttr.getX(instanceIndex);
                if (currentGlowScale === 0) {
                    glowScaleAttr.setX(instanceIndex, 1.0);
                    glowScaleAttr.needsUpdate = true;
                }
            }
        }
        
        console.log('updateBubbleColor: Updated bubble', bubble.id, 'at index', instanceIndex, 'to color', color.getHexString());
        return true;
    }
    
    setJitterEffect(bubble, jitterAmount = 0.1) {
        const mapping = this.bubbleMap.get(bubble.id);
        if (!mapping) return;
        
        const instanceIndex = mapping.index;
        
        // Apply electrical jitter through matrix manipulation
        const matrix = new THREE.Matrix4();
        this.instancedMesh.getMatrixAt(instanceIndex, matrix);
        
        // Add jitter to position
        const position = new THREE.Vector3();
        matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
        
        position.x += (Math.random() - 0.5) * jitterAmount;
        position.y += (Math.random() - 0.5) * jitterAmount;
        
        matrix.setPosition(position);
        this.instancedMesh.setMatrixAt(instanceIndex, matrix);
        
        if (this.glowMesh) {
            this.glowMesh.setMatrixAt(instanceIndex, matrix);
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.glowMesh) {
            this.glowMesh.instanceMatrix.needsUpdate = true;
        }
    }
    
    update(deltaTime, camera = null) {
        this.currentCamera = camera;
        
        // Update frustum for culling
        if (this.enableFrustumCulling && camera) {
            this.frustumMatrix.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            );
            this.frustum.setFromProjectionMatrix(this.frustumMatrix);
            
            // Cull bubbles outside view frustum
            this.performFrustumCulling();
        }
        
        // Update shader uniforms
        if (this.instancedMesh.material.uniforms && this.instancedMesh.material.uniforms.time) {
            this.instancedMesh.material.uniforms.time.value += deltaTime;
        }
        
        if (this.glowMesh.material.uniforms && this.glowMesh.material.uniforms.time) {
            this.glowMesh.material.uniforms.time.value += deltaTime;
        }
        
        // Update bubbles with sympathy effects
        this.updateSympathyEffects();
    }
    
    /**
     * Update sympathy effects for all bubbles that have them
     */
    updateSympathyEffects() {
        let needsUpdate = false;
        
        for (const [bubbleId, data] of this.bubbleMap) {
            const { bubble } = data;
            
            // Check if bubble has any sympathy effects
            if (bubble.vibrationOffset || 
                bubble.sympathyGlowIntensity > 0 || 
                bubble.sympathyScale !== undefined && bubble.sympathyScale !== 1.0) {
                this.updateBubble(bubble);
                needsUpdate = true;
            }
        }
        
        return needsUpdate;
    }
    
    /**
     * Perform frustum culling on all bubbles
     */
    performFrustumCulling() {
        if (!this.currentCamera || !this.frustum) return;
        
        const tempSphere = new THREE.Sphere();
        let culledCount = 0;
        
        for (const [bubbleId, data] of this.bubbleMap) {
            const { index, bubble } = data;
            
            // Check if bubble is in frustum
            tempSphere.center.copy(bubble.position);
            tempSphere.radius = CONFIG.BUBBLE_RADIUS * 2;
            
            const isVisible = this.frustum.intersectsSphere(tempSphere);
            
            // Update visibility in color attribute (alpha channel)
            if (!isVisible) {
                // Set alpha to 0 for culled bubbles
                this.instancedMesh.geometry.attributes.instanceColor.setW(index, 0);
                if (this.glowMesh) {
                    this.glowMesh.geometry.attributes.instanceColor.setW(index, 0);
                }
                culledCount++;
            } else {
                // Restore alpha for visible bubbles
                this.instancedMesh.geometry.attributes.instanceColor.setW(index, 1);
                if (this.glowMesh) {
                    this.glowMesh.geometry.attributes.instanceColor.setW(index, 0.15);
                }
            }
        }
        
        // Mark color attribute for update
        this.instancedMesh.geometry.attributes.instanceColor.needsUpdate = true;
        if (this.glowMesh) {
            this.glowMesh.geometry.attributes.instanceColor.needsUpdate = true;
        }
        
        // Culling stats available if needed
        // console.log(`Frustum culling: ${culledCount} of ${this.bubbleMap.size} bubbles culled`);
    }
    
    /**
     * Toggle a specific effect on/off
     * @param {string} effectName - Name of the effect to toggle
     * @param {boolean} enabled - Whether to enable or disable the effect
     */
    setEffect(effectName, enabled) {
        if (this.effects.hasOwnProperty(effectName)) {
            this.effects[effectName] = enabled;
            
            // Update the corresponding uniform
            // The uniform name is the same as the effect name
            if (this.instancedMesh.material.uniforms[effectName]) {
                this.instancedMesh.material.uniforms[effectName].value = enabled ? 1.0 : 0.0;
            }
        }
    }
    
    /**
     * Set multiple effects at once
     * @param {Object} effectSettings - Object with effect names as keys and boolean values
     */
    setEffects(effectSettings) {
        Object.entries(effectSettings).forEach(([effect, enabled]) => {
            this.setEffect(effect, enabled);
        });
    }
    
    /**
     * Get current effect settings
     * @returns {Object} Current effect settings
     */
    getEffects() {
        return { ...this.effects };
    }
    
    /**
     * Set quality preset
     * @param {string} preset - 'low', 'medium', 'high', 'ultra'
     */
    setQualityPreset(preset) {
        const presets = {
            low: {
                enablePBR: false,
                enableTransmission: false,
                enableClearcoat: false,
                enableSheen: false,
                enableEnvironmentMap: false,
                enablePulse: false,
                enableColorShift: false,
                enableDistortion: false,
                enableSparkles: false,
                enableRainbow: false,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: false,
                enableHolographic: false
            },
            medium: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: false,
                enableSheen: false,
                enableEnvironmentMap: true,
                enablePulse: true,
                enableColorShift: false,
                enableDistortion: false,
                enableSparkles: false,
                enableRainbow: false,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: false,
                enableHolographic: false
            },
            high: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: true,
                enableSheen: true,
                enableEnvironmentMap: true,
                enablePulse: true,
                enableColorShift: true,
                enableDistortion: false,
                enableSparkles: true,
                enableRainbow: true,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: true,
                enableHolographic: false
            },
            ultra: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: true,
                enableSheen: true,
                enableEnvironmentMap: true,
                enablePulse: true,
                enableColorShift: true,
                enableDistortion: true,
                enableSparkles: true,
                enableRainbow: true,
                enableSubsurface: true,
                enableCaustics: true,
                enableFoam: true,
                enableWobble: true,
                enableHolographic: true
            }
        };
        
        if (presets[preset]) {
            this.setEffects(presets[preset]);
        }
    }
    
    /**
     * Dispose of all resources to prevent memory leaks
     */
    dispose() {
        // Remove from scene
        if (this.instancedMesh && this.instancedMesh.parent) {
            this.instancedMesh.parent.remove(this.instancedMesh);
        }
        if (this.glowMesh && this.glowMesh.parent) {
            this.glowMesh.parent.remove(this.glowMesh);
        }
        
        // Dispose geometries
        if (this.geometry) {
            this.geometry.dispose();
        }
        
        // Dispose materials
        if (this.material) {
            this.material.dispose();
        }
        if (this.glowMaterial) {
            this.glowMaterial.dispose();
        }
        
        // Dispose meshes
        if (this.instancedMesh) {
            this.instancedMesh.dispose();
        }
        if (this.glowMesh) {
            this.glowMesh.dispose();
        }
        
        // Clear maps and arrays
        this.bubbleMap.clear();
        this.freeIndices = [];
        this.activeTypes.clear();
        
        // Clear references
        this.instancedMesh = null;
        this.glowMesh = null;
        this.geometry = null;
        this.material = null;
        this.glowMaterial = null;
        this.scene = null;
        this.currentCamera = null;
        this.frustum = null;
    }
    
    /**
     * Clean up unused type renderers
     */
    cleanupOldTypeRenderers() {
        // Clean up any type renderers that are no longer in use
        if (this.typeRenderers) {
            for (const [type, renderer] of this.typeRenderers.entries()) {
                if (!this.activeTypes.has(type)) {
                    console.log(`Cleaning up unused type renderer: ${type}`);
                    if (renderer.mesh) {
                        this.scene.remove(renderer.mesh);
                        if (renderer.mesh.geometry) renderer.mesh.geometry.dispose();
                        if (renderer.mesh.material) renderer.mesh.material.dispose();
                    }
                    this.typeRenderers.delete(type);
                }
            }
        }
    }
    
    /**
     * Clear all bubble instances
     * Used for complete reset/sync operations
     */
    clearAll() {
        console.log('Clearing all bubble instances...');
        
        // Clear all mappings if they exist
        if (this.bubbleMap) this.bubbleMap.clear();
        if (this.activeBubbles) this.activeBubbles.clear();
        if (this.activeTypes) this.activeTypes.clear();
        
        // Reset all instance data if mesh exists
        if (this.instancedMesh && this.maxInstances) {
            for (let i = 0; i < this.maxInstances; i++) {
                // Hide all instances by setting scale to 0
                this.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
                
                // Reset colors to default
                if (this.instancedMesh.setColorAt) {
                    this.instancedMesh.setColorAt(i, new THREE.Color(0xffffff));
                }
                if (this.glowMesh && this.glowMesh.setColorAt) {
                    this.glowMesh.setColorAt(i, new THREE.Color(0xffffff));
                }
            }
            
            // Mark for update
            if (this.instancedMesh.instanceMatrix) {
                this.instancedMesh.instanceMatrix.needsUpdate = true;
            }
            if (this.instancedMesh.instanceColor) {
                this.instancedMesh.instanceColor.needsUpdate = true;
            }
        }
        
        if (this.glowMesh) {
            if (this.glowMesh.instanceMatrix) {
                this.glowMesh.instanceMatrix.needsUpdate = true;
            }
            if (this.glowMesh.instanceColor) {
                this.glowMesh.instanceColor.needsUpdate = true;
            }
        }
        
        // Clean up type renderers
        this.cleanupOldTypeRenderers();
        
        console.log('All bubble instances cleared');
    }
}