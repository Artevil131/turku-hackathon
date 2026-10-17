"""D-061 public methods: fixture-only parity against the actual live TS gears.

No organiser data, package manager or server required. A local Node resolver
maps workspace @aei/* imports to their source, without rewriting any gear.
"""

import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from aei import methods
from aei.dates import add_days
from aei.jscompat import mulberry32

ROOT = Path(__file__).resolve().parents[4]

SCRIPT = """
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
registerHooks({ resolve(s, c, next) {
  if (s.startsWith('@aei/')) return {
    url: pathToFileURL(process.cwd() + '/libs/utils/' + s.slice(5) + '/src/index.ts').href,
    shortCircuit: true
  };
  return next(s, c);
}});
const d = await import('./libs/utils/detect/src/index.ts');
const c = await import('./libs/utils/coverage/src/index.ts');
const a = await import('./libs/utils/alerts/src/index.ts');
const calls = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const out = calls.map(({method, rows, cultures, options: o = {}, result, severity, limit, wards}) => {
  switch (method) {
    case 'profile_excess': return d.profileExcess(rows, {...d.LIVE_SETTINGS.profileExcess, ...o});
    case 'phenotype_excess': return d.phenotypeExcess(rows, ['esbl', 'mrsa', 'vre', 'cpe'], {...d.LIVE_SETTINGS.phenotypeExcess, ...o});
    case 'sampling_drop': return d.samplingDrop(rows, {...d.LIVE_SETTINGS.samplingDrop, ...o});
    case 'empty_run': return d.emptyRun(rows, {...d.LIVE_SETTINGS.emptyRun, ...o});
    case 'rising_trend': return d.risingTrend(rows, d.SURVEILLANCE_PAIRS, {...d.LIVE_SETTINGS.risingTrend, ...o});
    case 'live_signals': return d.liveSignals(rows, cultures);
    case 'cpe_alerts': return a.cpeAlerts(rows, o.window);
    case 'new_in_unit_alerts': return a.newInUnitAlerts(rows, undefined, o.lookbackDays, wards);
    case 'coverage': return c.coverage(rows, o, wards);
    case 'suggest': return c.suggest(result, severity);
    case 'suggest_combinations': return c.suggestCombinations(result, severity, limit);
  }
  throw new Error(method);
});
console.log(JSON.stringify(out));
"""


def isolate(i, day=0, **changes):
    row = dict(isolateId=f'I{i:05d}', cultureId=f'C{i:05d}', patientId=f'P{i:05d}',
        sampleDate=add_days('2024-01-01', day), admissionDate=None, ward='URO',
        specimen='urine', organism='Escherichia coli', sex='F', ageYears=45,
        homeArea='Turku', phenotypes=[], results={'AMP': 'S', 'CIP': 'S'})
    return {**row, **changes}


def culture(i, day, ward='URO'):
    return dict(cultureId=f'C{i:05d}', patientId=f'P{i:05d}', sampleDate=add_days('2024-01-01', day),
        admissionDate=None, ward=ward, wardType='in', specimen='urine', result='negative',
        isoYear=2024, isoWeek=1, ageYears=45)


def synthetic():
    rand = mulberry32(20261017)
    records = []
    for day in range(448):
        for j in range(3):
            resistant = rand() < (0.01 if day < 200 else 0.1 + (day - 200) / 350)
            records.append(isolate(len(records), day, ward='URO' if j < 2 else 'MED-A',
                sex='F' if rand() < 0.6 else 'M', ageYears=int(rand() * 100),
                results={'AMP': 'R' if resistant else 'S', 'CIP': 'S', 'CRO': 'S'},
                phenotypes=['esbl'] if day > 430 and j < 2 else []))
    # Rare identical resistant clone following a baseline with no such profile.
    records.extend(isolate(2000 + j, 430 + j, results={'AMP': 'R', 'CIP': 'R'}, phenotypes=['cpe']) for j in range(6))
    cultures = [culture(day * 4 + j, day) for day in range(100) for j in range(4) if day < 80]
    cultures.append(culture(999, 100, 'MED-A'))  # advances the history past URO's gap
    return records, cultures


def cases():
    records, cultures = synthetic()
    out = []
    iso_sets = {'empty': [], 'single': [isolate(0, phenotypes=['cpe', 'mrsa'])],
        'ties': [isolate(2, patientId='P', results={'AMP': 'R'}), isolate(1, patientId='P')],
        'seeded': records}
    for method in ('profile_excess', 'phenotype_excess', 'rising_trend', 'cpe_alerts', 'new_in_unit_alerts'):
        for name, rows in iso_sets.items():
            out.append(dict(id=f'{method}-{name}', method=method, rows=rows))
    for method in ('sampling_drop', 'empty_run'):
        for name, rows in {'empty': [], 'single': [culture(0, 0)], 'seeded-gap': cultures,
            'zero-baseline': [culture(0, 0, 'MED-A'), culture(1, 80)],
            'ties': [culture(0, 0), culture(1, 0), culture(2, 80, 'MED-A')]}.items():
            out.append(dict(id=f'{method}-{name}', method=method, rows=rows))
    for name, rows in iso_sets.items():
        out.append(dict(id=f'live-{name}', method='live_signals', rows=rows, cultures=cultures if name == 'seeded' else []))
    # Same data at two hospitals: hospital trends must not pool them, and the
    # non-home hospital has its own trend key/site in the combined live set.
    remote = [{**r, 'ward': 'sata/' + r['ward'], 'patientId': 's' + r['patientId'], 'isolateId': 's' + r['isolateId']} for r in records]
    slow_trend = [isolate(3000 + b * 60 + j, b * 28 + j % 28,
        ward='sata/URO', organism='Proteus mirabilis', results={'CIP': 'R' if j < 30 + b else 'S'})
        for b in range(16) for j in range(60)]
    out.append(dict(id='live-multisite', method='live_signals', rows=remote + records + slow_trend, cultures=cultures))
    for method in ('profile_excess', 'phenotype_excess'):
        for n_base in (0, 49, 50):
            for n_event in (1, 2, 3):
                rows = [isolate(i, i) for i in range(n_base)]
                rows += [isolate(100 + j, 90, results={'AMP': 'R'}, phenotypes=['esbl']) for j in range(n_event)]
                out.append(dict(id=f'{method}-baseline{n_base}-patients{n_event}', method=method, rows=rows))
    # Explicit strict p<alpha boundary: p=1 at a zero-rate empty run is not
    # significant at alpha=1, while a positive baseline gives p<1.
    for alpha in (0, 1):
        for method, rows in [('sampling_drop', cultures), ('empty_run', cultures),
            ('profile_excess', records[-6:]), ('phenotype_excess', records[-6:]), ('rising_trend', records)]:
            out.append(dict(id=f'{method}-alpha{alpha}', method=method, rows=rows, options={'alpha': alpha}))
    for bins in (12, 13, 14):
        out.append(dict(id=f'trend-bins{bins}', method='rising_trend', rows=[r for r in records if r['sampleDate'] <= add_days('2024-01-01', bins * 28 - 1)]))
    sentinels = [isolate(0, organism='Staphylococcus aureus', phenotypes=['mrsa'])]
    sentinels += [isolate(i, day, organism='Staphylococcus aureus', phenotypes=['mrsa', 'vre']) for i, day in enumerate((179, 180, 360, 541), 1)]
    sentinels += [isolate(19, 180, ward='MED-A', phenotypes=['mrsa']),
        isolate(20, 181, ward='ED', phenotypes=['mrsa']), isolate(21, 700, ward='sata/URO', phenotypes=['vre'])]
    registry = [{'code': w, 'type': t} for w, t in [('URO', 'in'), ('MED-A', 'in'), ('ED', 'out'), ('sata/URO', 'in')]]
    out.append(dict(id='sentinel-gap-boundaries-sites', method='new_in_unit_alerts', rows=sentinels, wards=registry))
    out.append(dict(id='cpe-window', method='cpe_alerts', rows=records, options={'window': {'from': add_days('2024-01-01', 431), 'to': add_days('2024-01-01', 433)}}))

    query = dict(asOf='2025-03-23', ward='URO', specimen='urine')
    coverage_sets = {**iso_sets, 'multisite': remote + records}
    coverage_sets['ward-type-fallback'] = [isolate(i, 440, ward='URO' if i < 10 else 'MED-A') for i in range(35)]
    coverage_sets['hospital-fallback'] = [isolate(i, 440, ward='URO' if i < 10 else 'ED') for i in range(40)]
    # Floors, first-isolate ties, annual/recent boundaries and mixed EUCAST
    # bases (intrinsic, no breakpoint, inferred, untested).
    for n in (29, 30, 31):
        coverage_sets[f'floor{n}'] = [isolate(i, 440, results={'AMP': 'S' if i % 2 else 'R'}) for i in range(n)]
    coverage_sets['eucast'] = [isolate(i, 440, organism=o, results={}) for i, o in enumerate(
        ['Escherichia coli', 'Staphylococcus aureus', 'Enterococcus faecalis', 'Proteus mirabilis'] * 10)]
    coverage_sets['window-ties'] = [isolate(1, d, patientId='P') for d in (82, 83, 420, 421, 447, 448)] + [isolate(0, 83, patientId='P', results={'AMP': 'R'})]
    for name, rows in coverage_sets.items():
        for extra in ({}, {'sex': 'F', 'ageGroup': 'older', 'onset': 'hospital'}, {'minTested': 1}):
            q = {**query, **extra}
            tag = f'coverage-{name}-{len(out)}'
            out.append(dict(id=tag, method='coverage', rows=rows, options=q, wards=registry))
            # Inputs to both suggestion gears are the *same* coverage object.
            result = methods.coverage(rows, **{_snake(k): v for k, v in q.items()}, wards=registry)
            for severity in ('mild', 'severe'):
                out.append(dict(id=tag + '-' + severity, method='suggest', result=result, severity=severity))
                out.append(dict(id=tag + '-pairs-' + severity, method='suggest_combinations', result=result, severity=severity))
    # All four age thresholds and drop order stages, keeping sex last.
    for age in (17, 18, 64, 65, 79, 80):
        rows = [isolate(i, 440, ageYears=age, admissionDate=add_days('2024-01-01', 438)) for i in range(30)]
        for group in ('child', 'adult', 'older', 'veryOld'):
            out.append(dict(id=f'age-{age}-{group}', method='coverage', rows=rows,
                options={**query, 'ageGroup': group, 'sex': 'F', 'onset': 'hospital'}))
    # Standing boundaries and stable ties, including no AWaRe tier (D-056).
    result = methods.coverage([], as_of=query['asOf'], ward='URO', specimen='blood')
    for row in result['antibiotics']:
        row.update(share=0.9, interval=[0.9, 1], untested=[])
        row['spectrum'].update(share=0.8, interval=[0.8, 1])
    result['antibiotics'][0]['share'] = 0.95
    for untested in (0.2, 0.200000001):
        r = copy.deepcopy(result)
        r['antibiotics'][0]['untested'] = [{'organism': 'Escherichia coli', 'share': untested}]
        for severity in ('mild', 'severe'):
            out.append(dict(id=f'standing-boundary-{untested}-{severity}', method='suggest', result=r, severity=severity))
    # Pair gain at/just below two points, no single agent clearing.
    for gain in (1, 2):
        r = copy.deepcopy(result)
        for row in r['antibiotics']:
            row.update(share=0.89, interval=[0.8, 0.95])
        for pair in r['combinations']:
            pair.update(share=0.91, interval=[0.85, 0.97], counts={'covered': 91, 'known': 100}, alone=[91 - gain, 80], untested=0.2)
        for limit in (0, 1, 5):
            out.append(dict(id=f'pair-gain-{gain}-limit{limit}', method='suggest_combinations', result=r, severity='severe', limit=limit))
    return out


def _snake(key):
    return ''.join('_' + c.lower() if c.isupper() else c for c in key)


CASES = cases()


@pytest.fixture(scope='module')
def ts_results(tmp_path_factory):
    node = shutil.which('node')
    if node is None:
        pytest.skip('Node is unavailable')
    path = tmp_path_factory.mktemp('methods-parity') / 'input.json'
    path.write_text(json.dumps(CASES), encoding='utf-8')
    run = subprocess.run([node, '--experimental-strip-types', '--input-type=module', '-e', SCRIPT, str(path)],
        cwd=ROOT, text=True, capture_output=True, timeout=40)
    assert run.returncode == 0, run.stderr
    return dict(zip((c['id'] for c in CASES), json.loads(run.stdout), strict=True))


def assert_same(actual, expected, path='result'):
    if isinstance(expected, dict):
        assert actual.keys() == expected.keys(), path
        for key in expected:
            assert_same(actual[key], expected[key], f'{path}.{key}')
    elif isinstance(expected, list):
        assert len(actual) == len(expected), path
        for i, (a, e) in enumerate(zip(actual, expected, strict=True)):
            assert_same(a, e, f'{path}[{i}]')
    elif isinstance(expected, bool):
        assert actual is expected, path
    elif isinstance(expected, float):
        assert actual == pytest.approx(expected, rel=1e-12, abs=0), path
    else:
        assert actual == expected, path


@pytest.mark.parametrize('case', CASES, ids=lambda c: c['id'])
def test_public_method_parity(case, ts_results):
    method = case['method']
    options = {_snake(k): v for k, v in case.get('options', {}).items()}
    if 'wards' in case:
        options['wards'] = case['wards']
    if method == 'live_signals':
        actual = methods.live_signals(case['rows'], case['cultures'])
    elif method in ('suggest', 'suggest_combinations'):
        actual = getattr(methods, method)(case['result'], case['severity'], **({'limit': case['limit']} if 'limit' in case else {}))
    else:
        actual = getattr(methods, method)(case['rows'], **options)
    assert_same(json.loads(json.dumps(actual)), ts_results[case['id']])


def test_every_public_method_has_parity():
    assert set(methods.__all__) == {c['method'] for c in CASES}


def test_seeded_fixtures_exercise_every_statistical_detector(ts_results):
    for name in ('profile_excess', 'phenotype_excess', 'rising_trend'):
        assert ts_results[f'{name}-seeded'], name
    for name in ('sampling_drop', 'empty_run'):
        assert ts_results[f'{name}-seeded-gap'], name
    assert any(s.get('site') == 'sata' for s in ts_results['live-multisite'])
    assert ts_results['pair-gain-2-limit5']
    assert not ts_results['pair-gain-1-limit5']
