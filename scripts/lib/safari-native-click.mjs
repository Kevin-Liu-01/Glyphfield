import assert from 'node:assert/strict';

// Observe only this owned WebDriver click; never synthesize DOM input or retry
// a failed click that could already have caused a user-visible action.
export async function nativePointerClick(harness, point, selector = null) {
  const key = 'glyphfield-safari-owned-click';
  await harness.evaluate((key, selector, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    const target = selector ? document.querySelector(selector) : hit?.closest('button, .project-tab, a, [role="button"]') ?? hit;
    const log = { selector, point, focusedBefore: document.hasFocus(), events: [] };
    const record = (event) => {
      log.events.push({ type: event.type, trusted: event.isTrusted, withinTarget: Boolean(target?.contains(event.target)),
        label: event.target.closest?.('[aria-label]')?.getAttribute('aria-label') ?? event.target.tagName,
        x: event.clientX, y: event.clientY });
    };
    const events = ['pointerdown', 'mousedown', 'click'];
    events.forEach((event) => document.addEventListener(event, record, true));
    document[Symbol.for(key)] = { log, cleanup: () => events.forEach((event) => document.removeEventListener(event, record, true)) };
  }, key, selector, point);
  let telemetry;
  try {
    await harness.actions(harness.mouse([harness.pointerMove(point.x, point.y), harness.pointerDown, harness.pointerUp]));
  } finally {
    telemetry = await harness.evaluate((key) => {
      const probe = document[Symbol.for(key)];
      probe.cleanup();
      const log = { ...probe.log, focusedAfter: document.hasFocus() };
      document.documentElement.dataset.safariLastClick = JSON.stringify(log);
      delete document[Symbol.for(key)];
      return log;
    }, key);
  }
  assert(telemetry.events.some((event) => event.type === 'click' && event.trusted),
    `Native Safari delivered no trusted click; input delivery is invalid: ${JSON.stringify(telemetry)}`);
  assert(telemetry.events.some((event) => event.type === 'click' && event.withinTarget),
    `Native Safari click missed the expected hit target: ${JSON.stringify(telemetry)}`);
}
