// Presentation only. Timers are independent of turn speed and owned by this instance.
export const INTRO_DURATION = 1650;
export const INTRO_REDUCED_DURATION = 180;
export const INTRO_LOAD_TIMEOUT = 3000;

export class BattleIntro {
  constructor(view, { reducedMotion = false, cue = () => {} } = {}) {
    this.view = view;
    this.reducedMotion = reducedMotion;
    this.cue = cue;
    this.timers = new Set();
    this.cleanups = [];
    this.done = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.button = view.querySelector('[data-intro-skip]');
    const skip = () => this.skip();
    const trap = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        this.button.focus({ preventScroll: true });
      }
    };
    this.button.addEventListener('click', skip);
    view.addEventListener('keydown', trap);
    this.cleanups.push(() => this.button.removeEventListener('click', skip));
    this.cleanups.push(() => view.removeEventListener('keydown', trap));
    view.dataset.reduced = String(reducedMotion);
  }

  later(callback, ms) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.finished) callback();
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  portrait(image) {
    return new Promise((resolve) => {
      let settled = false;
      const complete = (failed = false) => {
        if (settled) return;
        settled = true;
        image.parentElement.dataset.missing = String(failed || !image.naturalWidth);
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failedLoad);
        resolve();
      };
      const loaded = () => complete();
      const failedLoad = () => complete(true);
      image.addEventListener('load', loaded);
      image.addEventListener('error', failedLoad);
      this.cleanups.push(() => complete(true));
      if (image.complete) complete();
    });
  }

  run(prepare) {
    this.button.focus({ preventScroll: true });
    const portraits = [...this.view.querySelectorAll('img')];
    const ready = () => {
      if (this.finished || this.ready) return;
      this.ready = true;
      clearTimeout(deadline);
      this.timers.delete(deadline);
      for (const image of portraits) {
        if (!image.complete || !image.naturalWidth) image.parentElement.dataset.missing = 'true';
      }
      if (this.skipped) {
        this.finish('skipped');
        return;
      }
      this.view.dataset.state = 'playing';
      if (!this.reducedMotion) {
        this.sound('intro-entry');
        this.later(() => this.sound('intro-impact'), 620);
      }
      this.later(
        () => this.finish('completed'),
        this.reducedMotion ? INTRO_REDUCED_DURATION : INTRO_DURATION,
      );
    };
    const deadline = this.later(ready, INTRO_LOAD_TIMEOUT);
    // Missing/rejected graphics never prevent the CSS introduction or playable fallback.
    Promise.allSettled([prepare, ...portraits.map((image) => this.portrait(image))]).then(ready);
    return this.done;
  }

  sound(kind) {
    try {
      this.cue(kind);
    } catch {
      /* Audio is optional. */
    }
  }

  skip() {
    if (this.finished) return;
    this.skipped = true;
    if (this.ready) this.finish('skipped');
    else this.button.textContent = 'Preparing arena…';
  }

  cancel() {
    this.finish('cancelled');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
    this.view.remove();
    this.resolve(reason);
  }
}
