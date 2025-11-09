import { DrizzleDB } from "../db/client";
import { eq, and } from "drizzle-orm";

export async function getSiteAndEnv(db: DrizzleDB, siteName: string, envName: string) {
  // Look up site by name
  const site = await db.query.sites.findFirst({
    where: (sites, { eq }) => eq(sites.name, siteName),
  });

  if (!site) {
    throw new Error(`Site '${siteName}' not found`);
  }

  // Look up environment by name
  const env = await db.query.environments.findFirst({
    where: (environments, { eq, and }) =>
      and(eq(environments.name, envName), eq(environments.siteId, site.id)),
  });

  if (!env) {
    throw new Error(`Environment '${envName}' not found`);
  }

  return { siteId: site.id, environmentId: env.id };
}
