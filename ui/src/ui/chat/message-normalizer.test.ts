import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeMessage } from "./message-normalizer";
import { classifyMessage } from "./message-classifier";

describe("message-normalizer", () => {
  describe("normalizeMessage", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("normalizes message with string content", () => {
      const result = normalizeMessage({
        role: "user",
        content: "Hello world",
        timestamp: 1000,
        id: "msg-1",
      });

      expect(result).toEqual({
        role: "user",
        content: [{ type: "text", text: "Hello world" }],
        timestamp: 1000,
        id: "msg-1",
      });
    });

    it("normalizes message with array content", () => {
      const result = normalizeMessage({
        role: "assistant",
        content: [
          { type: "text", text: "Here is the result" },
          { type: "tool_use", name: "bash", args: { command: "ls" } },
        ],
        timestamp: 2000,
      });

      expect(result.role).toBe("assistant");
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({ type: "text", text: "Here is the result", name: undefined, args: undefined });
      expect(result.content[1]).toEqual({ type: "tool_use", text: undefined, name: "bash", args: { command: "ls" } });
    });

    it("normalizes message with text field (alternative format)", () => {
      const result = normalizeMessage({
        role: "user",
        text: "Alternative format",
      });

      expect(result.content).toEqual([{ type: "text", text: "Alternative format" }]);
    });

    it("preserves role when toolCallId is present", () => {
      const result = normalizeMessage({
        role: "assistant",
        toolCallId: "call-123",
        content: "Tool output",
      });

      expect(result.role).toBe("assistant");
    });

    it("preserves role when tool_call_id is present", () => {
      const result = normalizeMessage({
        role: "assistant",
        tool_call_id: "call-456",
        content: "Tool output",
      });

      expect(result.role).toBe("assistant");
    });

    it("handles missing role", () => {
      const result = normalizeMessage({ content: "No role" });
      expect(result.role).toBe("unknown");
    });

    it("handles missing content", () => {
      const result = normalizeMessage({ role: "user" });
      expect(result.content).toEqual([]);
    });

    it("uses current timestamp when not provided", () => {
      const result = normalizeMessage({ role: "user", content: "Test" });
      expect(result.timestamp).toBe(Date.now());
    });

    it("handles arguments field (alternative to args)", () => {
      const result = normalizeMessage({
        role: "assistant",
        content: [{ type: "tool_use", name: "test", arguments: { foo: "bar" } }],
      });

      expect(result.content[0].args).toEqual({ foo: "bar" });
    });
  });

  describe("classifyMessage", () => {
    it("keeps assistant role when text + tool blocks are mixed", () => {
      const result = classifyMessage({
        role: "assistant",
        content: [
          { type: "text", text: "before" },
          { type: "toolCall", id: "call_1", name: "read", arguments: {} },
          { type: "thinking", thinking: "after" },
          { type: "text", text: "after text" },
        ],
      });

      expect(result.roleKind).toBe("assistant");
      expect(result.hasText).toBe(true);
      expect(result.hasToolCalls).toBe(true);
      expect(result.hasThinking).toBe(true);
    });

    it("classifies tool-only assistant messages as tool", () => {
      const result = classifyMessage({
        role: "assistant",
        toolCallId: "call-1",
        content: [{ type: "toolCall", id: "call-1", name: "read" }],
      });

      expect(result.roleKind).toBe("tool");
      expect(result.hasText).toBe(false);
      expect(result.isToolLike).toBe(true);
    });

    it("classifies tool role messages as tool", () => {
      const result = classifyMessage({
        role: "tool",
        content: "Sunny, 70F.",
      });

      expect(result.roleKind).toBe("tool");
      expect(result.hasText).toBe(true);
    });

    it("classifies toolResult role messages as tool", () => {
      const result = classifyMessage({
        role: "toolResult",
        content: [{ type: "text", text: "ok" }],
      });

      expect(result.roleKind).toBe("tool");
      expect(result.isToolLike).toBe(true);
    });
  });
});
