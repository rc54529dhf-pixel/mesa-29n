import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRANSLATION_MODEL, readTranslations, translationRequest } from "./translate.ts";

describe("translationRequest", () => {
  it("numbers the headlines and sends them as data", () => {
    const request = translationRequest(["Uno", 'Dos con "comillas"']) as {
      model: string;
      temperature: number;
      messages: { role: string; content: string }[];
    };
    assert.equal(request.model, TRANSLATION_MODEL);
    assert.equal(request.temperature, 0);
    assert.equal(request.messages[0].role, "system");
    assert.deepEqual(JSON.parse(request.messages[1].content), [
      { i: 0, es: "Uno" },
      { i: 1, es: 'Dos con "comillas"' },
    ]);
  });
});

describe("readTranslations", () => {
  it("lines the answer up with the headlines by index", () => {
    const answer = '{"items":[{"i":1,"en":"Second"},{"i":0,"en":"  First\\n headline "}]}';
    assert.deepEqual(readTranslations(answer, 2), ["First headline", "Second"]);
  });
  it("accepts JSON wrapped in a code fence or a sentence", () => {
    const answer = 'Here you go:\n```json\n{"items":[{"i":0,"en":"Only one"}]}\n```';
    assert.deepEqual(readTranslations(answer, 1), ["Only one"]);
  });
  it("leaves a gap where the answer has nothing usable", () => {
    const answer = JSON.stringify({
      items: [
        { i: 0, en: "Good" },
        { i: 5, en: "Out of range" },
        { i: 1, en: "" },
        { i: 2, en: 42 },
        { i: "3", en: "Index is not a number" },
        { i: 4, en: "x".repeat(400) },
      ],
    });
    assert.deepEqual(readTranslations(answer, 5), ["Good", null, null, null, null]);
  });
  it("returns only gaps for anything that is not the expected JSON", () => {
    assert.deepEqual(readTranslations("I cannot do that.", 2), [null, null]);
    assert.deepEqual(readTranslations('{"items":"nope"}', 2), [null, null]);
    assert.deepEqual(readTranslations("{broken", 1), [null]);
    assert.deepEqual(readTranslations(undefined, 1), [null]);
  });
});
