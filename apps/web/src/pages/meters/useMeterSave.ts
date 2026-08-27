import {
  type MeterCreateDto,
  type MeterFormValues,
  meterFormSchema,
  meterFormToDto,
} from "@einfachvermieter/shared";
import { useRouter } from "@tanstack/react-router";
import { api } from "../../lib/api";
import { t, translateKey } from "../../lib/i18n";
import type { Meter } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { meterToFormValues } from "./components/meterFormHelpers";

/**
 * Sofort-Speichern eines Teilschritts der Zähler-Stammdaten: nimmt den
 * aktuellen Serverstand, wendet die Änderung an, prüft das Formular-Schema
 * und PATCHt den kompletten Zähler.
 */
export const useMeterSave = (meter: Meter | undefined) => {
  const router = useRouter();
  const mutation = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: MeterCreateDto) =>
      api.patch<Meter>(`/meters/${meter?.id}`, dto),
    invalidateKeys: [["meters"], ["meter", meter?.id ?? ""]],
  });

  return async (mutate: (values: MeterFormValues) => MeterFormValues) => {
    if (!meter) {
      return;
    }

    const next = mutate(meterToFormValues(meter));

    const parsed = meterFormSchema.safeParse(next);
    if (!parsed.success) {
      const message = translateKey(parsed.error.issues[0]?.message);
      throw new Error(message || t("common.saveFailed"));
    }

    await mutation.mutateAsync(meterFormToDto(next, t));

    await router.invalidate();
  };
};
