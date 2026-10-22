import { describe, it, expect, vi, afterEach } from 'vitest';
import { BattleIntro, INTRO_DURATION, INTRO_LOAD_TIMEOUT } from '../src/ui/BattleIntro.js';

class Element extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
  }
  focus() {}
  remove() {
    this.removed = true;
  }
}
function setup({ reducedMotion = false, imagePending = false } = {}) {
  vi.useFakeTimers();
  const view = new Element(),
    button = new Element(),
    image = new Element();
  image.complete = !imagePending;
  image.naturalWidth = imagePending ? 0 : 96;
  image.parentElement = new Element();
  view.querySelector = () => button;
  view.querySelectorAll = () => [image];
  const cue = vi.fn();
  const intro = new BattleIntro(view, { reducedMotion, cue });
  return { intro, view, button, image, cue };
}
afterEach(() => {
  vi.useRealTimers();
});
describe('battle introduction lifecycle', () => {
  it('finishes once at 1650ms with synchronized cues and no retained timers', async () => {
    const { intro, view, cue } = setup();
    const done = intro.run(Promise.resolve());
    await vi.advanceTimersByTimeAsync(0);
    expect(view.dataset.state).toBe('playing');
    await vi.advanceTimersByTimeAsync(INTRO_DURATION - 1);
    expect(intro.finished).not.toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toBe('completed');
    intro.skip();
    expect(view.removed).toBe(true);
    expect(cue.mock.calls.map(([kind]) => kind)).toEqual(['intro-entry', 'intro-impact']);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('button skip is idempotent and cancels the pending impact cue', async () => {
    const { intro, button, cue } = setup();
    const done = intro.run();
    await vi.advanceTimersByTimeAsync(0);
    button.dispatchEvent(new Event('click'));
    intro.skip();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await done).toBe('skipped');
    expect(cue).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('skip while loading waits for readiness with a bounded fallback', async () => {
    const { intro, image } = setup({ imagePending: true });
    const done = intro.run(new Promise(() => {}));
    intro.skip();
    await vi.advanceTimersByTimeAsync(INTRO_LOAD_TIMEOUT - 1);
    expect(intro.finished).not.toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toBe('skipped');
    expect(image.parentElement.dataset.missing).toBe('true');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancellation prevents late preparation from restarting a removed overlay', async () => {
    const { intro, view, cue } = setup({ imagePending: true });
    let resolve;
    const done = intro.run(
      new Promise((r) => {
        resolve = r;
      }),
    );
    intro.cancel();
    resolve();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await done).toBe('cancelled');
    expect(view.dataset.state).not.toBe('playing');
    expect(cue).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reduced motion reveals statically for 180ms without cinematic audio', async () => {
    const { intro, view, cue } = setup({ reducedMotion: true });
    const done = intro.run();
    await vi.advanceTimersByTimeAsync(179);
    expect(intro.finished).not.toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toBe('completed');
    expect(view.dataset.reduced).toBe('true');
    expect(cue).not.toHaveBeenCalled();
  });
  it('rejected graphics, failed image and failed audio still release the intro', async () => {
    const { intro, image } = setup({ imagePending: true });
    intro.cue = () => {
      throw Error('No audio');
    };
    const done = intro.run(Promise.reject(Error('No WebGL')));
    image.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(INTRO_DURATION);
    expect(await done).toBe('completed');
    expect(image.parentElement.dataset.missing).toBe('true');
    expect(vi.getTimerCount()).toBe(0);
  });
});
