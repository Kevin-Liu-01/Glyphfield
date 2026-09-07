type GL = WebGLRenderingContext | WebGL2RenderingContext;

interface TimerExtension {
  CURRENT_QUERY_EXT: number;
  GPU_DISJOINT_EXT: number;
  QUERY_RESULT_AVAILABLE_EXT: number;
  QUERY_RESULT_EXT: number;
  TIME_ELAPSED_EXT: number;
  beginQueryEXT: (target: number, query: WebGLQuery) => void;
  createQueryEXT: () => WebGLQuery | null;
  deleteQueryEXT: (query: WebGLQuery) => void;
  endQueryEXT: (target: number) => void;
  getQueryEXT: (target: number, parameter: number) => unknown;
  getQueryObjectEXT: (query: WebGLQuery, parameter: number) => unknown;
}

interface QueryAdapter {
  available: (query: WebGLQuery) => boolean;
  begin: (query: WebGLQuery) => void;
  busy: () => boolean;
  create: () => WebGLQuery | null;
  delete: (query: WebGLQuery) => void;
  disjoint: () => boolean;
  end: () => void;
  result: (query: WebGLQuery) => number;
}

function queryAdapter(gl: GL): QueryAdapter | null {
  if ('createQuery' in gl) {
    const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!extension) return null;
    const target = extension.TIME_ELAPSED_EXT;
    return {
      available: (query) => Boolean(gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)),
      begin: (query) => gl.beginQuery(target, query),
      busy: () => gl.getQuery(target, gl.CURRENT_QUERY) !== null,
      create: () => gl.createQuery(),
      delete: (query) => gl.deleteQuery(query),
      disjoint: () => Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT)),
      end: () => gl.endQuery(target),
      result: (query) => Number(gl.getQueryParameter(query, gl.QUERY_RESULT)),
    };
  }
  const extension = gl.getExtension('EXT_disjoint_timer_query') as TimerExtension | null;
  if (!extension) return null;
  const target = extension.TIME_ELAPSED_EXT;
  return {
    available: (query) => Boolean(extension.getQueryObjectEXT(query, extension.QUERY_RESULT_AVAILABLE_EXT)),
    begin: (query) => extension.beginQueryEXT(target, query),
    busy: () => extension.getQueryEXT(target, extension.CURRENT_QUERY_EXT) !== null,
    create: () => extension.createQueryEXT(),
    delete: (query) => extension.deleteQueryEXT(query),
    disjoint: () => Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT)),
    end: () => extension.endQueryEXT(target),
    result: (query) => Number(extension.getQueryObjectEXT(query, extension.QUERY_RESULT_EXT)),
  };
}

export interface ShaderGpuTiming {
  status: 'available' | 'unsupported' | 'context-lost';
  pending: number;
  discardedDisjoint: number;
  discardedExpired: number;
  skippedBusy: number;
  milliseconds: number[];
}

/** Diagnostic-only asynchronous GPU queries. Never blocks with finish/readPixels. */
export function createShaderGpuTimer(gl: GL, now = () => performance.now()) {
  const adapter = queryAdapter(gl);
  const timing: ShaderGpuTiming = {
    discardedDisjoint: 0,
    discardedExpired: 0,
    milliseconds: [],
    pending: 0,
    skippedBusy: 0,
    status: adapter ? 'available' : 'unsupported',
  };
  let active: WebGLQuery | null = null;
  let disposed = false;
  let pollFrame = 0;
  const pending: { query: WebGLQuery; startedAt: number }[] = [];

  function discardPending(reason: 'discardedDisjoint' | 'discardedExpired') {
    timing[reason] += pending.length;
    pending.splice(0).forEach(({ query }) => adapter?.delete(query));
    timing.pending = 0;
  }

  function poll() {
    pollFrame = 0;
    if (disposed || !adapter) return;
    if (gl.isContextLost()) {
      timing.status = 'context-lost';
      discardPending('discardedExpired');
      return;
    }
    if (adapter.disjoint()) discardPending('discardedDisjoint');
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const item = pending[index]!;
      if (adapter.available(item.query)) {
        const milliseconds = adapter.result(item.query) / 1_000_000;
        if (Number.isFinite(milliseconds) && milliseconds >= 0) {
          timing.milliseconds.push(milliseconds);
          if (timing.milliseconds.length > 240) timing.milliseconds.shift();
        }
      } else if (now() - item.startedAt > 2_000) {
        timing.discardedExpired += 1;
      } else continue;
      adapter.delete(item.query);
      pending.splice(index, 1);
    }
    timing.pending = pending.length;
    if (pending.length) pollFrame = requestAnimationFrame(poll);
  }

  return {
    begin() {
      if (disposed || !adapter || active || gl.isContextLost()) return false;
      // TIME_ELAPSED queries cannot nest with a profiler or another owner.
      if (pending.length >= 4 || adapter.busy()) {
        timing.skippedBusy += 1;
        return false;
      }
      active = adapter.create();
      if (active) adapter.begin(active);
      return active !== null;
    },
    end() {
      if (!active || !adapter) return;
      adapter.end();
      pending.push({ query: active, startedAt: now() });
      active = null;
      timing.pending = pending.length;
      if (!pollFrame) pollFrame = requestAnimationFrame(poll);
    },
    read(): ShaderGpuTiming {
      return { ...timing, milliseconds: [...timing.milliseconds] };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(pollFrame);
      if (active && adapter) {
        adapter.end();
        adapter.delete(active);
        active = null;
      }
      pending.splice(0).forEach(({ query }) => adapter?.delete(query));
      timing.pending = 0;
    },
  };
}
