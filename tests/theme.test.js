import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, newSave, validateSave } from '../src/domain/progression.js';
import { SaveService, SAVE_KEY } from '../src/services/SaveService.js';
const fresh = () =>
  newSave('pikachu', { seed: 42, instanceId: 'theme-partner', acquiredAt: '2026-10-21' });
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
describe('appearance save compatibility', () => {
  it('defaults new saves to dark without changing schema version', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(fresh().settings.theme).toBe('dark');
    expect(fresh().saveVersion).toBe(1);
  });
  it('fills missing theme on old v1 saves without mutating progress or source', () => {
    const old = fresh();
    delete old.settings.theme;
    old.completedBattleIds = ['existing-reward'];
    old.trainer.coins = 987;
    const loaded = validateSave(old);
    expect(loaded).toEqual({ ...old, settings: { ...old.settings, theme: 'dark' } });
    expect(old.settings).not.toHaveProperty('theme');
  });
  it.each(['dark', 'light'])('round-trips %s through existing save commits', (theme) => {
    const store = storage(),
      service = new SaveService(store);
    const before = service.commit(null, fresh);
    const after = service.commit(before, (save) => ({
      ...save,
      settings: { ...save.settings, theme },
    }));
    expect(new SaveService(store).load()).toEqual(after);
    expect(after.collection).toEqual(before.collection);
    expect(after.trainer).toEqual(before.trainer);
    expect(after.settings.theme).toBe(theme);
    expect(after.revision).toBe(before.revision + 1);
    expect(JSON.parse(store.getItem(SAVE_KEY)).saveVersion).toBe(1);
  });
  it.each(['system', '', 'DARK', null, 0, true, {}, []])(
    'rejects invalid theme %j using recovery rules',
    (theme) => {
      const save = fresh();
      save.settings.theme = theme;
      expect(() => validateSave(save)).toThrow('Save needs recovery: theme');
    },
  );
  it('failed theme validation never overwrites the existing save', () => {
    const store = storage(),
      service = new SaveService(store);
    const before = service.commit(null, fresh),
      raw = service.raw();
    expect(() =>
      service.commit(before, (save) => ({
        ...save,
        settings: { ...save.settings, theme: 'invalid' },
      })),
    ).toThrow('theme');
    expect(service.raw()).toBe(raw);
  });
});
