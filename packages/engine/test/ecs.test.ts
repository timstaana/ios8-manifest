import { describe, it, expect } from 'vitest';
import { World, component, event, resource, definePlugin, runSystems } from '../src/ecs';

const Pos = component<{ x: number; y: number }>('Pos');
const Vel = component<{ vx: number; vy: number }>('Vel');
const Tag = component('Tag');

describe('World', () => {
  it('spawns, sets, gets and despawns', () => {
    const w = new World();
    const a = w.spawn(), b = w.spawn();
    w.set(a, Pos, { x: 1, y: 2 });
    expect(w.get(a, Pos)).toEqual({ x: 1, y: 2 });
    expect(w.get(b, Pos)).toBeUndefined();
    expect(w.entityCount).toBe(2);
    w.despawn(a);
    expect(w.has(a)).toBe(false);
    expect(w.get(a, Pos)).toBeUndefined();
    expect(w.entityCount).toBe(1);
  });

  it('queries entities with all components, and refreshes the cache when components change', () => {
    const w = new World();
    const a = w.spawn(), b = w.spawn(), c = w.spawn();
    w.set(a, Pos, { x: 0, y: 0 }); w.set(a, Vel, { vx: 1, vy: 0 });
    w.set(b, Pos, { x: 0, y: 0 });
    w.set(c, Vel, { vx: 0, vy: 0 });
    expect([...w.query(Pos, Vel)]).toEqual([a]);
    const cached = w.query(Pos, Vel);
    expect(w.query(Pos, Vel)).toBe(cached); // same array while nothing changed
    w.set(b, Vel, { vx: 0, vy: 1 });
    expect([...w.query(Pos, Vel)].sort()).toEqual([a, b]);
    w.remove(a, Vel);
    expect([...w.query(Pos, Vel)]).toEqual([b]);
  });

  it('each() passes component data and survives despawns during the loop', () => {
    const w = new World();
    const ids = [w.spawn(), w.spawn(), w.spawn()];
    ids.forEach((e, i) => { w.set(e, Pos, { x: i, y: 0 }); w.set(e, Vel, { vx: 10, vy: 0 }); });
    const seen: number[] = [];
    w.each(Pos, Vel, (e, p, v) => { p.x += v.vx; seen.push(e); if (e === ids[0]) w.despawn(ids[1]); });
    expect(seen).not.toContain(ids[1]);
    expect(w.get(ids[0], Pos)!.x).toBe(10);
    expect(w.get(ids[2], Pos)!.x).toBe(12);
  });

  it('swap-remove keeps the other entities intact', () => {
    const w = new World();
    const es = Array.from({ length: 50 }, () => w.spawn());
    es.forEach((e, i) => w.set(e, Pos, { x: i, y: 0 }));
    for (let i = 0; i < 50; i += 3) w.despawn(es[i]);
    es.forEach((e, i) => expect(w.get(e, Pos)?.x).toBe(i % 3 === 0 ? undefined : i));
    expect(w.query(Pos).length).toBe(50 - 17);
  });

  it('tags, first(), resources and events', () => {
    const w = new World();
    const e = w.spawn(); w.tag(e, Tag);
    expect(w.first(Tag)).toBe(e);
    const R = resource<{ n: number }>('r');
    w.setResource(R, { n: 3 });
    expect(w.resource(R)!.n).toBe(3);
    expect(w.resource('r')).toEqual({ n: 3 }); // timstaana-style string key
    const Hit = event<{ e: number }>('Hit');
    w.emit(Hit, { e }); w.emit(Hit, { e: 99 });
    expect(w.read(Hit).length).toBe(2);
    w.clearEvents();
    expect(w.read(Hit).length).toBe(0);
  });

  it('runs systems by stage, and installs a plugin once', () => {
    const w = new World(); const log: string[] = [];
    let installs = 0;
    const P = definePlugin('p', (world) => { installs++; world.system('update', () => log.push('u')); world.system('render', () => log.push('r')); });
    w.use(P(), P());
    w.run('update', 1 / 30); w.run('render', 0);
    expect(installs).toBe(1);
    expect(log).toEqual(['u', 'r']);
    runSystems(w, [() => log.push('x')], 0);
    expect(log).toEqual(['u', 'r', 'x']);
  });
});

describe('entity churn (trails, particles)', () => {
  it('reuses despawned ids, so ids stay bounded however many are spawned', () => {
    const w = new World(); const Pos = component<{ x: number }>('Pos');
    let maxId = 0; const live: number[] = [];
    for (let i = 0; i < 5000; i++) {
      const e = w.spawn(); w.set(e, Pos, { x: i }); live.push(e); maxId = Math.max(maxId, e);
      if (live.length > 40) w.despawn(live.shift()!);
    }
    expect(maxId).toBeLessThan(200);
    expect(w.query(Pos).length).toBe(40);
  });

  it('a reused id starts with no components', () => {
    const w = new World(); const Pos = component<{ x: number }>('Pos'), Tag = component('Tag');
    const first = w.spawn(); w.set(first, Pos, { x: 1 }); w.tag(first, Tag); w.despawn(first);
    let again = -1; for (let i = 0; i < 200 && again !== first; i++) { again = w.spawn(); if (again !== first) w.despawn(again); }
    expect(again).toBe(first);
    expect(w.get(again, Pos)).toBeUndefined();
    expect(w.hasComponent(again, Tag)).toBe(false);
  });

  it('each() is safe when the callback spawns and runs a nested query', () => {
    const w = new World(); const Pos = component<{ x: number }>('Pos');
    for (let i = 0; i < 5; i++) w.set(w.spawn(), Pos, { x: i });
    const seen: number[] = [];
    w.each(Pos, (_e, p) => { seen.push(p.x); if (p.x < 5) w.set(w.spawn(), Pos, { x: 100 + p.x }); void w.query(Pos).length; });
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    expect(w.query(Pos).length).toBe(10);
  });
});

describe('each() under heavy change', () => {
  it('visits every original entity once even when the callback despawns, spawns and re-queries many times', () => {
    const w = new World(); const Pos = component<{ x: number }>('Pos');
    const ids: number[] = []; for (let i = 0; i < 20; i++) { const e = w.spawn(); w.set(e, Pos, { x: i }); ids.push(e); }
    const seen: number[] = [];
    w.each(Pos, (e, p) => {
      seen.push(p.x);
      if (p.x % 3 === 0) { const victim = ids[(ids.indexOf(e) + 7) % ids.length]; if (w.has(victim)) w.despawn(victim); } // reorders the store
      w.set(w.spawn(), Pos, { x: 1000 }); void w.query(Pos).length; void w.query(Pos).length;
    });
    expect(seen.filter((x) => x === 1000)).toHaveLength(0); // new ones aren't visited mid-loop
    expect(new Set(seen).size).toBe(seen.length); // nobody visited twice
    for (const x of seen) expect(x).toBeLessThan(20);
  });
});
