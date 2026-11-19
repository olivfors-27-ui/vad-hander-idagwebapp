// Worker för Freebuff Sites: statisk SPA + samma API-rutter som
// functions/api/*.ts (Pages Functions). Källan är fortfarande Pages-funktionerna,
// så logiken finns bara på ett ställe – filen byggs med `bun run build:sites`
// till sites/index.js som laddas upp av sites_deploy.
import { onRequestGet as eventImage } from "../functions/api/event-image";
import { onRequestGet as events } from "../functions/api/events";

type Assets = { fetch: (request: Request) => Promise<Response> };

type Env = { ASSETS: Assets };

type PagesContext = {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  next: () => Promise<Response>;
  params: Record<string, string>;
  data: Record<string, unknown>;
};

const API_ROUTES: Record<string, (context: PagesContext) => Promise<Response>> = {
  "/api/events": events as unknown as (context: PagesContext) => Promise<Response>,
  "/api/event-image": eventImage as unknown as (context: PagesContext) => Promise<Response>,
};

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }) {
    const url = new URL(request.url);
    const handler = API_ROUTES[url.pathname];
    if (handler) {
      if (request.method !== "GET") {
        return new Response("Metoden stöds inte.", { status: 405 });
      }
      try {
        return await handler({
          request,
          // 16 sidor Visit Stockholm + 3 Visit Sweden = 19 subrequests, under
          // Sites-taket på 20 per anrop.
          env: { ...env, EVENTS_MAX_PAGES: "16" },
          waitUntil: ctx.waitUntil,
          next: async () => new Response(null, { status: 404 }),
          params: {},
          data: {},
        });
      } catch (error) {
        const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        return new Response(JSON.stringify({ error: detail }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;

    const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
    if (!acceptsHtml) return response;

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  },
};
