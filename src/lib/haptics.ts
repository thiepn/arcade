/**
 * Haptic Vibration Feedback Engine for Mobile Devices
 * Wraps navigator.vibrate() with safe fallback checks and tuned tactile patterns.
 */

type SemanticFeedbackKind = 'success' | 'strong' | 'mastery' | 'failure';

class HapticsEngine {
  private enabled: boolean = true;
  private lastScoreVibrateTime: number = 0;

  constructor() {
    // Check initial support and browser environment
    this.enabled = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * P17: mirror already-semantic tactile events into the shared visual hierarchy.
   * This is intentionally independent of vibration support/mute state: desktop
   * players still deserve the same success/failure communication. The P17
   * runtime ignores the event when no game shell is active and applies its own
   * bounded cooldown when one is active.
   */
  private feedback(kind: SemanticFeedbackKind): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('arcade:p17-feedback', { detail: { kind } }));
  }

  /**
   * Safely dispatches a vibration pattern
   */
  private trigger(pattern: number | number[]): void {
    if (!this.enabled) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors (e.g. user activation constraints in some webviews)
    }
  }

  /**
   * Light click pulse (10ms) for UI navigation, button presses, and switches
   */
  public click(): void {
    this.trigger(10);
  }

  /**
   * Light tactile tap (15ms)
   */
  public light(): void {
    this.trigger(15);
  }

  /**
   * Medium tactile pulse (35ms) for actions, jumps, flips, or launches
   */
  public medium(): void {
    this.trigger(35);
  }

  /**
   * Heavy tactile pulse (60ms) for strong impacts or power-ups
   */
  public heavy(): void {
    this.feedback('strong');
    this.trigger(60);
  }

  /**
   * Score vibration (18ms) throttled to prevent motor fatigue during rapid scoring
   */
  public score(): void {
    this.feedback('success');
    const now = Date.now();
    // Throttle to at most once every 75ms
    if (now - this.lastScoreVibrateTime > 75) {
      this.lastScoreVibrateTime = now;
      this.trigger(18);
    }
  }

  /**
   * Milestone or combo pulse: double-pulse pattern [25ms on, 35ms off, 30ms on]
   */
  public combo(): void {
    this.feedback('strong');
    this.trigger([25, 35, 30]);
  }

  /**
   * Impact or collision shock: [40ms]
   */
  public impact(): void {
    this.feedback('failure');
    this.trigger(40);
  }

  /**
   * Session Loss / Game Over: dramatic descending shock [70ms on, 40ms off, 120ms on]
   */
  public gameOver(): void {
    this.feedback('failure');
    this.trigger([70, 40, 120]);
  }

  /**
   * New High Score / Victory celebration: rhythmic victory pattern [40ms, 40ms, 40ms, 40ms, 90ms]
   */
  public highScore(): void {
    this.feedback('mastery');
    this.trigger([40, 40, 40, 40, 90]);
  }

  /**
   * Success / Unlock celebration pulse [30ms, 30ms, 60ms]
   */
  public success(): void {
    this.feedback('mastery');
    this.trigger([30, 30, 60]);
  }
}

export const haptics = new HapticsEngine();
