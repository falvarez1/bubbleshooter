i## Design Document: "Chain Lightning Bubble" Power-Up

**1. Introduction**

*   **Purpose:** This document outlines the redesign of the "Lightning Strike" power-up for the bubble shooter game. The goal is to address existing issues of gameplay interruption, lack of clarity, and limited strategic depth, transforming it into a more seamless, engaging, and rewarding experience.
*   **Current Issues Addressed:**
    *   Forces players to stop playing with a modal dialog.
    *   Blocks view of the game board during selection.
    *   Breaks the fast-paced flow of gameplay.
    *   No preview of what will be destroyed.
    *   Limited strategic value in the choice between row/column.
*   **New Design Goals:**
    *   Maintain continuous gameplay without interruption.
    *   Provide meaningful strategic choices.
    *   Be visually clear and exciting.
    *   Feel powerful and rewarding.
    *   Integrate seamlessly with existing power-up mechanics, specifically by being a shootable bubble.

**2. New Mechanic Concept: "Chain Lightning Bubble"**

The "Chain Lightning Bubble" is a special power-up bubble that the player aims and shoots like a regular bubble. Upon impact with another bubble or the top wall, it unleashes a primary lightning strike to the impacted bubble and a few immediately adjacent bubbles. From these initially struck bubbles, secondary, smaller lightning arcs can jump to a limited number of other nearby bubbles, creating a cascading destruction effect. This design directly addresses the core issues by integrating the power-up into the primary shooting mechanic, eliminating modals, and providing a dynamic, visually engaging effect that offers strategic depth based on the player's aiming point.

**3. Activation and Effect**

*   **Obtainment:** The Chain Lightning Bubble can be obtained through various existing game mechanics for earning power-ups (e.g., filling a power-up meter, lucky shots, level rewards, achievement rewards as per [`game_mechanics_guide.md:37-41`](game_mechanics_guide.md:37-41)).
*   **Loading:** When obtained, it appears in the player's bubble launcher, ready to be aimed and fired. It should have a distinct visual appearance (see Section 4).
*   **Effect Details:**
    1.  **Initial Impact:** When the Chain Lightning Bubble hits a target bubble (or a cluster, or the wall), it immediately destroys the hit bubble.
    2.  **Primary Arc Burst:** Simultaneously, 2-3 powerful lightning arcs shoot out from the impact point, targeting the nearest adjacent bubbles to the *initial impact point*. These bubbles are instantly destroyed.
    3.  **Secondary Chain Arcs:** From each bubble destroyed by a *primary arc*, 1-2 smaller, quicker lightning arcs can jump to *new, unique* adjacent bubbles that haven't been targeted yet by this power-up instance. These bubbles are also instantly destroyed.
        *   The number of secondary arcs and their jump distance could be fixed or have a slight random element to add excitement, but should be balanced to prevent overly chaotic or unpredictable outcomes.
        *   Prioritization for arcs could be:
            *   Bubbles of the same color as the initially impacted bubble (if applicable and desired for strategic depth).
            *   Bubbles that would trigger further matches/drops.
            *   Closest available bubbles.
    4.  **Total Bubbles Destroyed:** A well-aimed shot could clear a small cluster (e.g., 5-8 bubbles), depending on the density and configuration of bubbles at the impact site. This is less than a full row/column clear, but more targeted and interactive.

**4. Visual and Audio Feedback Design**

*   **Visuals:**
    *   **Bubble Appearance (Launcher):** The Chain Lightning Bubble itself should be visually distinct. Perhaps a dark, stormy-colored bubble with a pulsating electric aura or small, crackling lightning effects visible within it.
    *   **Trajectory:** Standard bubble trajectory line. Consider a subtle electric particle trail as it flies.
    *   **Impact Effect:** A bright flash of light and a burst of electrical particles at the point of impact.
    *   **Lightning Arcs:**
        *   Primary arcs: Thicker, brighter, more jagged lightning bolts.
        *   Secondary arcs: Slightly thinner, faster, and perhaps a slightly different hue of blue/white lightning.
    *   **Bubble Destruction:** Bubbles hit by lightning should have a unique destruction animation – perhaps they "short-circuit" with electrical effects before popping, distinct from a standard match pop.
    *   **Preview (Subtle):** While aiming, bubbles that would be in the *immediate* primary arc range if the Chain Lightning Bubble hit the currently targeted spot could have a very faint, intermittent electrical shimmer. This provides some strategic feedback without pausing the game or being overly distracting.
*   **Audio:** (Leveraging sounds from [`sound_integration_guide.md`](sound_integration_guide.md))
    *   **Bubble in Launcher (Idle):** A low, subtle electrical hum or crackle ([`electric-arc.wav`](sound_integration_guide.md:48) at low volume, possibly looped).
    *   **Shooting:** Standard [`bubble-shoot.wav`](sound_integration_guide.md:8) perhaps mixed with a quick, sharp electrical 'zap'.
    *   **Impact:** A sharp, impactful electrical burst – a modified or layered [`lightning-strike.wav`](sound_integration_guide.md:18).
    *   **Primary Arcs:** Distinct, sharp crackling sounds for each primary arc ([`electric-arc.wav`](sound_integration_guide.md:48)).
    *   **Secondary Arcs:** Quicker, slightly higher-pitched zaps for secondary arcs.
    *   **Bubble Destruction (by lightning):** A unique "electrical pop" sound, different from [`bubble-pop-single.wav`](sound_integration_guide.md:11) or [`bubble-pop-multiple.wav`](sound_integration_guide.md:12). Could involve a quick sizzle followed by a pop.
    *   **Overall Feel:** The soundscape should be energetic and powerful, reinforcing the destructive nature of the lightning. Pitch variation for repeated arc sounds will be important as per [`sound_integration_guide.md:78`](sound_integration_guide.md:78).

**5. Strategic Value and Player Decision-Making**

*   **Targeting is Key:** The primary strategic decision is where to aim the Chain Lightning Bubble.
    *   Hitting a dense cluster maximizes the potential for chain reactions.
    *   Targeting a bubble that is part of a structurally important connection can trigger larger cascades after the initial lightning clear.
    *   Aiming near special bubbles (e.g., Bomb Bubbles, as per [`game_mechanics_guide.md:6`](game_mechanics_guide.md:6)) could trigger them as part of the chain reaction, leading to more complex and rewarding outcomes.
*   **Timing:** Using it to clear a path, stop an advancing ceiling, or break up a problematic formation of bubbles.
*   **Predictability vs. Reward:** While the initial impact and primary arcs are relatively predictable (especially with a subtle preview), the secondary arcs can provide a small element of "bonus" destruction, making the power-up feel more dynamic and rewarding when it chains effectively.
*   **Comparison to Original:** Unlike the old row/column choice which was often a binary decision with a somewhat fixed outcome, the Chain Lightning Bubble offers more nuanced aiming decisions with variable outcomes based on the board state at the impact point. It shifts strategy from a "macro" clear to a "meso" clear with potential for skillful placement.

**6. Technical Implementation Approach (High-Level)**

*   **New Bubble Type:** Define `ChainLightningBubble` as a new class or type within the game's bubble entity system.
*   **Activation Logic:**
    *   When `ChainLightningBubble` is fired and collides, trigger its special effect.
*   **Chain Lightning Algorithm:**
    1.  On impact, identify the initial bubble(s) for destruction.
    2.  Find N (e.g., 2-3) nearest valid neighbors for primary arcs. Prioritize based on distance, then potentially other factors (color, special properties). Mark them as "hit by primary."
    3.  For each bubble "hit by primary," find M (e.g., 1-2) new, unique, valid neighbors for secondary arcs. Mark them as "hit by secondary."
    4.  Ensure no bubble is targeted multiple times by the same lightning instance.
    5.  Trigger destruction animations and sounds for all affected bubbles.
*   **Visuals & Audio:**
    *   Integrate new particle effects for lightning and electrical bubble destruction.
    *   Trigger corresponding sound events (initial impact, arc, destruction) via the `soundManager` (as per [`sound_integration_guide.md:86`](sound_integration_guide.md:86)).
*   **Balancing:** Parameters like the number of primary/secondary arcs, jump distance, and targeting priorities will need careful tuning and playtesting.

**7. Comparison to Other Power-Ups (from [`game_mechanics_guide.md`](game_mechanics_guide.md))**

*   **Bomb Bubble ([`game_mechanics_guide.md:6`](game_mechanics_guide.md:6)):** Bomb is a fixed radius explosion. Chain Lightning is more directional and dependent on bubble layout for its spread.
*   **Fireball ([`game_mechanics_guide.md:8`](game_mechanics_guide.md:8)):** Fireball clears in a straight line. Chain Lightning has a more localized but branching area of effect.
*   **Rainbow Bubble ([`game_mechanics_guide.md:9`](game_mechanics_guide.md:9)):** Rainbow is for setting up large color matches. Chain Lightning is direct destruction.
*   **Laser Bubble ([`game_mechanics_guide.md:10`](game_mechanics_guide.md:10)):** Laser is a precise line cut. Chain Lightning is less about precision cutting and more about a small area burst with chaining potential.
*   **Meteor Bubble ([`game_mechanics_guide.md:11`](game_mechanics_guide.md:11)):** Meteor bounces and destroys on impact. Chain Lightning is a single impact with an immediate branching effect.
*   **Color Change ([`game_mechanics_guide.md:17`](game_mechanics_guide.md:17)):** Color Change is utility for setup. Chain Lightning is destructive.

The Chain Lightning Bubble fills a niche for a moderately powerful, strategically aimed destructive power-up that relies on the local bubble configuration for its full effect, offering a different tactical feel from existing AoE or line-clearing power-ups.

**8. Mermaid Diagram of the New Mechanic**

```mermaid
graph TD
    A[Player Obtains/Selects Chain Lightning Bubble] --> B{Aiming Phase};
    B -- Player Fires Bubble --> C[Chain Lightning Bubble Impacts Target];
    C --> D{Initial Bubble Destroyed};
    D --> E[Primary Lightning Arcs (2-3) Hit Adjacent Bubbles];
    E --> F{Primary Target Bubbles Destroyed};
    F -- Each Primary Target --> G[Secondary Lightning Arcs (1-2 per primary) Jump to New Adjacent Bubbles];
    G --> H{Secondary Target Bubbles Destroyed};
    C --> V1[Visuals: Impact Flash, Electrical Particles];
    D --> V2[Visuals: Bubble "Short-Circuit" Animation];
    E --> V3[Visuals: Bright, Jagged Lightning Arcs];
    G --> V4[Visuals: Thinner, Faster Lightning Arcs];
    C --> S1[Audio: Impact Zap/Boom];
    E --> S2[Audio: Primary Arc Crackle];
    G --> S3[Audio: Secondary Arc Zaps];
    H --> S4[Audio: Electrical Pop Destruction];
    B -.-> P((Subtle Visual Preview of Potential Primary Targets));

    subgraph Legend
        L1[Process Step]
        L2{Decision/Action}
        L3[Visual/Audio Feedback]
        L4((Potential Future Feature))
    end