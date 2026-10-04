import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

// Railway infrastructure for healthManager (project-wide: every resource in the
// project is declared here, and removing one from this file deletes it on apply).
// Not read during deploys — preview with `railway config plan`, then `railway config apply`.
export default defineRailway(() => {
  const region = "europe-west4-drams3a";

  // ⚠️ Removing Postgres or its volume from this file deletes the database on apply.
  const Postgres = postgres("Postgres", { region });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region,
    sizeMB: 5000,
  });

  const app = service("app", {
    // checkSuites: wait for GitHub CI (backend + frontend) before deploying a push to main.
    source: github("ThomasBernard0/healthManager", { checkSuites: true }),
    build: "npm run build",
    start: "npm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { [region]: 1 },
    env: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
      NODE_ENV: "production",
      FRONTEND_URL: "https://app-production-0f43.up.railway.app",
    },
  });

  return project("healthManager", {
    resources: [Postgres, app, postgresVolume],
  });
});
