import { createCledon } from "cledon";

const cledon = createCledon({
  apiKey: process.env.CLEDON_API_KEY!,
  baseUrl: "https://api.cledon.ai",
});

const agents = await cledon.agents.list();
console.log("Agents:", agents);

if (agents.length === 0) {
  console.error("No agents found. Please create an agent in the Cledon dashboard first.");
  process.exit(1);
}

const agentId = agents[0].id;
console.log(`Using agent: ${agents[0].name} (${agentId})`);

const testcase = await cledon.testcases.create({
  agentId,
  name: "Heizung kaputt - Notfall Kundenservice",
  description:
    "Kunde Thomas Müller ruft an, weil seine Fußbodenheizung in seiner Mietwohnung ausgefallen ist. Er hat keinen Zugang zur zentralen Steuereinheit und braucht dringend einen Techniker. Der Agent soll den Kunden beruhigen, die Informationen aufnehmen und einen Technikertermin vereinbaren.",
  assertions: [
    "Agent begrüßt den Kunden freundlich und nennt den Firmennamen",
    "Agent fragt nach dem Namen des Kunden",
    "Agent zeigt Verständnis für die dringende Situation",
    "Agent fragt nach Details zur Heizung (Typ, Zugang zur Steuerung)",
    "Agent bietet eine konkrete Lösung oder Terminvereinbarung an",
    "Agent nennt einen konkreten Zeitrahmen für den Technikerbesuch",
  ],
});

console.log("Created test case:", testcase);

const personas = await cledon.personas.list();
const personaId = personas.find((p) => p.language === "de")?.id ?? personas[0]?.id;

const scenario = await cledon.scenarios.create({
  testCaseId: testcase.id,
  ...(personaId && { personaId }),
  name: "Frustrierter Mieter - Heizungsausfall",
  callerInstructions: `Du bist Thomas Müller, ein frustrierter Mieter dessen Fußbodenheizung ausgefallen ist. Dir ist sehr kalt und du bist ungeduldig.

Verhalten:
- Sage sofort, dass deine Heizung kaputt ist
- Wenn nach deinem Namen gefragt, sage "Thomas Müller"
- Du hast nur eine Fußbodenheizung, kein Display
- Du wohnst in einer Mietwohnung und hast keinen Zugang zur zentralen Steuereinheit
- Du willst, dass schnell ein Handwerker kommt
- Dir ist egal wann genau, Hauptsache schnell
- Werde zunehmend ungeduldiger wenn kein konkreter Termin genannt wird
- Frage wiederholt nach einem konkreten Zeitpunkt für den Technikerbesuch`,
});

console.log("Created scenario:", scenario);
console.log("\nTest case and scenario created successfully!");
