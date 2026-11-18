// A small Entity-Component-System, built to stay fast on an iPad mini 1 (A5, Safari 8).
// Same ideas and core API as the timstaana lobby's shared/ecs.ts:
//   - entities are numbers, components are plain data, systems are plain functions (world, dt) => void
//   - resources are world-wide singletons, events are per-tick message lists
// Differences, for speed on old Safari:
//   - each component type is a sparse set (flat arrays, no Maps on the hot path)
//   - query() returns a cached entity array, rebuilt only when the components involved change
//   - each(A, B, (e, a, b) => ...) loops with no allocation per entity
//   - systems belong to a stage: 'input' runs once per frame, 'update' at a fixed rate, 'render' once per frame

export type Entity = number;

/** A component type: a name plus its data shape, used as a typed key. */
export interface ComponentType<T> { readonly id: number; readonly name: string; readonly _t?: T }
let nextComponentId = 0;
export const component = <T = true>(name: string): ComponentType<T> => ({ id: nextComponentId++, name });

/** A world-wide singleton key (the clock, the screen size, the asset registry...). */
export interface ResourceKey<T> { readonly key: string; readonly _t?: T }
export const resource = <T>(key: string): ResourceKey<T> => ({ key });

/** A message type: systems emit during a tick, any system can read them in the same tick. */
export interface EventType<T> { readonly id: number; readonly name: string; readonly _t?: T }
let nextEventId = 0;
export const event = <T>(name: string): EventType<T> => ({ id: nextEventId++, name });

export type Stage = 'input' | 'update' | 'render';
export type System = (world: World, dt: number) => void;
/** A plugin bundles components, systems and resources: world.use(Drag(), Motion()). */
export type Plugin = ((world: World) => void) & { pluginName?: string };

class Store<T> {
  dense: Entity[] = [];
  data: T[] = [];
  index: number[] = []; // entity -> position in dense, -1 when absent
  version = 0;
  get(e: Entity): T | undefined { const i = this.index[e]; return i === undefined || i < 0 ? undefined : this.data[i]; }
  has(e: Entity) { const i = this.index[e]; return i !== undefined && i >= 0; }
  set(e: Entity, v: T) {
    const i = this.index[e];
    if (i !== undefined && i >= 0) { this.data[i] = v; return; }
    this.index[e] = this.dense.length; this.dense.push(e); this.data.push(v); this.version++;
  }
  remove(e: Entity) {
    const i = this.index[e];
    if (i === undefined || i < 0) return;
    const last = this.dense.length - 1, moved = this.dense[last];
    this.dense[i] = moved; this.data[i] = this.data[last]; this.index[moved] = i;
    this.dense.pop(); this.data.pop(); this.index[e] = -1; this.version++;
  }
}

interface Query { stores: Store<unknown>[]; versions: number[]; entities: Entity[]; spare: Entity[]; busy: number }
const REUSE_AFTER = 64;

export class World {
  private next = 1;
  private alive: boolean[] = [];
  // Despawned ids are reused (oldest first, after REUSE_AFTER more despawns) so the per-store index arrays stay
  // small and dense; without this, spawning trails/particles grows them forever and Safari 8 turns them sparse.
  private free: Entity[] = [];
  private freeHead = 0;
  private count = 0;
  private stores: Store<unknown>[] = [];
  private queries: Record<number, Query> = {};
  private res: Record<string, unknown> = {};
  private events: unknown[][] = [];
  private stages: Record<Stage, { name: string; fn: System; key: string }[]> = { input: [], update: [], render: [] };
  private installed: Plugin[] = [];
  /** timstaana-compatible access to resources by string key. */
  readonly resources = { get: (k: string) => this.res[k], set: (k: string, v: unknown) => { this.res[k] = v; } };

  // --- entities ---
  spawn(): Entity {
    let e: Entity;
    if (this.free.length - this.freeHead > REUSE_AFTER) {
      e = this.free[this.freeHead++];
      if (this.freeHead > 256) { this.free.splice(0, this.freeHead); this.freeHead = 0; }
    } else e = this.next++;
    this.alive[e] = true; this.count++; return e;
  }
  despawn(e: Entity) {
    if (!this.alive[e]) return;
    this.alive[e] = false; this.count--; this.free.push(e);
    for (let i = 0; i < this.stores.length; i++) if (this.stores[i]) this.stores[i].remove(e);
  }
  has(e: Entity) { return !!this.alive[e]; }
  get entityCount() { return this.count; }

  // --- components ---
  private store<T>(c: ComponentType<T>): Store<T> {
    return (this.stores[c.id] || (this.stores[c.id] = new Store<unknown>())) as Store<T>;
  }
  set<T>(e: Entity, c: ComponentType<T>, data: T): T { this.store(c).set(e, data); return data; }
  /** Add a tag component (no data). */
  tag(e: Entity, c: ComponentType<true>) { this.store(c).set(e, true); }
  get<T>(e: Entity, c: ComponentType<T>): T | undefined { const s = this.stores[c.id]; return s ? (s.get(e) as T | undefined) : undefined; }
  hasComponent(e: Entity, c: ComponentType<unknown>) { const s = this.stores[c.id]; return !!s && s.has(e); }
  remove(e: Entity, c: ComponentType<unknown>) { const s = this.stores[c.id]; if (s) s.remove(e); }

  // --- queries ---
  /** Every entity that has all the given components. Cached: cheap to call every tick. Don't modify the array. */
  query(a: ComponentType<unknown>, b?: ComponentType<unknown>, c?: ComponentType<unknown>, d?: ComponentType<unknown>): readonly Entity[] {
    // up to 4 component ids packed into one number: no string building on the hot path
    const key = (a.id + 1) + (b ? (b.id + 1) * 1024 : 0) + (c ? (c.id + 1) * 1048576 : 0) + (d ? (d.id + 1) * 1073741824 : 0);
    let q = this.queries[key];
    if (!q) {
      const st = [this.store(a)]; if (b) st.push(this.store(b)); if (c) st.push(this.store(c)); if (d) st.push(this.store(d));
      q = this.queries[key] = { stores: st, versions: st.map(() => -1), entities: [], spare: [], busy: 0 };
    }
    let stale = false;
    for (let i = 0; i < q.stores.length; i++) if (q.versions[i] !== q.stores[i].version) { stale = true; break; }
    if (stale) {
      let smallest = q.stores[0];
      for (let i = 1; i < q.stores.length; i++) if (q.stores[i].dense.length < smallest.dense.length) smallest = q.stores[i];
      // rebuild into the spare buffer (no garbage), or a fresh array while an each() is looping over the current one
      const out = q.busy ? [] : q.spare; out.length = 0;
      for (let i = 0; i < smallest.dense.length; i++) {
        const e = smallest.dense[i]; let ok = true;
        for (let j = 0; j < q.stores.length; j++) if (!q.stores[j].has(e)) { ok = false; break; }
        if (ok) out.push(e);
      }
      if (!q.busy) q.spare = q.entities;
      q.entities = out;
      for (let i = 0; i < q.stores.length; i++) q.versions[i] = q.stores[i].version;
    }
    this.lastQuery = q;
    return q.entities;
  }
  private lastQuery: Query | null = null;

  /** Loop over entities with these components, getting their data. Safe if the callback spawns or despawns. */
  each<A>(a: ComponentType<A>, fn: (e: Entity, a: A) => void): void;
  each<A, B>(a: ComponentType<A>, b: ComponentType<B>, fn: (e: Entity, a: A, b: B) => void): void;
  each<A, B, C>(a: ComponentType<A>, b: ComponentType<B>, c: ComponentType<C>, fn: (e: Entity, a: A, b: B, c: C) => void): void;
  each<A, B, C, D>(a: ComponentType<A>, b: ComponentType<B>, c: ComponentType<C>, d: ComponentType<D>, fn: (e: Entity, a: A, b: B, c: C, d: D) => void): void;
  each(a: ComponentType<unknown>, b: unknown, c?: unknown, d?: unknown, f?: unknown): void {
    // fixed parameters instead of ...rest: no arguments array per call
    type Fn = (...x: unknown[]) => void; type CT = ComponentType<unknown>;
    let n: number, fn: Fn;
    if (typeof b === 'function') { n = 1; fn = b as Fn; } else if (typeof c === 'function') { n = 2; fn = c as Fn; } else if (typeof d === 'function') { n = 3; fn = d as Fn; } else { n = 4; fn = f as Fn; }
    const tb = n > 1 ? (b as CT) : undefined, tc = n > 2 ? (c as CT) : undefined, td = n > 3 ? (d as CT) : undefined;
    const list = this.query(a, tb, tc, td), q = this.lastQuery!;
    const s0 = this.store(a), s1 = tb ? this.store(tb) : null, s2 = tc ? this.store(tc) : null, s3 = td ? this.store(td) : null;
    q.busy++;
    try {
      for (let i = 0, len = list.length; i < len; i++) {
        const e = list[i];
        const va = s0.get(e); if (va === undefined) continue; // despawned earlier in this loop
        if (n === 1) { fn(e, va); continue; }
        const vb = s1!.get(e); if (vb === undefined) continue;
        if (n === 2) { fn(e, va, vb); continue; }
        const vc = s2!.get(e); if (vc === undefined) continue;
        if (n === 3) { fn(e, va, vb, vc); continue; }
        const vd = s3!.get(e); if (vd === undefined) continue;
        fn(e, va, vb, vc, vd);
      }
    } finally { q.busy--; }
  }

  /** The first entity with these components (handy for singletons like the player), or -1. */
  first(a: ComponentType<unknown>, b?: ComponentType<unknown>, c?: ComponentType<unknown>, d?: ComponentType<unknown>): Entity { const q = this.query(a, b, c, d); return q.length ? q[0] : -1; }

  // --- resources ---
  resource<T>(key: ResourceKey<T> | string): T | undefined { return this.res[typeof key === 'string' ? key : key.key] as T | undefined; }
  setResource<T>(key: ResourceKey<T>, value: T): T { this.res[key.key] = value; return value; }

  // --- events ---
  emit<T>(type: EventType<T>, ev: T) { (this.events[type.id] || (this.events[type.id] = [])).push(ev); }
  read<T>(type: EventType<T>): readonly T[] { return (this.events[type.id] || NONE) as T[]; }
  /** Called by the loop after each update tick. */
  clearEvents() { for (let i = 0; i < this.events.length; i++) { const l = this.events[i]; if (l && l.length) l.length = 0; } }

  // --- systems & plugins ---
  system(stage: Stage, fn: System, name = fn.name || 'system') { this.stages[stage].push({ name, fn, key: stage + ':' + name }); return this; }
  /** Set to {} to time every system (ms summed per name); the dev HUD logs the top ones. */
  profile: Record<string, number> | null = null;
  run(stage: Stage, dt: number) {
    const list = this.stages[stage], prof = this.profile;
    if (!prof) { for (let i = 0; i < list.length; i++) list[i].fn(this, dt); return; }
    for (let i = 0; i < list.length; i++) {
      const t0 = performance.now(); list[i].fn(this, dt);
      const k = list[i].key; prof[k] = (prof[k] || 0) + performance.now() - t0;
    }
  }
  systemNames(stage: Stage) { return this.stages[stage].map((s) => s.name); }
  /** Install plugins once each (a plugin used twice, e.g. by two other plugins, only runs the first time). */
  use(...plugins: Plugin[]) {
    for (const p of plugins) { if (this.installed.indexOf(p) >= 0) continue; this.installed.push(p); p(this); }
    return this;
  }
}
const NONE: unknown[] = [];

/** timstaana-compatible: run systems in order. */
export function runSystems(world: World, systems: System[], dt: number) { for (let i = 0; i < systems.length; i++) systems[i](world, dt); }

/** Make a plugin that installs at most once per world even when created twice: definePlugin('drag', (w) => ...). */
export function definePlugin<O = void>(name: string, install: (world: World, options: O) => void): (options?: O) => Plugin {
  return (options?: O) => {
    const p: Plugin = (w) => { if (w.resource('plugin:' + name)) return; w.resources.set('plugin:' + name, true); install(w, options as O); };
    p.pluginName = name;
    return p;
  };
}
