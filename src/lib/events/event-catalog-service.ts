import "server-only";

import type { PoolClient } from "pg";
import { assertEventCatalogShape } from "./event-catalog";
import { getEventCatalogSnapshot } from "./event-repository";

export async function assertEventCatalogReady(client: PoolClient) {
  const catalog = await getEventCatalogSnapshot(client);
  assertEventCatalogShape(catalog.eventIds, catalog.connections);
}
