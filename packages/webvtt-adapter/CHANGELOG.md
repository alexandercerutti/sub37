# @sub37/webvtt-adapter

## **2.1.0** (30 Jun 2026)

- Added support to default class names to make color appear (#20)

---

## **2.0.0** (19 Jun 2026)

This release introduces some breaking changes. Refer to [Migration guide](https://github.com/alexandercerutti/sub37/wiki/Migrating-from-v1-to-v2) for all the details. This version requires upgrading all the packages to `v2.0.0`.

---

## **1.1.1** (12 Feb 2025)

**Bug fix**:

- Fixed subtle broken styles not being reported and making crash everything without a clear information. Now more cases are handled and, in case of style failure, a message is reported as warning. Crashing styles will be ignored in that case;

---

## **1.1.0** (10 Feb 2025)

**Changes**:

- Added missing exclusion of cues with the same ids, when available, with error emission;

---

## **1.0.4** (08 Feb 2024)

**Changes**:

- Generic improvements;

---

## **1.0.3** (17 Feb 2024)

**Changes**:

- Improved Region's `regionanchor` and `viewportanchor` parsing and forced them to be provided as percentages, as specified by the standard;

**Bug fix**:

- Fixed wrong styles being mistakenly assigned when a wrong CSS selector was specified (#12);

---

## **1.0.0**

- First version released
