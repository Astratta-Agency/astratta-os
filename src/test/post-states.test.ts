import { describe, expect, it } from "vitest";
import {
  POST_STATE_ORDER,
  POST_STATE_TRANSITIONS,
  skipsClientApproval,
  type PostStatus,
} from "@/lib/post-states";

const PRE_APPROVAL: PostStatus[] = [
  "idea",
  "draft",
  "pending_internal_review",
  "pending_approval",
  "changes_requested",
];

describe("transiciones de estatus de publicaciones", () => {
  it("permite marcar Programado y Publicado sin pasar por aprobación", () => {
    for (const from of PRE_APPROVAL) {
      expect(POST_STATE_TRANSITIONS[from]).toContain("scheduled");
      expect(POST_STATE_TRANSITIONS[from]).toContain("published");
    }
    expect(POST_STATE_TRANSITIONS.approved).toContain("published");
  });

  it("Publicado ya no es un callejón sin salida", () => {
    expect(POST_STATE_TRANSITIONS.published).toEqual(
      expect.arrayContaining(["scheduled", "draft", "archived"]),
    );
    expect(POST_STATE_TRANSITIONS.scheduled).toContain("draft");
  });

  it("ningún estado se lista a sí mismo ni apunta a un estado desconocido", () => {
    for (const from of POST_STATE_ORDER) {
      expect(POST_STATE_TRANSITIONS[from]).not.toContain(from);
      for (const to of POST_STATE_TRANSITIONS[from]) expect(POST_STATE_ORDER).toContain(to);
    }
  });
});

describe("skipsClientApproval", () => {
  it("es true al programar o publicar algo que no fue aprobado", () => {
    for (const from of PRE_APPROVAL) {
      expect(skipsClientApproval(from, "scheduled")).toBe(true);
      expect(skipsClientApproval(from, "published")).toBe(true);
    }
  });

  it("es false cuando ya estaba aprobado o el destino es otro", () => {
    expect(skipsClientApproval("approved", "scheduled")).toBe(false);
    expect(skipsClientApproval("approved", "published")).toBe(false);
    expect(skipsClientApproval("scheduled", "published")).toBe(false);
    expect(skipsClientApproval("draft", "archived")).toBe(false);
    expect(skipsClientApproval("published", "draft")).toBe(false);
  });
});
