import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const ROLES = ['Pilot', 'Cabin Crew', 'Technician', 'Dispatcher'];
const AIRCRAFT_TYPES = ['C172', 'PC-12', 'A320', 'B737', 'B787'];

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const uid = () => crypto.randomUUID();

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function calcOfferQuality(c, e) {
  return Math.round((c.reputation * 0.45) + (c.fleetSize * 6) + (c.hangars * 9) + (e.experience * 0.4));
}

function simulateMission(employee, load = 1) {
  const base = employee.skills + employee.experience + employee.satisfaction - (employee.fatigue * 0.5);
  const volatility = rnd(-20, 20);
  const overloadPenalty = load > 1 ? load * 8 : 0;
  const score = clamp(Math.round(base + volatility - overloadPenalty), 0, 100);
  const incidentChance = clamp(45 - (employee.skills * 0.25) - (employee.experience * 0.2) + employee.fatigue * 0.6 + (100 - employee.satisfaction) * 0.25, 3, 80);
  const incident = Math.random() * 100 < incidentChance;
  return { score, incident, incidentChance: Math.round(incidentChance) };
}

export default function Employees() {
  const [company, setCompany] = useState({ reputation: 62, fleetSize: 5, hangars: 2 });
  const [employees, setEmployees] = useState([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [salaryOffer, setSalaryOffer] = useState(4500);
  const [log, setLog] = useState([]);

  const offers = useMemo(() => {
    const maxOffers = clamp(Math.floor(company.reputation / 20) + company.fleetSize + company.hangars, 2, 15);
    return Array.from({ length: maxOffers }).map(() => ({
      id: uid(),
      name: `Candidate-${rnd(100, 999)}`,
      role: ROLES[rnd(0, ROLES.length - 1)],
      skills: rnd(30, 95),
      experience: rnd(15, 90),
      expectedSalary: rnd(3200, 11000),
      typeRating: AIRCRAFT_TYPES[rnd(0, AIRCRAFT_TYPES.length - 1)],
    }));
  }, [company]);

  const hire = (candidate) => {
    const quality = calcOfferQuality(company, candidate);
    if (quality < 45) return setLog((l) => [`${candidate.name} lehnt ab (zu unattraktiv).`, ...l]);
    setEmployees((p) => [{
      id: uid(),
      name: candidate.name,
      role: candidate.role,
      skills: candidate.skills,
      experience: candidate.experience,
      satisfaction: 75,
      fatigue: 10,
      salary: Math.max(candidate.expectedSalary, salaryOffer),
      typeRatings: [],
      inTraining: false,
      busyUntil: null,
    }, ...p]);
    setLog((l) => [`${candidate.name} wurde eingestellt.`, ...l]);
  };

  const addManual = () => {
    if (!name.trim()) return;
    setEmployees((p) => [{ id: uid(), name, role, skills: rnd(25, 80), experience: rnd(10, 70), satisfaction: 70, fatigue: 15, salary: Number(salaryOffer), typeRatings: [], inTraining: false, busyUntil: null }, ...p]);
    setName('');
  };

  const updateEmployee = (id, fn) => setEmployees((prev) => prev.map((e) => e.id === id ? fn(e) : e));

  const runTraining = (id, type) => updateEmployee(id, (e) => {
    const passed = e.skills + rnd(-15, 20) >= 80;
    const tooMuch = e.fatigue > 70;
    const deltaSat = tooMuch ? -12 : 4;
    setLog((l) => [`${e.name}: ${type} ${passed ? 'bestanden' : 'nicht bestanden'} (${tooMuch ? 'überlastet' : 'normal'}).`, ...l]);
    return { ...e, fatigue: clamp(e.fatigue + 18, 0, 100), satisfaction: clamp(e.satisfaction + deltaSat, 0, 100), typeRatings: passed ? [...new Set([...e.typeRatings, type])] : e.typeRatings };
  });

  const simulateOrder = (id) => updateEmployee(id, (e) => {
    if (e.busyUntil && Date.now() < e.busyUntil) return e;
    const result = simulateMission(e, e.inTraining ? 2 : 1);
    const durationMs = rnd(2, 8) * 60 * 1000;
    setLog((l) => [`Auftrag ${e.name}: Score ${result.score}, Incident ${result.incident ? 'JA' : 'nein'} (${result.incidentChance}%).`, ...l]);
    return {
      ...e,
      busyUntil: Date.now() + durationMs,
      fatigue: clamp(e.fatigue + rnd(8, 22), 0, 100),
      experience: clamp(e.experience + rnd(1, 5), 0, 100),
      satisfaction: clamp(e.satisfaction + (result.incident ? -10 : 3), 0, 100),
    };
  });

  const advanceDynamics = () => {
    setEmployees((prev) => prev.map((e) => {
      const raiseRequest = e.satisfaction > 55 && Math.random() < 0.15;
      if (raiseRequest) setLog((l) => [`${e.name} fordert Gehaltserhöhung.`, ...l]);
      const churn = e.satisfaction < 25 && Math.random() < 0.22;
      if (churn) setLog((l) => [`${e.name} hat gekündigt (niedrige Zufriedenheit).`, ...l]);
      if (churn) return null;
      return {
        ...e,
        fatigue: clamp(e.fatigue - 6, 0, 100),
        satisfaction: clamp(e.satisfaction + (company.reputation > 70 ? 2 : -1) - (e.fatigue > 75 ? 4 : 0), 0, 100),
      };
    }).filter(Boolean));
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Mitarbeiterbereich</h1>
      <Card><CardHeader><CardTitle>Unternehmensfaktoren</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-3 gap-2">
        <Input type="number" value={company.reputation} onChange={(e) => setCompany((c) => ({ ...c, reputation: Number(e.target.value) }))} placeholder="Reputation" />
        <Input type="number" value={company.fleetSize} onChange={(e) => setCompany((c) => ({ ...c, fleetSize: Number(e.target.value) }))} placeholder="Flotte" />
        <Input type="number" value={company.hangars} onChange={(e) => setCompany((c) => ({ ...c, hangars: Number(e.target.value) }))} placeholder="Hangars" />
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Manuell einstellen</CardTitle></CardHeader><CardContent className="flex gap-2 flex-wrap">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="max-w-xs" />
        <select className="bg-slate-900 border rounded px-2" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        <Input type="number" value={salaryOffer} onChange={(e) => setSalaryOffer(Number(e.target.value))} className="max-w-40" />
        <Button onClick={addManual}>Einstellen</Button>
        <Button variant="outline" onClick={advanceDynamics}>Dynamik-Tick</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Jobangebote (abhängig von Reputation/Flotte/Hangar)</CardTitle></CardHeader><CardContent className="space-y-2">
        {offers.slice(0, 5).map((c) => <div key={c.id} className="flex justify-between items-center border rounded p-2"><div>{c.name} | {c.role} | Skill {c.skills} | Exp {c.experience} | Gehaltwunsch ${c.expectedSalary}</div><div className="flex gap-2"><Button size="sm" onClick={() => hire(c)}>Angebot machen</Button><Button size="sm" variant="outline" onClick={() => setLog((l) => [`${c.name} Angebot abgelehnt.`, ...l])}>Ablehnen</Button></div></div>)}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Team</CardTitle></CardHeader><CardContent className="space-y-3">
        {employees.map((e) => {
          const busy = e.busyUntil && Date.now() < e.busyUntil;
          return <div key={e.id} className="border rounded p-3 space-y-2">
            <div className="flex justify-between"><div className="font-semibold">{e.name} <Badge>{e.role}</Badge></div><div>{busy ? 'Beschäftigt im Auftrag' : 'Verfügbar'}</div></div>
            <div className="text-sm">Skill {e.skills} | Erfahrung {e.experience} | Gehalt ${e.salary} | Ratings: {e.typeRatings.join(', ') || 'keine'}</div>
            <div className="text-xs">Zufriedenheit <Progress value={e.satisfaction} /> {e.satisfaction}% | Ermüdung <Progress value={e.fatigue} /> {e.fatigue}%</div>
            <div className="flex gap-2 flex-wrap">
              {AIRCRAFT_TYPES.map((t) => <Button key={t} size="sm" variant="outline" onClick={() => runTraining(e.id, t)}>TypeRating {t}</Button>)}
              <Button size="sm" onClick={() => simulateOrder(e.id)} disabled={busy}>Auftrag simulieren</Button>
              <Button size="sm" variant="outline" onClick={() => updateEmployee(e.id, (x) => ({ ...x, salary: x.salary + 300, satisfaction: clamp(x.satisfaction + 8,0,100) }))}>Gehalt +</Button>
              <Button size="sm" variant="outline" onClick={() => updateEmployee(e.id, (x) => ({ ...x, salary: Math.max(0, x.salary - 300), satisfaction: clamp(x.satisfaction - 12,0,100) }))}>Gehalt -</Button>
              <Button size="sm" variant="destructive" onClick={() => setEmployees((prev) => prev.filter((x) => x.id !== e.id))}>Kündigen</Button>
            </div>
          </div>;
        })}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Ereignisprotokoll</CardTitle></CardHeader><CardContent>{log.slice(0, 20).map((l, i) => <div key={i} className="text-sm">• {l}</div>)}</CardContent></Card>
    </div>
  );
}
