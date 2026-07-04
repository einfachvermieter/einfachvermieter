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
import { type Building, buildingsQueryOptions } from "./buildings";

const STORAGE_KEY = "activeBuildingId";

type ActiveBuildingValue = {
  /**
   * Aktuell gewähltes Gebäude, undefined nur, solange noch keins existiert.
   */
  buildingId: string | undefined;
  building: Building | undefined;
  buildings: Building[];
  isPending: boolean;
  setBuildingId: (id: string) => void;
};

const ActiveBuildingContext = createContext<ActiveBuildingValue | null>(null);

const readStoredId = (): string | undefined => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // localStorage nicht verfügbar (z. B. Private Mode)
  }
};

export const ActiveBuildingProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { data: buildings, isPending } = useQuery(buildingsQueryOptions);
  const [storedId, setStoredId] = useState<string | undefined>(readStoredId);
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

      try {
        localStorage.setItem(STORAGE_KEY, buildingId);
      } catch {
        // localStorage nicht verfügbar. Auswahl bleibt nur in-memory.
      }
    }
  }, [buildingId, storedId]);

  const setBuildingId = useCallback(
    (id: string) => {
      setStoredId(id);

      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // localStorage nicht verfügbar. Auswahl bleibt nur in-memory.
      }

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
    }),
    [buildingId, buildings, isPending, setBuildingId],
  );

  return (
    <ActiveBuildingContext.Provider value={value}>
      {children}
    </ActiveBuildingContext.Provider>
  );
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
