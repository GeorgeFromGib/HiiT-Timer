1. Implement a **dynamic treadmill cooldown speed and incline taper-down** for the cooldown phase.

### Core requirement

When a treadmill workout transitions into the **Cooldown** phase, determine the **last treadmill speed from the phase immediately preceding the cooldown**.

Use that speed as the reference speed for the entire cooldown taper.

**Important:** Do not use the user's original/max workout speed. The reference speed must be the speed of the **last phase immediately before the cooldown begins**.

---

## Speed taper-down algorithm

Let:

```text
baseSpeed = speed of the last phase before cooldown
cooldownDuration = total duration of the cooldown
```

The cooldown should progressively reduce speed according to these percentages of `baseSpeed`:

| Cooldown progress |         Target speed |
| ----------------- | -------------------: |
| 0%                |     65% of baseSpeed |
| 25%               |     55% of baseSpeed |
| 50%               |     50% of baseSpeed |
| 75%               |     45% of baseSpeed |
| 100%              | **40% of baseSpeed** |

The **final cooldown speed must never be lower than 40% of the last phase's speed**.

Therefore:

```text
minimumSpeed = baseSpeed * 0.40
```

At every point during the cooldown:

```text
speed >= minimumSpeed
```

### Speed interpolation

Do not make the speed jump abruptly between these points.

Linearly interpolate the speed between each pair of checkpoints.

For example, with a 10-minute cooldown and a preceding phase speed of 12 km/h:

```text
Base speed = 12 km/h

0:00   → 7.80 km/h  (65%)
2:30   → 6.60 km/h  (55%)
5:00   → 6.00 km/h  (50%)
7:30   → 5.40 km/h  (45%)
10:00  → 4.80 km/h  (40%)
```

The treadmill speed should therefore continuously taper down throughout the cooldown.

---

## Incline cooldown behaviour

The treadmill **incline must also be reduced to 0% during the cooldown**.

The cooldown should not retain the incline from the final running phase.

Use the following rule:

```text
cooldownStartIncline = incline of the final phase before cooldown
cooldownEndIncline = 0%
```

The incline should **smoothly taper down from the starting incline to 0% over the cooldown duration**.

For example, if the final running phase is:

```text
Speed = 12 km/h
Incline = 8%
Cooldown = 10 minutes
```

then the cooldown should approximately follow:

| Cooldown progress |          Speed |             Incline |
| ----------------- | -------------: | ------------------: |
| 0%                | 65% = 7.8 km/h | 8% → begin reducing |
| 25%               | 55% = 6.6 km/h |                  6% |
| 50%               | 50% = 6.0 km/h |                  4% |
| 75%               | 45% = 5.4 km/h |                  2% |
| 100%              | 40% = 4.8 km/h |              **0%** |

The incline should be **linearly interpolated** between these points, just like the speed.

If the starting incline is already 0%, it should simply remain at 0%.

The final cooldown state must always be:

```text
incline = 0%
speed >= 40% of baseSpeed
```

---

## Important implementation details

1. **Capture the reference values when cooldown starts**

   * At the moment the workout transitions into cooldown, identify the speed and incline of the phase immediately before cooldown.
   * Store these as `baseSpeed` and `baseIncline`.
   * Do not subsequently recalculate them during the cooldown.

2. **Variable cooldown duration**

   * The algorithm must work for any cooldown duration.
   * Do not hard-code minute values.
   * Calculate checkpoint times as percentages of the total cooldown duration.

3. **Speed floor**

   * Speed must never fall below `baseSpeed × 0.40`.
   * The final speed should be exactly 40% unless an existing application constraint requires a higher practical minimum.

4. **Incline floor**

   * Incline must never be below 0%.
   * The final incline must be exactly 0%.

5. **Existing treadmill constraints**

   * Apply the application's existing speed precision/rounding rules.
   * Apply the application's existing treadmill minimum/maximum speed limits.
   * Apply the application's existing incline precision/range rules.
   * Do not introduce new treadmill limits unless required.

6. **Units**

   * The calculation must work identically whether the application uses km/h or mph.
   * Speed percentages are unit-independent.

7. **Existing workout behaviour**

   * Do not change how normal treadmill phases work.
   * Do not change manually specified speeds or inclines for normal workout phases.
   * Only the **Cooldown** phase should use this automatic taper-down behaviour.

8. **Cooldown transition**

   * When entering cooldown, speed should transition from the previous phase speed to 65% of that speed.
   * Incline should begin transitioning from the previous phase's incline toward 0%.
   * Avoid abrupt changes where possible.

9. **Final cooldown state**

At the end of cooldown:

```text
speed = max(baseSpeed * 0.40, existingMinimumSpeed)
incline = 0%
```

---

## Example

If the final workout phase before cooldown is:

```text
Speed = 10 km/h
Incline = 6%
Cooldown = 5 minutes
```

then the cooldown should approximately be:

| Time |        Speed | Incline |
| ---- | -----------: | ------: |
| 0:00 |     6.5 km/h |      6% |
| 1:15 |     5.5 km/h |    4.5% |
| 2:30 |     5.0 km/h |      3% |
| 3:45 |     4.5 km/h |    1.5% |
| 5:00 | **4.0 km/h** |  **0%** |

---

## Edge cases

Please consider:

* No preceding treadmill phase / no valid speed.
* The preceding phase has a speed of zero.
* The preceding phase has 0% incline.
* Very short cooldowns.
* Very long cooldowns.
* Speed values requiring rounding.
* Incline values requiring rounding.
* Existing treadmill minimum/maximum speed restrictions.
* Existing treadmill incline restrictions.
* A workout where the phase immediately before cooldown is changed dynamically.

If there is no valid preceding speed, **fall back to the application's existing cooldown-speed behaviour** rather than producing an invalid speed.

If there is no valid preceding incline, default the cooldown incline to **0%**.

---

## Testing

Add or update tests covering at least:

1. 10 km/h / 6% preceding phase with a 5-minute cooldown.
2. 12 km/h / 8% preceding phase with a 10-minute cooldown.
3. A different preceding speed to verify the calculation is relative to the **last phase**, not a global/max speed.
4. Verification that speed never drops below 40% of `baseSpeed`.
5. Verification that incline always reaches 0%.
6. Verification that incline never becomes negative.
7. Verification that different cooldown durations produce the same percentage-based taper.
8. Verification of the fallback behaviour when no valid preceding speed exists.
9. Verification of behaviour when the preceding incline is already 0%.
10. Verification of speed and incline rounding according to the application's existing treadmill rules.

Before implementing, inspect the existing cooldown and treadmill-phase code and integrate this into the current architecture rather than creating a parallel cooldown system.


2. Check the code fro the time, speed and incline picker controls. somtime the scroller doent pick up correctly what is already set up in the input box.


3. need to check that if by changing the rounds then the session length has to be updates.
