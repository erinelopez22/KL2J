import { createFileRoute } from "@tanstack/react-router";
import { getRequest, getRequestUrl } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/debug-headers")({
  server: {
    handlers: {
      GET: async () => {
        const request = getRequest();
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        const rawUrl = request.url;
        const forwardedUrl = getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).toString();
        const plainUrl = getRequestUrl().toString();
        return Response.json({ headers, rawUrl, forwardedUrl, plainUrl });
      },
    },
  },
});
