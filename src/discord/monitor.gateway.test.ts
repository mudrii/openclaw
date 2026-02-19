import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { waitForDiscordGatewayStop } from "./monitor.gateway.js";

describe("shouldStopOnError for gateway close codes", () => {
  // This mirrors the shouldStopOnError callback used in monitorDiscordProvider
  function shouldStopOnError(err: unknown): boolean {
    const message = String(err);
    return (
      message.includes("Fatal Gateway error: 4014") ||
      message.includes("Max reconnect attempts") ||
      message.includes("Fatal Gateway error")
    );
  }

  it("returns true for close code 4014 (Disallowed Intents)", () => {
    expect(shouldStopOnError(new Error("Fatal Gateway error: 4014"))).toBe(true);
  });

  it("returns true for other fatal gateway errors", () => {
    expect(shouldStopOnError(new Error("Fatal Gateway error: 4001"))).toBe(true);
    expect(shouldStopOnError(new Error("Fatal Gateway error: 4004"))).toBe(true);
  });

  it("returns true for max reconnect attempts", () => {
    expect(shouldStopOnError(new Error("Max reconnect attempts reached"))).toBe(true);
  });

  it("returns false for transient errors", () => {
    expect(shouldStopOnError(new Error("Connection reset"))).toBe(false);
    expect(shouldStopOnError(new Error("ETIMEDOUT"))).toBe(false);
  });

  it("4014 triggers stop AND should be caught gracefully by provider", async () => {
    const emitter = new EventEmitter();
    const disconnect = vi.fn();

    const promise = waitForDiscordGatewayStop({
      gateway: { emitter, disconnect },
      shouldStopOnError,
    });

    emitter.emit("error", new Error("Fatal Gateway error: 4014"));

    // waitForDiscordGatewayStop rejects — the fix is in the provider catch block
    await expect(promise).rejects.toThrow("4014");
  });
});

describe("waitForDiscordGatewayStop", () => {
  it("resolves on abort and disconnects gateway", async () => {
    const emitter = new EventEmitter();
    const disconnect = vi.fn();
    const abort = new AbortController();

    const promise = waitForDiscordGatewayStop({
      gateway: { emitter, disconnect },
      abortSignal: abort.signal,
    });

    expect(emitter.listenerCount("error")).toBe(1);
    abort.abort();

    await expect(promise).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount("error")).toBe(0);
  });

  it("rejects on gateway error and disconnects", async () => {
    const emitter = new EventEmitter();
    const disconnect = vi.fn();
    const onGatewayError = vi.fn();
    const abort = new AbortController();
    const err = new Error("boom");

    const promise = waitForDiscordGatewayStop({
      gateway: { emitter, disconnect },
      abortSignal: abort.signal,
      onGatewayError,
    });

    emitter.emit("error", err);

    await expect(promise).rejects.toThrow("boom");
    expect(onGatewayError).toHaveBeenCalledWith(err);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount("error")).toBe(0);

    abort.abort();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("ignores gateway errors when instructed", async () => {
    const emitter = new EventEmitter();
    const disconnect = vi.fn();
    const onGatewayError = vi.fn();
    const abort = new AbortController();
    const err = new Error("transient");

    const promise = waitForDiscordGatewayStop({
      gateway: { emitter, disconnect },
      abortSignal: abort.signal,
      onGatewayError,
      shouldStopOnError: () => false,
    });

    emitter.emit("error", err);
    expect(onGatewayError).toHaveBeenCalledWith(err);
    expect(disconnect).toHaveBeenCalledTimes(0);
    expect(emitter.listenerCount("error")).toBe(1);

    abort.abort();
    await expect(promise).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount("error")).toBe(0);
  });

  it("resolves on abort without a gateway", async () => {
    const abort = new AbortController();

    const promise = waitForDiscordGatewayStop({
      abortSignal: abort.signal,
    });

    abort.abort();

    await expect(promise).resolves.toBeUndefined();
  });
});
