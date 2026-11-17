// Bind Pages Functions as plain fetch handlers for the Worker.
import { onRequestGet as eventImageGet } from "./api/event-image";
import { onRequestGet as eventsGet } from "./api/events";
import { onRequestGet as placesGet } from "./api/places";

type PgCtx = { request: Request; env: unknown; ctx: unknown; params: Record<string, never>; next?: unknown };

const adapt = (request: Request, env: unknown, ctx: unknown, fn: (c: PgCtx) => Promise<Response>) =>
  fn({ request, env, ctx, params: {} });

export const eventImage = (request: Request, env: unknown, ctx: unknown) => adapt(request, env, ctx, eventImageGet as unknown as (c: PgCtx) => Promise<Response>);
export const events = (request: Request, env: unknown, ctx: unknown) => adapt(request, env, ctx, eventsGet as unknown as (c: PgCtx) => Promise<Response>);
export const places = (request: Request, env: unknown, ctx: unknown) => adapt(request, env, ctx, placesGet as unknown as (c: PgCtx) => Promise<Response>);
