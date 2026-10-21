import { validateSave } from '../domain/progression.js';
export const SAVE_KEY = 'nitrous.battle-atelier.v1';
export class SaveService {
  constructor(storage) {
    this.storage = storage;
  }
  load() {
    const raw = this.storage.getItem(SAVE_KEY);
    return raw ? validateSave(JSON.parse(raw)) : null;
  }
  commit(current, transform) {
    const latest = this.load();
    if ((latest?.revision ?? -1) !== (current?.revision ?? -1))
      throw Error('Save changed in another tab. Reload before continuing.');
    const next = validateSave(transform(latest ? structuredClone(latest) : null));
    next.revision = (latest?.revision ?? -1) + 1;
    this.storage.setItem(SAVE_KEY, JSON.stringify(next));
    return next;
  }
  reset() {
    this.storage.removeItem(SAVE_KEY);
  }
  raw() {
    return this.storage.getItem(SAVE_KEY) || '';
  }
}
