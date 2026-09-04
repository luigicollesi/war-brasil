export function recordAutomationWorkerMetric(name, fields = {}) {
  console.log(
    JSON.stringify({
      component: "automation-worker",
      name,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
}
