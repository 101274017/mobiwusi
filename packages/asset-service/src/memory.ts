import type { AssetStore, AssetTransaction, ConfigurationHead, ConfigurationStore, ConfigurationTransaction, CurrentPet, GeneratedAsset, GenerationJob, SignedConfiguration } from './ports.ts';

class MemoryTransactions<State> {
  private lock: Promise<void> = Promise.resolve();
  constructor(private state: State) {}

  async transaction<Result>(work: (state: State) => Promise<Result>): Promise<Result> {
    let unlock!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    try {
      const draft = structuredClone(this.state);
      const result = await work(draft);
      const output = structuredClone(result);
      this.state = draft;
      return output;
    } finally { unlock(); }
  }
}

export class InMemoryAssetStore implements AssetStore {
  private readonly memory = new MemoryTransactions({ jobs: new Map<string, GenerationJob>(), assets: new Map<string, GeneratedAsset>(), current: new Map<string, CurrentPet>() });

  transaction<Result>(work: (transaction: AssetTransaction) => Promise<Result>): Promise<Result> {
    return this.memory.transaction(state => work({
      getJob: async id => structuredClone(state.jobs.get(id) ?? null),
      saveJob: async job => { state.jobs.set(job.jobId, structuredClone(job)); },
      listJobs: async ownerId => [...state.jobs.values()].filter(job => job.ownerId === ownerId).map(job => structuredClone(job)),
      getAsset: async id => structuredClone(state.assets.get(id) ?? null),
      saveAsset: async asset => { state.assets.set(asset.id, structuredClone(asset)); },
      deleteAsset: async id => { state.assets.delete(id); },
      getCurrent: async ownerId => structuredClone(state.current.get(ownerId) ?? null),
      saveCurrent: async current => { state.current.set(current.ownerId, structuredClone(current)); },
    }));
  }
}

export class InMemoryConfigurationStore implements ConfigurationStore {
  private readonly memory = new MemoryTransactions({ releases: new Map<string, SignedConfiguration>(), heads: new Map<string, ConfigurationHead>() });

  transaction<Result>(work: (transaction: ConfigurationTransaction) => Promise<Result>): Promise<Result> {
    const key = (...parts: string[]) => JSON.stringify(parts);
    return this.memory.transaction(state => work({
      getRelease: async (ownerId, kind, version) => structuredClone(state.releases.get(key(ownerId, kind, version)) ?? null),
      saveRelease: async release => { state.releases.set(key(release.payload.ownerId, release.payload.kind, release.payload.version), structuredClone(release)); },
      getHead: async (ownerId, kind) => structuredClone(state.heads.get(key(ownerId, kind)) ?? null),
      saveHead: async head => { state.heads.set(key(head.ownerId, head.kind), structuredClone(head)); },
    }));
  }
}
