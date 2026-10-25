import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJson, requireWorkerAuthorization } from "@/lib/api";

 describe("API request boundaries", () => {
  it("validates JSON bodies with the provided schema", async () => {
    const schema = z.object({ name: z.string().min(2) });
    await expect(parseJson(new Request("http://local", { method: "POST", body: JSON.stringify({ name: "Auto" }) }), schema)).resolves.toEqual({ name: "Auto" });
    await expect(parseJson(new Request("http://local", { method: "POST", body: "not-json" }), schema)).rejects.toMatchObject({ code: "INVALID_JSON" });
    await expect(parseJson(new Request("http://local", { method: "POST", body: JSON.stringify({ name: "A" }) }), schema)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("requires a configured worker bearer credential", () => {
    process.env.WORKER_SECRET = "a-secure-worker-secret-with-32-characters";
    expect(() => requireWorkerAuthorization(new Request("http://local"))).toThrow("Invalid worker");
    expect(() => requireWorkerAuthorization(new Request("http://local", { headers: { authorization: "Bearer wrong" } }))).toThrow("Invalid worker");
    expect(() => requireWorkerAuthorization(new Request("http://local", { headers: { authorization: `Bearer ${process.env.WORKER_SECRET}` } }))).not.toThrow();
  });
});
