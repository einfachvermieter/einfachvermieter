import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { applyApiFieldErrors } from "./formErrors";

type FieldError = { path: (string | number)[]; message: string };

/**
 * Minimales Formular-Doppel: `applyApiFieldErrors` nutzt nur `getValues`
 * und `setError`
 */
const fakeForm = (values: Record<string, unknown>) => {
  const inlineErrors: Record<string, string> = {};
  const form = {
    getValues: () => values,
    setError: (path: string, error: { message: string }) => {
      inlineErrors[path] = error.message;
    },
  };
  // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel
  return { form: form as any, inlineErrors };
};

const apiError = (errors: FieldError[]) =>
  new ApiError(400, "Validierung fehlgeschlagen", undefined, errors);

describe("applyApiFieldErrors", () => {
  it("setzt einen Fehler auf ein vorhandenes Feld inline", () => {
    const { form, inlineErrors } = fakeForm({
      items: [{ amountEuros: "10,00" }],
    });

    const rootMessage = applyApiFieldErrors(
      form,
      apiError([{ path: ["items", 0, "amountEuros"], message: "Zu hoch" }]),
    );

    expect(inlineErrors["items.0.amountEuros"]).toBe("Zu hoch");
    expect(rootMessage).toBeNull();
  });

  it("zeigt einen Fehler auf ein hier nicht vorhandenes Feld als Gesamtmeldung", () => {
    const { form, inlineErrors } = fakeForm({
      items: [{ amountEuros: "10,00" }],
    });

    const rootMessage = applyApiFieldErrors(
      form,
      apiError([{ path: ["items", 2, "amountEuros"], message: "Zu hoch" }]),
    );

    expect(inlineErrors).toEqual({});
    expect(rootMessage).toBe("Zu hoch");
  });

  it("behält die Meldung ohne Pfad als Gesamtmeldung", () => {
    const { form } = fakeForm({ name: "" });

    expect(
      applyApiFieldErrors(
        form,
        apiError([{ path: [], message: "Zeitraum überschneidet sich" }]),
      ),
    ).toBe("Zeitraum überschneidet sich");
  });
});
