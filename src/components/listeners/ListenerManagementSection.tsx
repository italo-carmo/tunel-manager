import { useCallback, useEffect, useMemo, useState } from "react";
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
  onRegisterCreateListener?: (open: (agentId?: number) => void) => void;
  showCreationButton?: boolean;
  creationButtonLabel?: string;
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
  onRegisterCreateListener,
  showCreationButton = true,
  creationButtonLabel = "Add New",
}: ListenerManagementSectionProps) {
  const { del } = useApi();
  const { onOpenChange, onOpen, isOpen } = useDisclosure();
  const [modalAgentId, setModalAgentId] = useState<number | undefined>();

  const openCreationModal = useCallback(
    (agentId?: number) => {
      setModalAgentId(agentId);
      onOpen();
    },
    [onOpen],
  );

  useEffect(() => {
    if (onRegisterCreateListener) {
      onRegisterCreateListener(openCreationModal);
    }
  }, [onRegisterCreateListener, openCreationModal]);

  useEffect(() => {
    if (!isOpen) {
      setModalAgentId(undefined);
    }
  }, [isOpen]);

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

  const safeStringCompare = useCallback((a?: string | null, b?: string | null) => {
    if (a === b) return 0;
    if (a === undefined || a === null) return 1;
    if (b === undefined || b === null) return -1;
    return a.localeCompare(b);
  }, []);

  const fallbackListenerCompare = useCallback(
    (a: Listener, b: Listener) => {
      const agentComparison = safeStringCompare(a.Agent, b.Agent);
      if (agentComparison !== 0) return agentComparison;

      const listenerAddrComparison = safeStringCompare(
        a.ListenerAddr,
        b.ListenerAddr,
      );
      if (listenerAddrComparison !== 0) return listenerAddrComparison;

      const redirectAddrComparison = safeStringCompare(
        a.RedirectAddr,
        b.RedirectAddr,
      );
      if (redirectAddrComparison !== 0) return redirectAddrComparison;

      return a.ListenerID - b.ListenerID;
    },
    [safeStringCompare],
  );

  const comparePortsAsc = useCallback(
    (a?: number, b?: number) => {
      if (a === b) return 0;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return a - b;
    },
    [],
  );

  const comparePortsDesc = useCallback(
    (a?: number, b?: number) => {
      if (a === b) return 0;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return b - a;
    },
    [],
  );

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
      "listenerId-desc": (a, b) => {
        const diff = b.ListenerID - a.ListenerID;
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "listenerId-asc": (a, b) => {
        const diff = a.ListenerID - b.ListenerID;
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "agent-asc": (a, b) => {
        const diff = safeStringCompare(a.Agent, b.Agent);
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "agent-desc": (a, b) => {
        const diff = safeStringCompare(b.Agent, a.Agent);
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "listenerPort-asc": (a, b) => {
        const aPort = extractPort(a.ListenerAddr);
        const bPort = extractPort(b.ListenerAddr);
        const diff = comparePortsAsc(aPort, bPort);
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "listenerPort-desc": (a, b) => {
        const aPort = extractPort(a.ListenerAddr);
        const bPort = extractPort(b.ListenerAddr);
        const diff = comparePortsDesc(aPort, bPort);
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "redirectPort-asc": (a, b) => {
        const aPort = extractPort(a.RedirectAddr);
        const bPort = extractPort(b.RedirectAddr);
        const diff = comparePortsAsc(aPort, bPort);
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
      "redirectPort-desc": (a, b) => {
        const aPort = extractPort(a.RedirectAddr);
        const bPort = extractPort(b.RedirectAddr);
        const diff = comparePortsDesc(aPort, bPort);
        return diff !== 0 ? diff : fallbackListenerCompare(a, b);
      },
    };

    return [...filteredListeners].sort(sorters[sortOption]);
  }, [
    comparePortsAsc,
    comparePortsDesc,
    extractPort,
    fallbackListenerCompare,
    filteredListeners,
    safeStringCompare,
    sortOption,
  ]);

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
        agentId={modalAgentId}
      />

      <section className={clsx("flex flex-col gap-4", className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-default-700">{title}</h2>
          {showCreationButton ? (
            <Button
              color="primary"
              endContent={<PlusIcon />}
              onPress={() => openCreationModal()}
            >
              {creationButtonLabel}
            </Button>
          ) : null}
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
            emptyContent={"Sem listeners ativos."}
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
