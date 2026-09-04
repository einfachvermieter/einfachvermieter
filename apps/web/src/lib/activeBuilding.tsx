import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Building,
  buildingsQueryOptions,
  readStoredBuildingId,
  writeStoredBuildingId,
} from "./buildings";

type ActiveBuildingValue = {
  /**
   * Aktuell gewähltes Gebäude, undefined nur, solange noch keins existiert.
   */
  buildingId: string | undefined;
  building: Building | undefined;
  buildings: Building[];
  isPending: boolean;
  setBuildingId: (id: string) => void;
  adoptBuildingId: (id: string) => void;
};

const ActiveBuildingContext = createContext<ActiveBuildingValue | null>(null);

export const ActiveBuildingProvider = ({
  children,
  enabled = true,
}: {
  children: ReactNode;

  /**
   * Auf Anmelde-/Einrichtungsseiten gibt es keine Gebäude zu laden.
   * Provider kann trotzdem gemountet bleiben, damit er nicht beim
   * Rendern plötzlich weg ist
   */
  enabled?: boolean;
}) => {
  const { data: buildings, isPending } = useQuery({
    ...buildingsQueryOptions,
    enabled,
  });
  const [storedId, setStoredId] = useState<string | undefined>(
    readStoredBuildingId,
  );
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // buildingId aus der URL ist primär; der Store dient nur als Fallback.
  const urlBuildingId = useSearch({
    strict: false,
    select: (search) => (search as { buildingId?: string }).buildingId,
  });

  // Auflösung: URL -> Store -> erstes Gebäude. Gewähltes muss noch existieren.
  const buildingId = useMemo(() => {
    if (!buildings || buildings.length === 0) {
      return;
    }

    const exists = (id: string | undefined): id is string =>
      id !== undefined && buildings.some((building) => building.id === id);
    if (exists(urlBuildingId)) {
      return urlBuildingId;
    }

    if (exists(storedId)) {
      return storedId;
    }

    return buildings[0]?.id;
  }, [buildings, urlBuildingId, storedId]);

  // Aufgelöstes Gebäude in den Store spiegeln, damit der Fallback aktuell bleibt.
  useEffect(() => {
    if (buildingId && buildingId !== storedId) {
      setStoredId(buildingId);
      writeStoredBuildingId(buildingId);
    }
  }, [buildingId, storedId]);

  const adoptBuildingId = useCallback((id: string) => {
    setStoredId(id);
    writeStoredBuildingId(id);
  }, []);

  const setBuildingId = useCallback(
    (id: string) => {
      setStoredId(id);
      writeStoredBuildingId(id);

      // Detail-/Formularseiten gehören zum alten Gebäude: zurück zur Liste
      // (erstes Pfadsegment); Suchparams (Seite, Filter) zurücksetzen
      const listPath = `/${pathname.split("/")[1] ?? ""}`;
      navigate({
        to: listPath,
        search: { buildingId: id },
      }).catch(() => undefined);
    },
    [navigate, pathname],
  );

  const value = useMemo<ActiveBuildingValue>(
    () => ({
      buildingId,
      building: buildings?.find((building) => building.id === buildingId),
      buildings: buildings ?? [],
      isPending,
      setBuildingId,
      adoptBuildingId,
    }),
    [buildingId, buildings, isPending, setBuildingId, adoptBuildingId],
  );

  return (
    <ActiveBuildingContext.Provider value={value}>
      {children}
    </ActiveBuildingContext.Provider>
  );
};

/**
 * Zieht das aktive Gebäude auf das Gebäude des angezeigten Objekts nach.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Hooks bewusst neben ihrem Provider
export const useAdoptBuilding = (buildingId: string | undefined): void => {
  const {
    buildingId: activeId,
    buildings,
    adoptBuildingId,
  } = useActiveBuilding();

  useEffect(() => {
    if (!buildingId || buildingId === activeId) {
      return;
    }

    // Gelöschte oder fremde Ids nicht übernehmen
    if (!buildings.some((building) => building.id === buildingId)) {
      return;
    }

    adoptBuildingId(buildingId);
  }, [buildingId, activeId, buildings, adoptBuildingId]);
};

// biome-ignore lint/style/useComponentExportOnlyModules: Context-Hook bewusst neben seinem Provider
export const useActiveBuilding = (): ActiveBuildingValue => {
  const value = useContext(ActiveBuildingContext);
  if (!value) {
    throw new Error(
      "useActiveBuilding must be used within an ActiveBuildingProvider",
    );
  }
  return value;
};
