import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  return new Response(
    JSON.stringify({
      params,
    })
  );
};
