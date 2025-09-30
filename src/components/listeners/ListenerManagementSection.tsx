import { useCallback, useMemo, useState } from "react";
import {
  Button,
  CircularProgress,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import { CircleX, PlusIcon } from "lucide-react";
import type { KeyedMutator } from "swr";
import clsx from "clsx";

import { ListenerCreationModal } from "@/pages/listeners/modal.tsx";
import { useApi } from "@/hooks/useApi.ts";
import type { LigoloListeners, Listener } from "@/types/listeners.ts";

interface ListenerManagementSectionProps {
  listeners?: LigoloListeners;
  loading?: boolean;
  mutate?: KeyedMutator<LigoloListeners>;
  className?: string;
  title?: string;
}

type SortOption =
  | "listenerId-desc"
  | "listenerId-asc"
  | "agent-asc"
  | "agent-desc"
  | "listenerPort-asc"
  | "listenerPort-desc"
  | "redirectPort-asc"
  | "redirectPort-desc";

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "ID (maior primeiro)", value: "listenerId-desc" },
  { label: "ID (menor primeiro)", value: "listenerId-asc" },
  { label: "Agente (A-Z)", value: "agent-asc" },
  { label: "Agente (Z-A)", value: "agent-desc" },
  { label: "Porta de escuta (crescente)", value: "listenerPort-asc" },
  { label: "Porta de escuta (decrescente)", value: "listenerPort-desc" },
  { label: "Porta de redirecionamento (crescente)", value: "redirectPort-asc" },
  { label: "Porta de redirecionamento (decrescente)", value: "redirectPort-desc" },
];

export function ListenerManagementSection({
  listeners,
  loading = false,
  mutate,
  className,
  title = "Listeners",
}: ListenerManagementSectionProps) {
  const { del } = useApi();
  const { onOpenChange, onOpen, isOpen } = useDisclosure();

  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [portFilter, setPortFilter] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>("listenerId-desc");

  const normalizedListeners = useMemo<Listener[]>(() => {
    if (!listeners) return [];
    const items = Array.isArray(listeners)
      ? [...listeners]
      : Object.values(listeners);

    return items;
  }, [listeners]);

  const agentOptions = useMemo(() => {
    const uniqueAgents = new Set<string>();
    normalizedListeners.forEach((listener) => {
      if (listener.Agent) {
        uniqueAgents.add(listener.Agent);
      }
    });

    return Array.from(uniqueAgents).sort((a, b) => a.localeCompare(b));
  }, [normalizedListeners]);

  const agentItems = useMemo(
    () => [
      { key: "all", label: "Todos os agentes" },
      ...agentOptions.map((agent) => ({ key: agent, label: agent })),
    ],
    [agentOptions],
  );

  const extractPort = useCallback((address?: string) => {
    if (!address) return undefined;
    const match = address.match(/:(\d+)$/);
    return match ? Number(match[1]) : undefined;
  }, []);

  const filteredListeners = useMemo(() => {
    return normalizedListeners.filter((listener) => {
      if (selectedAgent !== "all" && listener.Agent !== selectedAgent) {
        return false;
      }

      if (portFilter.trim().length > 0) {
        const normalizedPort = portFilter.trim();
        if (
          !listener.ListenerAddr?.includes(normalizedPort) &&
          !listener.RedirectAddr?.includes(normalizedPort)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [normalizedListeners, portFilter, selectedAgent]);

  const sortedListeners = useMemo(() => {
    const sorters: Record<SortOption, (a: Listener, b: Listener) => number> = {
      "listenerId-desc": (a, b) => b.ListenerID - a.ListenerID,
      "listenerId-asc": (a, b) => a.ListenerID - b.ListenerID,
      "agent-asc": (a, b) => a.Agent.localeCompare(b.Agent),
      "agent-desc": (a, b) => b.Agent.localeCompare(a.Agent),
      "listenerPort-asc": (a, b) => {
        const aPort = extractPort(a.ListenerAddr) ?? Number.POSITIVE_INFINITY;
        const bPort = extractPort(b.ListenerAddr) ?? Number.POSITIVE_INFINITY;
        return aPort - bPort;
      },
      "listenerPort-desc": (a, b) => {
        const aPort = extractPort(a.ListenerAddr) ?? Number.NEGATIVE_INFINITY;
        const bPort = extractPort(b.ListenerAddr) ?? Number.NEGATIVE_INFINITY;
        return bPort - aPort;
      },
      "redirectPort-asc": (a, b) => {
        const aPort = extractPort(a.RedirectAddr) ?? Number.POSITIVE_INFINITY;
        const bPort = extractPort(b.RedirectAddr) ?? Number.POSITIVE_INFINITY;
        return aPort - bPort;
      },
      "redirectPort-desc": (a, b) => {
        const aPort = extractPort(a.RedirectAddr) ?? Number.NEGATIVE_INFINITY;
        const bPort = extractPort(b.RedirectAddr) ?? Number.NEGATIVE_INFINITY;
        return bPort - aPort;
      },
    };

    return [...filteredListeners].sort(sorters[sortOption]);
  }, [extractPort, filteredListeners, sortOption]);

  const deleteListener = useCallback(
    (listener: Listener) => async () => {
      await del("api/v1/listeners", {
        agentId: listener.AgentID,
        listenerId: listener.ListenerID,
      });
      if (mutate) {
        await mutate();
      }
    },
    [del, mutate],
  );

  const loadingState = loading ? "loading" : "idle";

  return (
    <>
      <ListenerCreationModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        mutate={async () => {
          if (mutate) await mutate();
        }}
      />

      <section className={clsx("flex flex-col gap-4", className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-default-700">{title}</h2>
          <Button color="primary" endContent={<PlusIcon />} onPress={onOpen}>
            Add New
          </Button>
        </div>

        <div className="rounded-large border border-default-200 bg-content1/60 p-4 shadow-sm backdrop-blur">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-default-500">
            <span>
              Exibindo {sortedListeners.length} de {normalizedListeners.length} listeners
            </span>
            {(selectedAgent !== "all" || portFilter) && (
              <Button
                size="sm"
                variant="light"
                onPress={() => {
                  setSelectedAgent("all");
                  setPortFilter("");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Filtrar por agente"
              placeholder="Todos os agentes"
              selectedKeys={new Set([selectedAgent])}
              onSelectionChange={(keys) => {
                const key = keys.currentKey;
                setSelectedAgent((key as string | null) ?? "all");
              }}
              items={agentItems}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>

            <Input
              label="Filtrar por porta"
              placeholder="Ex.: 443"
              value={portFilter}
              onValueChange={setPortFilter}
              description="Busca em endereços de escuta e redirecionamento"
            />

            <Select
              label="Ordenar"
              selectedKeys={new Set([sortOption])}
              onSelectionChange={(keys) => {
                const key = keys.currentKey as SortOption | null;
                if (key) {
                  setSortOption(key);
                }
              }}
              items={SORT_OPTIONS}
            >
              {(item) => <SelectItem key={item.value}>{item.label}</SelectItem>}
            </Select>
          </div>
        </div>

        <Table aria-label="Listener list">
          <TableHeader>
            <TableColumn>#</TableColumn>
            <TableColumn className="uppercase">Agent</TableColumn>
            <TableColumn className="uppercase">Network</TableColumn>
            <TableColumn className="uppercase">Listener Address</TableColumn>
            <TableColumn className="uppercase">Redirect Address</TableColumn>
            <TableColumn className="uppercase">Actions</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={"No active listeners."}
            loadingState={loadingState}
            loadingContent={<CircularProgress aria-label="Loading..." size="sm" />}
          >
            {sortedListeners.map((listener, index) => (
              <TableRow key={`${listener.ListenerID}-${listener.Agent}`}>
                <TableCell className="font-semibold text-default-500">
                  #{index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <p className="text-bold text-sm">{listener.Agent}</p>
                    <p className="text-bold text-sm text-default-400">
                      {listener.RemoteAddr}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{listener.Network}</TableCell>
                <TableCell>{listener.ListenerAddr}</TableCell>
                <TableCell>{listener.RedirectAddr}</TableCell>
                <TableCell>
                  <div className="relative flex items-center gap-2">
                    <Tooltip content="Remove listener" color="danger">
                      <span
                        className="cursor-pointer text-lg text-danger active:opacity-50"
                        onClick={deleteListener(listener)}
                      >
                        <CircleX />
                      </span>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

export default ListenerManagementSection;
