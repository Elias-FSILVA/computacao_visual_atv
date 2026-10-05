const STORAGE_KEY = "escalador_ranking_v1";
const MAX_ENTRIES = 10;

export class Ranking {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  save(entry) {
    const entries = this.load();
    entries.push(entry);
    entries.sort((a, b) => (b.score - a.score) || (a.time - b.time));
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
}
