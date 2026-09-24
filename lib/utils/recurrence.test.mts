import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isUpcoming,
  nextWeeklyOccurrence,
  occursOnLocalDay,
  zonedParts,
} from "./recurrence.ts";

const SAT_9AM = "2026-06-13T16:00:00.000Z"; // Sat Jun 13, 2026, 9:00 AM PDT
const SUN_9AM = "2026-06-14T16:00:00.000Z"; // Sun Jun 14, 2026, 9:00 AM PDT
const WED_7PM = "2026-06-18T02:00:00.000Z"; // Wed Jun 17, 2026, 7:00 PM PDT
const THU_SEPT = new Date("2026-09-24T15:00:00.000Z");

describe("nextWeeklyOccurrence", () => {
  it("rolls weekly services forward from a Thursday in September", () => {
    assert.equal(nextWeeklyOccurrence(SAT_9AM, THU_SEPT).toISOString(), "2026-09-26T16:00:00.000Z");
    assert.equal(nextWeeklyOccurrence(SUN_9AM, THU_SEPT).toISOString(), "2026-09-27T16:00:00.000Z");
    assert.equal(nextWeeklyOccurrence(WED_7PM, THU_SEPT).toISOString(), "2026-10-01T02:00:00.000Z");
  });

  it("keeps today's service during the 12-hour grace window", () => {
    const during = new Date("2026-09-27T20:00:00.000Z"); // Sunday 1:00 PM PDT
    assert.equal(nextWeeklyOccurrence(SUN_9AM, during).toISOString(), "2026-09-27T16:00:00.000Z");
  });

  it("advances to the following week after the grace window", () => {
    const after = new Date("2026-09-28T05:00:00.000Z"); // Sunday 10:00 PM PDT
    assert.equal(nextWeeklyOccurrence(SUN_9AM, after).toISOString(), "2026-10-04T16:00:00.000Z");
  });

  it("keeps 9:00 AM local after daylight saving time ends", () => {
    const afterDst = new Date("2026-11-02T18:00:00.000Z"); // Monday after the fall-back
    const next = nextWeeklyOccurrence(SUN_9AM, afterDst);
    assert.equal(next.toISOString(), "2026-11-08T17:00:00.000Z");
    assert.equal(zonedParts(next).hour, 9);
    assert.equal(zonedParts(next).weekday, 0);
  });
});

describe("isUpcoming", () => {
  it("keeps recurring gatherings and drops past one-off events", () => {
    assert.equal(isUpcoming({ start: SAT_9AM, recurrence: "Every Saturday" }, THU_SEPT), true);
    assert.equal(isUpcoming({ start: "2026-07-04T17:00:00.000Z" }, THU_SEPT), false);
    assert.equal(isUpcoming({ start: "2026-10-04T17:00:00.000Z" }, THU_SEPT), true);
  });
});

describe("occursOnLocalDay", () => {
  it("paints a weekly service on matching church-local weekdays after it starts", () => {
    assert.equal(occursOnLocalDay({ start: SUN_9AM, recurrence: "Every Sunday" }, 2026, 9, 27), true);
    assert.equal(occursOnLocalDay({ start: SUN_9AM, recurrence: "Every Sunday" }, 2026, 9, 28), false);
    assert.equal(occursOnLocalDay({ start: SUN_9AM, recurrence: "Every Sunday" }, 2026, 6, 7), false);
    assert.equal(occursOnLocalDay({ start: WED_7PM, recurrence: "Every Wednesday" }, 2026, 9, 30), true);
  });

  it("pins a one-off event to its church-local day", () => {
    assert.equal(occursOnLocalDay({ start: "2026-07-04T17:00:00.000Z" }, 2026, 7, 4), true);
    assert.equal(occursOnLocalDay({ start: "2026-07-04T17:00:00.000Z" }, 2026, 7, 5), false);
  });
});
