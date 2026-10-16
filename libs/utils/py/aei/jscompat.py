"""JavaScript number formatting, rounding and the mulberry32 generator, so that ports of the
TypeScript experiments print the same tables and draw the same random numbers.

    to_fixed(12.25, 1) == "12.3"      # Number.prototype.toFixed: half away from zero on the exact value
    js_round(-2.5) == -2              # Math.round: half toward +infinity
    rand = mulberry32(2026); rand()   # same sequence as the TypeScript mulberry32
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from decimal import ROUND_HALF_UP, Decimal


def to_fixed(x: float, digits: int) -> str:
    """`x.toFixed(digits)`."""
    if math.isnan(x):
        return "NaN"
    if abs(x) >= 1e21:
        return js_str(x)
    sign = "-" if x < 0 else ""
    d = Decimal(abs(x)).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP)
    return f"{sign}{d:f}"


def _significant(x: float, digits: int) -> tuple[str, int]:
    """The first `digits` significant digits of |x| rounded half up, and the decimal exponent of the first."""
    d = Decimal(abs(x))
    e = d.adjusted()
    q = d.quantize(Decimal(1).scaleb(e - digits + 1), rounding=ROUND_HALF_UP)
    if q.adjusted() > e:  # rounded up to the next power of ten
        e += 1
        q = d.quantize(Decimal(1).scaleb(e - digits + 1), rounding=ROUND_HALF_UP)
    return str(int(q.scaleb(digits - 1 - e))), e


def to_exponential(x: float, digits: int) -> str:
    """`x.toExponential(digits)`."""
    if x == 0:
        return "0" + ("." + "0" * digits if digits else "") + "e+0"
    m, e = _significant(x, digits + 1)
    mant = m[0] + ("." + m[1:] if digits else "")
    return f"{'-' if x < 0 else ''}{mant}e{'+' if e >= 0 else '-'}{abs(e)}"


def to_precision(x: float, precision: int) -> str:
    """`x.toPrecision(precision)`."""
    if x == 0:
        return "0" + ("." + "0" * (precision - 1) if precision > 1 else "")
    m, e = _significant(x, precision)
    sign = "-" if x < 0 else ""
    if e < -6 or e >= precision:
        mant = m[0] + ("." + m[1:] if precision > 1 else "")
        return f"{sign}{mant}e{'+' if e >= 0 else '-'}{abs(e)}"
    if e >= 0:
        whole, frac = m[: e + 1], m[e + 1 :]
        return sign + whole + ("." + frac if frac else "")
    return sign + "0." + "0" * (-e - 1) + m


def js_round(x: float) -> int:
    """`Math.round(x)`: nearest integer, halves toward +infinity."""
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def js_str(x: float | int) -> str:
    """`String(x)` for a number: shortest round-trip digits, JavaScript's exponent rules."""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int):
        return str(x)
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    d = Decimal(repr(abs(x)))  # repr gives the shortest round-trip digits, as JavaScript does
    t = d.as_tuple()
    digits = "".join(map(str, t.digits)).rstrip("0") or "0"
    n = d.adjusted() + 1  # position of the decimal point after the first digit
    k = len(digits)
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    e = n - 1
    mant = digits[0] + ("." + digits[1:] if k > 1 else "")
    return f"{sign}{mant}e{'+' if e >= 0 else '-'}{abs(e)}"


def cell(v: object) -> str:
    """A value as `Array.prototype.join` writes it: numbers as `String(x)`, null and undefined empty."""
    if v is None:
        return ""
    if isinstance(v, (int, float)):
        return js_str(v)
    return str(v)


def table(head: Sequence[object], rows: Sequence[Sequence[object]]) -> str:
    """The Markdown table the TypeScript experiments write."""
    lines = [f"| {' | '.join(map(cell, head))} |", f"|{'|'.join('---' for _ in head)}|"]
    lines += [f"| {' | '.join(map(cell, r))} |" for r in rows]
    return "\n".join(lines)


def _imul(a: int, b: int) -> int:
    """`Math.imul`: 32-bit signed product."""
    r = (a * b) & 0xFFFFFFFF
    return r - (1 << 32) if r & 0x80000000 else r


def _i32(a: int) -> int:
    a &= 0xFFFFFFFF
    return a - (1 << 32) if a & 0x80000000 else a


def mulberry32(seed: int) -> Callable[[], float]:
    """The mulberry32 generator of the TypeScript experiments: floats in [0, 1), same sequence for the same seed."""
    state = _i32(seed)

    def rand() -> float:
        nonlocal state
        state = _i32(state + 0x6D2B79F5)
        a = state
        t = _imul(a ^ ((a & 0xFFFFFFFF) >> 15), 1 | a)
        t = _i32(_i32(t + _imul(t ^ ((t & 0xFFFFFFFF) >> 7), 61 | t)) ^ t)
        return ((t ^ ((t & 0xFFFFFFFF) >> 14)) & 0xFFFFFFFF) / 4294967296

    return rand
