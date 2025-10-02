/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Key,
  type ReactNode,
} from "react";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import { ChevronsLeftRightEllipsis, NetworkIcon, PlusIcon, Power, PowerOff } from "lucide-react";
import cifrao from "../../../public/cifrao.png";
import hash from "../../../public/hash.png";
import { ListenerManagementSection } from "@/components/listeners/ListenerManagementSection.tsx";
import useAgents from "@/hooks/useAgents.ts";
import useInterfaces from "@/hooks/useInterfaces.ts";
import useListeners from "@/hooks/useListeners.ts";
import { useTheme } from "@/hooks/useTheme";
import ErrorContext from "@/contexts/Error.tsx";
import { useApi } from "@/hooks/useApi.ts";
import { handleApiResponse } from "@/hooks/toast.ts";
import { InterfaceCreationModal } from "@/pages/interfaces/modal.tsx";
import type { LigoloAgent } from "@/types/agents.ts";
import type { LigoloInterfaces } from "@/types/interfaces.ts";
import type { Listener } from "@/types/listeners.ts";

type Vec2 = { x: number; y: number };

type NodeSize = { w: number; h: number };

type Node = {
  id: string;
  kind: "proxy" | "agent";
  label: string;
  ips: string[];
  center: Vec2;
  agentId?: string;
  agent?: LigoloAgent;
};

type Connection = {
  id: string;
  port: number | null;
  from: Vec2;
  to: Vec2;
  fromId: string;
  toId: string;
};

type PortPin = {
  id: string;
  x: number;
  y: number;
  text: string;
  orientation: "horizontal" | "vertical";
  anchor: "start" | "end" | "center";
  dir: Vec2;
  nodeId: string;
  side: "top" | "bottom" | "left" | "right";
};

// layout base
const DEFAULT_NODE_SIZE: NodeSize = { w: 220, h: 190 };
const ROW_Y = 240;
const COLUMN_GAP = DEFAULT_NODE_SIZE.h + 80;
const COL_X = [160, 560, 960]; // Proxy | meio | direita
const PIN_OFFSET = 15;
const TUNNEL_COLOR_LIGHT = "rgba(100,116,139,0.85)"; // slate-500
const TUNNEL_COLOR_DARK = "rgba(148,163,184,0.7)"; // slate-400
const PORT_FILL_LIGHT = "#ffcc29";
const PORT_FILL_DARK = "#facc15";
const TUNNEL_WIDTH = 8;
// distância entre túneis paralelos do mesmo par
const PARALLEL_GAP = 14;
const PIN_STACK_GAP = 16;
const POS_STORAGE_KEY = "topology-node-positions";

// helpers -----------------------------------------------------------------
function asArray<T = unknown>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (val && typeof val === "object") return Object.values(val) as T[];
  return [];
}
function parseHostPort(addr?: string | null): { host: string | null; port: number | null } {
  if (!addr) return { host: null, port: null };
  const parts = String(addr).trim().split(":");
  const host = parts[0] || null;
  const port = parts.length > 1 ? Number(parts[1]) : null;
  return { host, port: Number.isFinite(port) ? port : null };
}
function uniqueIPv4s(addresses?: unknown): string[] {
  const out: string[] = [];
  asArray<string | number | null | undefined>(addresses).forEach((a) => {
    const ip = String(a ?? "").split("/")[0];
    if (ip && ip.includes(".") && ip !== "127.0.0.1" && !out.includes(ip)) out.push(ip);
  });
  return out;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

function normalizeVec(dx: number, dy: number): Vec2 {
  const length = Math.hypot(dx, dy);
  if (!length) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

function edgePoint(from: Vec2, toward: Vec2, size: NodeSize): Vec2 {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (!dx && !dy) return { ...from };
  const halfW = size.w / 2;
  const halfH = size.h / 2;
  const scale = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 1);
  return { x: from.x + dx / scale, y: from.y + dy / scale };
}

function createPortPin(
  id: string,
  origin: Vec2,
  target: Vec2,
  text: string,
  nodeId: string,
): PortPin {
  const rawDir = normalizeVec(target.x - origin.x, target.y - origin.y);
  const hasDirection = Math.abs(rawDir.x) > 0.0001 || Math.abs(rawDir.y) > 0.0001;
  const dir = hasDirection ? rawDir : { x: 1, y: 0 };
  const pos = {
    x: origin.x + dir.x * PIN_OFFSET,
    y: origin.y + dir.y * PIN_OFFSET,
  };
  const orientation = Math.abs(dir.x) >= Math.abs(dir.y) ? "horizontal" : "vertical";
  const anchor =
    orientation === "horizontal"
      ? dir.x >= 0
        ? "start"
        : "end"
      : "center";
  const side:
    | "top"
    | "bottom"
    | "left"
    | "right" =
    orientation === "horizontal"
      ? dir.x >= 0
        ? "right"
        : "left"
      : dir.y >= 0
        ? "bottom"
        : "top";

  return { id, x: pos.x, y: pos.y, text, orientation, anchor, dir, nodeId, side };
}

function ipv4ToInt(ip: string): number | null {
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  return (
    ((octets[0] << 24) >>> 0) +
    ((octets[1] << 16) >>> 0) +
    ((octets[2] << 8) >>> 0) +
    (octets[3] >>> 0)
  ) >>> 0;
}

function intToIPv4(value: number): string {
  const v = value >>> 0;
  return [
    (v >>> 24) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff,
  ].join(".");
}

function toNetwork(address?: string | null): string | null {
  if (!address) return null;
  const [ip, prefixStr] = String(address).split("/");
  if (!prefixStr) return null;
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const ipValue = ipv4ToInt(ip.trim());
  if (ipValue === null) return null;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  const networkValue = ipValue & mask;
  return `${intToIPv4(networkValue)}/${prefix}`;
}

type AgentRouteOption = {
  value: string;
  interfaceName: string;
  address: string;
};

function buildAgentRouteOptions(agent?: LigoloAgent | null): AgentRouteOption[] {
  if (!agent) return [];

  const options: AgentRouteOption[] = [];
  const seen = new Set<string>();

  (agent.Network ?? []).forEach((network) => {
    const ifaceName = network?.Name || `Interface ${network?.Index ?? ""}`.trim();
    (network?.Addresses ?? []).forEach((addr) => {
      const networkAddr = toNetwork(addr);
      if (!networkAddr || seen.has(networkAddr)) return;
      seen.add(networkAddr);
      options.push({
        value: networkAddr,
        interfaceName: ifaceName || networkAddr,
        address: String(addr ?? networkAddr),
      });
    });
  });

  return options;
}

// componente ---------------------------------------------------------------
function loadStoredPositions(): Record<string, Vec2> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, Vec2> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, value]) => {
      if (!value || typeof value !== "object") return;
      const { x, y } = value as Partial<Vec2>;
      if (typeof x !== "number" || typeof y !== "number") return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      out[id] = { x, y };
    });
    return out;
  } catch (error) {
    console.error("Failed to parse stored topology positions", error);
    return {};
  }
}

export default function Topology() {
  const { agents, mutate: mutateAgents } = useAgents();
  const {
    listeners,
    loading: listenersLoading,
    mutate: mutateListeners,
  } = useListeners();
  const listenerModalOpenerRef = useRef<((agentId?: number) => void) | null>(null);
  const { interfaces, mutate: mutateInterfaces } = useInterfaces();
  const interfaceNames = useMemo(
    () => (interfaces ? Object.keys(interfaces) : []),
    [interfaces],
  );
  const { isDark } = useTheme();
  const { setError } = useContext(ErrorContext);
  const { post, del } = useApi();
  const {
    isOpen: isInterfaceModalOpen,
    onOpen: onInterfaceModalOpen,
    onOpenChange: onInterfaceModalOpenChange,
  } = useDisclosure();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const {
    isOpen: isRouteModalOpen,
    onOpen: onRouteModalOpen,
    onClose: onRouteModalClose,
  } = useDisclosure();
  const [routeAgentId, setRouteAgentId] = useState<string | null>(null);
  const [nodeSizes, setNodeSizes] = useState<Record<string, NodeSize>>({});
  const nodeObserverRef = useRef<Map<string, ResizeObserver>>(new Map());
  const tunnelColor = isDark ? TUNNEL_COLOR_DARK : TUNNEL_COLOR_LIGHT;
  const portFill = isDark ? PORT_FILL_DARK : PORT_FILL_LIGHT;
  const listenerList = useMemo(
    () => asArray<Partial<Listener>>(listeners),
    [listeners],
  );
  const selectedRouteAgent = useMemo<LigoloAgent | null>(() => {
    if (!routeAgentId || !agents) return null;
    const map = agents as unknown as Record<string, LigoloAgent>;
    return map[routeAgentId] ?? null;
  }, [agents, routeAgentId]);

  // ip -> agentId
  const ipToAgent = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries<LigoloAgent>(agents ?? {}).forEach(([agentId, agent]) => {
      (agent.Network ?? []).forEach((net) => {
        uniqueIPv4s(net?.Addresses).forEach((ip) => map.set(ip, agentId));
      });
    });
    return map;
  }, [agents]);

  // monta nós (position inicial em colunas)
  const initialNodes = useMemo<Node[]>(() => {
    const proxyIPs = new Set<string>();
    listenerList.forEach((listener) => {
      const { host: target } = parseHostPort(listener?.RedirectAddr ?? listener?.RemoteAddr);
      if (target && !ipToAgent.has(target)) proxyIPs.add(target);
    });

    const layoutColumn = (items: Omit<Node, "center">[], colIndex: number) =>
      items.map((item, index) => ({
        ...item,
        center: { x: COL_X[colIndex], y: ROW_Y + index * COLUMN_GAP },
      }));

    const proxyNodes = layoutColumn(
      [...proxyIPs].map<Omit<Node, "center">>((ip) => ({
        id: `proxy-${ip}`,
        kind: "proxy",
        label: "PROXY",
        ips: [ip],
      })),
      0,
    );

    const agentsWithProxy: Omit<Node, "center">[] = [];
    const regularAgents: Omit<Node, "center">[] = [];

    Object.entries<LigoloAgent>(agents ?? {}).forEach(([agentId, agent]) => {
      const ipSet = new Set<string>();
      (agent.Network ?? []).forEach((network) => {
        uniqueIPv4s(network?.Addresses).forEach((ip) => ipSet.add(ip));
      });
      const ips = [...ipSet];
      const hasToProxy = listenerList.some((listener) => {
        const { host: src } = parseHostPort(listener?.ListenerAddr);
        const { host: dst } = parseHostPort(listener?.RedirectAddr ?? listener?.RemoteAddr);
        return src && ipToAgent.get(src) === agentId && dst && proxyIPs.has(dst);
      });

      const targetArray = hasToProxy ? agentsWithProxy : regularAgents;
      targetArray.push({
        id: `agent-${agentId}`,
        kind: "agent",
        label: agent.Name || agentId,
        ips,
        agentId,
        agent,
      });
    });

    return [
      ...proxyNodes,
      ...layoutColumn(agentsWithProxy, 1),
      ...layoutColumn(regularAgents, 2),
    ];
  }, [agents, listenerList, ipToAgent]);

  const storedPositions = useMemo(loadStoredPositions, []);

  // positions (draggable)
  const [pos, setPos] = useState<Record<string, Vec2>>(() => {
    const base = Object.fromEntries(initialNodes.map((n) => [n.id, n.center]));
    return { ...base, ...storedPositions };
  });
  // inicializa/atualiza se nós mudarem (ex.: reconexões)
  useEffect(() => {
    setPos((prev) => {
      const next: Record<string, Vec2> = {};
      initialNodes.forEach((n) => {
        next[n.id] = prev[n.id] ?? storedPositions[n.id] ?? n.center;
      });
      return next;
    });
  }, [initialNodes, storedPositions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const toStore: Record<string, Vec2> = {};
    initialNodes.forEach((node) => {
      const current = pos[node.id];
      if (!current) return;
      const x = Number(current.x);
      const y = Number(current.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      toStore[node.id] = { x, y };
    });
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(toStore));
  }, [pos, initialNodes]);

  // nodes merged with live positions
  const nodes: Node[] = useMemo(
    () =>
      initialNodes.map((n) => ({
        ...n,
        center: pos[n.id] ?? n.center,
      })),
    [initialNodes, pos],
  );
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const registerNode = useCallback(
    (id: string, node: HTMLDivElement | null) => {
      const existing = nodeObserverRef.current.get(id);
      if (existing) {
        existing.disconnect();
        nodeObserverRef.current.delete(id);
      }

      if (!node) return;

      const updateSize = (width: number, height: number) => {
        const w = Math.round(width);
        const h = Math.round(height);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        setNodeSizes((prev) => {
          const prevSize = prev[id];
          if (prevSize && prevSize.w === w && prevSize.h === h) return prev;
          return { ...prev, [id]: { w, h } };
        });
      };

      const measure = () => {
        const rect = node.getBoundingClientRect();
        updateSize(rect.width, rect.height);
      };

      measure();

      if (typeof ResizeObserver === "undefined") return;

      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const { width, height } = entry.contentRect;
          updateSize(width, height);
        });
      });

      observer.observe(node);
      nodeObserverRef.current.set(id, observer);
    },
    [],
  );

  useEffect(() => {
    return () => {
      nodeObserverRef.current.forEach((observer) => observer.disconnect());
      nodeObserverRef.current.clear();
    };
  }, []);

  // -------------------- CONEXÕES (com linhas paralelas) -------------------
  const connections = useMemo<Connection[]>(() => {
    type BaseConn = {
      id: string;
      port: number | null;
      from: Vec2;
      to: Vec2;
      srcId: string;
      dstId: string;
      fromId: string;
      toId: string;
    };

    const base: BaseConn[] = [];
    const nodeIdForHost = (host: string | null) => {
      if (!host) return null;
      const agentId = ipToAgent.get(host);
      if (agentId) return `agent-${agentId}`;
      return `proxy-${host}`;
    };

    listenerList.forEach((listener, index) => {
      const src = parseHostPort(listener?.ListenerAddr);
      const dst = parseHostPort(listener?.RedirectAddr ?? listener?.RemoteAddr);
      const port = dst.port ?? src.port ?? null;

      const srcId = nodeIdForHost(src.host ?? null);
      const dstId = nodeIdForHost(dst.host ?? null);
      if (!srcId || !dstId) return;

      const srcNode = nodesById[srcId];
      const dstNode = nodesById[dstId];
      if (!srcNode || !dstNode) return;

      const from = edgePoint(
        srcNode.center,
        dstNode.center,
        nodeSizes[srcId] ?? DEFAULT_NODE_SIZE,
      );
      const to = edgePoint(
        dstNode.center,
        srcNode.center,
        nodeSizes[dstId] ?? DEFAULT_NODE_SIZE,
      );

      base.push({
        id: `conn-${index}`,
        port,
        from,
        to,
        // padroniza a “ordem” para agrupar (par não-direcionado)
        srcId: srcId < dstId ? srcId : dstId,
        dstId: srcId < dstId ? dstId : srcId,
        fromId: srcId,
        toId: dstId,
      });
    });

    // agrupa por par de nós (independente da direção)
    const groups = new Map<string, BaseConn[]>();
    for (const c of base) {
      const key = `${c.srcId}|${c.dstId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    // aplica deslocamento perpendicular para paralelizar
    const finalConns: Connection[] = [];
    for (const [, arr] of groups.entries()) {
      // ordena por porta só para ter um posicionamento estável
      arr.sort((a, b) => (a.port ?? 0) - (b.port ?? 0));
      const n = arr.length;
      const middle = (n - 1) / 2;

      arr.forEach((c, i) => {
        const dx = c.to.x - c.from.x;
        const dy = c.to.y - c.from.y;
        const len = Math.hypot(dx, dy) || 1;
        // vetor normal (perpendicular) à linha
        const nx = -dy / len;
        const ny = dx / len;

        // deslocamento relativo à posição na fila (…,-1,0,+1,…)
        const k = (i - middle) * PARALLEL_GAP;

        const shiftedFrom = { x: c.from.x + nx * k, y: c.from.y + ny * k };
        const shiftedTo = { x: c.to.x + nx * k, y: c.to.y + ny * k };

        finalConns.push({
          id: `${c.id}-p${c.port ?? "na"}`,
          port: c.port,
          from: shiftedFrom,
          to: shiftedTo,
          fromId: c.fromId,
          toId: c.toId,
        });
      });
    }

    return finalConns;
  }, [listenerList, nodesById, ipToAgent, nodeSizes]);

  // --------- pins nas entradas/saídas (colados nas bordas) ---------------
  const portPins = useMemo<PortPin[]>(() => {
    const pins: PortPin[] = [];
    connections.forEach((conn) => {
      if (!conn.port) return;
      pins.push(
        createPortPin(`${conn.id}-from`, conn.from, conn.to, String(conn.port), conn.fromId),
      );
      pins.push(
        createPortPin(`${conn.id}-to`, conn.to, conn.from, String(conn.port), conn.toId),
      );
    });

    const grouped = new Map<string, PortPin[]>();
    pins.forEach((pin) => {
      const key = `${pin.nodeId}|${pin.side}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(pin);
    });

    grouped.forEach((group) => {
      if (group.length <= 1) return;
      const side = group[0]?.side;
      if (side === "top" || side === "bottom") {
        group.sort((a, b) => a.x - b.x);
        group.forEach((pin, index) => {
          if (index === 0) return;
          const offset = index * PIN_STACK_GAP;
          pin.y += side === "top" ? -offset : offset;
        });
      }
    });

    return pins;
  }, [connections]);

  const handleTunnelStop = useCallback(
    async (id: string) => {
      try {
        const data = await del(`api/v1/tunnel/${id}`);
        handleApiResponse(data as Parameters<typeof handleApiResponse>[0]);
        if (mutateAgents) await mutateAgents();
      } catch (error) {
        setError(error);
      }
    },
    [del, mutateAgents, setError],
  );

  const handleTunnelStart = useCallback(
    async (id: string, iface: string) => {
      try {
        const data = await post(`api/v1/tunnel/${id}`, { interface: iface });
        handleApiResponse(data as Parameters<typeof handleApiResponse>[0]);
        if (mutateAgents) await mutateAgents();
      } catch (error) {
        setError(error);
      }
    },
    [post, mutateAgents, setError],
  );

  const openInterfaceModalForAgent = useCallback(
    (agentId?: string | null) => {
      setSelectedAgent(agentId ?? null);
      onInterfaceModalOpen();
    },
    [onInterfaceModalOpen],
  );

  const openListenerModalForAgent = useCallback((agentId?: string | null) => {
    const parsed = agentId != null ? Number(agentId) : undefined;
    const numericAgentId = typeof parsed === "number" && Number.isFinite(parsed)
      ? parsed
      : undefined;
    listenerModalOpenerRef.current?.(numericAgentId);
  }, []);

  useEffect(() => {
    return () => {
      listenerModalOpenerRef.current = null;
    };
  }, []);

  const onInterfaceCreated = useCallback(
    async (interfaceName?: string) => {
      onInterfaceModalOpenChange();

      if (interfaceName && selectedAgent) {
        await handleTunnelStart(selectedAgent, interfaceName);
      }

      if (mutateAgents) await mutateAgents();
      if (mutateInterfaces) await mutateInterfaces();
      setSelectedAgent(null);
    },
    [
      handleTunnelStart,
      mutateAgents,
      mutateInterfaces,
      onInterfaceModalOpenChange,
      selectedAgent,
    ],
  );

  const openRouteModalForAgent = useCallback(
    (agentId: string) => {
      setRouteAgentId(agentId);
      onRouteModalOpen();
    },
    [onRouteModalOpen],
  );

  const closeRouteModal = useCallback(() => {
    setRouteAgentId(null);
    onRouteModalClose();
  }, [onRouteModalClose]);

  const handleRouteCreate = useCallback(
    async (interfaceName: string, routeValue: string) => {
      try {
        const data = await post("api/v1/routes", {
          interface: interfaceName,
          route: [routeValue],
        });
        handleApiResponse(data as Parameters<typeof handleApiResponse>[0]);
        if (mutateInterfaces) await mutateInterfaces();
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [mutateInterfaces, post, setError],
  );

  // drag-n-drop ------------------------------------------------------------
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; offset: Vec2 } | null>(null);

  function toLocalPoint(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top, rect };
  }

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!drag) return;
      const local = toLocalPoint(ev.clientX, ev.clientY);
      if (!local) return;
      const { rect } = local;
      const size = nodeSizes[drag.id] ?? DEFAULT_NODE_SIZE;
      const nextX = clamp(local.x - drag.offset.x, size.w / 2, rect.width - size.w / 2);
      const nextY = clamp(local.y - drag.offset.y, size.h / 2, rect.height - size.h / 2);
      setPos((p) => ({ ...p, [drag.id]: { x: nextX, y: nextY } }));
    }
    function onUp() {
      setDrag(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, nodeSizes]);

  function beginDrag(e: React.MouseEvent, n: Node) {
    const local = toLocalPoint(e.clientX, e.clientY);
    if (!local) return;
    setDrag({ id: n.id, offset: { x: local.x - n.center.x, y: local.y - n.center.y } });
  }

  // UI --------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8 py-6 pb-12">
      <InterfaceCreationModal
        isOpen={isInterfaceModalOpen}
        onOpenChange={onInterfaceCreated}
        mutate={mutateInterfaces}
      />
      <AgentRouteModal
        isOpen={isRouteModalOpen}
        onClose={closeRouteModal}
        agent={selectedRouteAgent}
        agentId={routeAgentId}
        interfaces={interfaces}
        onCreateRoute={handleRouteCreate}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Topologia
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie listeners enquanto visualiza a topologia da rede em tempo real.
          </p>
        </div>
      </div>

      <ListenerManagementSection
        listeners={listeners}
        loading={listenersLoading}
        mutate={mutateListeners}
        className="gap-6"
        showCreationButton={false}
        onRegisterCreateListener={(open) => {
          listenerModalOpenerRef.current = open;
        }}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Tooltip content="Criar uma nova interface Ligolo">
          <Button
            color="primary"
            endContent={<PlusIcon size={16} />}
            variant="flat"
            onPress={() => openInterfaceModalForAgent(null)}
          >
            Nova Interface
          </Button>
        </Tooltip>
        <Tooltip content="Criar um novo listener">
          <Button
            color="primary"
            endContent={<PlusIcon size={16} />}
            variant="flat"
            onPress={() => openListenerModalForAgent(null)}
          >
            Novo Listener
          </Button>
        </Tooltip>
      </div>

      <section className="flex flex-col gap-3">
        <div
          ref={stageRef}
          className="relative w-full min-h-[460px] rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900"
          style={{ minHeight: 1200, height: "clamp(420px, 65vh, 720px)" }}
        >
        {/* conexões */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          {connections.map((conn) => (
            <line
              key={conn.id}
              x1={conn.from.x}
              y1={conn.from.y}
              x2={conn.to.x}
              y2={conn.to.y}
              strokeWidth={TUNNEL_WIDTH}
              stroke={tunnelColor}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {portPins.map((p) => {
            const W = 40;
            const H = 12;
            const R = 5;
            const rectX =
              p.orientation === "horizontal"
                ? p.anchor === "end"
                  ? p.x - W
                  : p.x
                : p.x - W / 2;
            const rectY = p.y - H / 2;
            const cx = rectX + W / 2;
            const cy = rectY + H / 2;

            return (
              <g key={p.id}>
                <rect
                  x={rectX}
                  y={rectY}
                  width={W}
                  height={H}
                  rx={R}
                  fill={portFill}
                  opacity="0.85"
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-mono text-[11px] fill-slate-800 dark:fill-slate-900"
                >
                  {p.text}
                </text>
              </g>
            );
          })}
        </svg>

        {/* nodes */}
        {nodes.map((n) => {
          const size = nodeSizes[n.id] ?? DEFAULT_NODE_SIZE;
          return (
            <div
              key={n.id}
              ref={(el) => registerNode(n.id, el)}
              onMouseDown={(e) => beginDrag(e, n)}
              className="absolute -translate-x-1/2 -translate-y-1/2 select-none cursor-grab active:cursor-grabbing"
              style={{ left: n.center.x, top: n.center.y, width: size.w }}
            >
              <div className="h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xl transition-colors dark:border-slate-700 dark:bg-slate-800">
                <div style={{ marginTop: 5, marginLeft: 5 }}>
                  {n.label.includes("root") ? (
                    <img src={hash} width={30} />
                  ) : (
                    <img width={30} src={cifrao} />
                  )}
                </div>

                <div className="flex h-full flex-col gap-3 px-4 py-3">
                  <div className="flex flex-1 flex-col items-center gap-2 text-center">
                    <div
                      style={{ fontSize: 12 }}
                      className="text-base font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {n.label}
                    </div>
                    {n.ips.length > 0 && (
                      <div className="flex max-h-24 w-full flex-wrap justify-center gap-1 overflow-y-auto">
                        {n.ips.map((ip) => (
                          <span
                            key={ip}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                          >
                            {ip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {n.kind === "agent" && n.agent && n.agentId && (
                    <AgentTunnelPanel
                      agent={n.agent}
                      agentId={n.agentId}
                      interfaceNames={interfaceNames}
                      onStart={handleTunnelStart}
                      onStop={handleTunnelStop}
                      onCreateInterface={openInterfaceModalForAgent}
                      onAddRoute={openRouteModalForAgent}
                      onCreateListener={(agentId) => openListenerModalForAgent(agentId)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Arraste as caixas livremente para reorganizar — os túneis paralelos se ajustam
          automaticamente.
        </p>
      </section>
    </div>
  );
}

type AgentTunnelPanelProps = {
  agent: LigoloAgent;
  agentId: string;
  interfaceNames: string[];
  onStart: (agentId: string, iface: string) => Promise<void>;
  onStop: (agentId: string) => Promise<void>;
  onCreateInterface: (agentId: string) => void;
  onAddRoute: (agentId: string) => void;
  onCreateListener: (agentId: string) => void;
};

type TunnelDropdownOption = {
  key: string;
  label: string;
  description?: string;
  icon: ReactNode;
  disabled?: boolean;
  action: "new" | "existing" | "info";
  iface?: string;
};

function AgentTunnelPanel({
  agent,
  agentId,
  interfaceNames,
  onStart,
  onStop,
  onCreateInterface,
  onAddRoute,
  onCreateListener,
}: AgentTunnelPanelProps) {
  const running = agent.Running;
  const interfaceLabel = agent.Interface || "Sem interface ativa";
  const dropdownItems = useMemo<TunnelDropdownOption[]>(() => {
    const base: TunnelDropdownOption[] = [
      {
        key: "new",
        label: "Nova interface",
        description: "Criar uma nova interface e iniciar o túnel",
        icon: (
          <NetworkIcon className="text-lg text-default-500 pointer-events-none flex-shrink-0" />
        ),
        action: "new",
      },
    ];

    if (interfaceNames.length) {
      interfaceNames.forEach((name) => {
        base.push({
          key: `existing-${name}`,
          label: name,
          description: "Utilizar interface existente",
          icon: (
            <ChevronsLeftRightEllipsis className="text-lg text-default-500 pointer-events-none flex-shrink-0" />
          ),
          action: "existing",
          iface: name,
        });
      });
    } else {
      base.push({
        key: "empty",
        label: "Nenhuma interface disponível",
        icon: (
          <ChevronsLeftRightEllipsis className="text-lg text-default-300 pointer-events-none flex-shrink-0" />
        ),
        action: "info",
        disabled: true,
      });
    }

    return base;
  }, [interfaceNames]);

  const handleDropdownAction = useCallback(
    (key: Key) => {
      const keyStr = String(key);
      const option = dropdownItems.find((item) => item.key === keyStr);
      if (!option || option.disabled) return;

      if (option.action === "new") {
        onCreateInterface(agentId);
        return;
      }

      if (option.action === "existing" && option.iface) {
        void onStart(agentId, option.iface);
      }
    },
    [agentId, dropdownItems, onCreateInterface, onStart],
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-left text-xs shadow-inner dark:border-slate-700/60 dark:bg-slate-800/70">
      <div className="flex items-center justify-between gap-2">
        <Chip
          size="sm"
          color={running ? "success" : "default"}
          variant="flat"
          className="capitalize"
        >
          {running ? "Tunelado" : "Parado"}
        </Chip>

        {running ? (
          <Tooltip content="Encerrar o tunelamento" color="danger">
            <Button
              size="sm"
              color="danger"
              variant="flat"
              startContent={<PowerOff size={16} />}
              onPress={async () => {
                await onStop(agentId);
              }}
            >
              Parar
            </Button>
          </Tooltip>
        ) : (
          <Tooltip content="Iniciar o tunelamento" color="primary">
            <div className="inline-flex">
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    startContent={<Power size={16} />}
                  >
                    Tunelar
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Opções de tunelamento"
                  items={dropdownItems}
                  onAction={handleDropdownAction}
                >
                  {(item) => (
                    <DropdownItem
                      key={item.key}
                      startContent={item.icon}
                      description={item.description}
                      isDisabled={item.disabled}
                    >
                      {item.label}
                    </DropdownItem>
                  )}
                </DropdownMenu>
              </Dropdown>
            </div>
          </Tooltip>
        )}
      </div>

      <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Interface atual
        </span>
        <span className="truncate">{interfaceLabel}</span>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Tooltip content="Criar um listener para este agente" color="primary">
          <Button
            size="sm"
            color="primary"
            variant="light"
            onPress={() => onCreateListener(agentId)}
          >
            + Listener
          </Button>
        </Tooltip>
        <Tooltip content="Adicionar rotas com base nas redes do agente" color="primary">
          <Button
            size="sm"
            color="primary"
            variant="light"
            startContent={<PlusIcon size={16} />}
            onPress={() => onAddRoute(agentId)}
          >
            Adicionar rota
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

type AgentRouteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agent: LigoloAgent | null;
  agentId: string | null;
  interfaces?: LigoloInterfaces | null;
  onCreateRoute: (interfaceName: string, route: string) => Promise<void>;
};

function AgentRouteModal({
  isOpen,
  onClose,
  agent,
  agentId,
  interfaces,
  onCreateRoute,
}: AgentRouteModalProps) {
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  const agentRoutes = useMemo(() => buildAgentRouteOptions(agent), [agent]);
  const interfaceEntries = useMemo(
    () => Object.entries(interfaces ?? {}),
    [interfaces],
  );
  const selectedInterfaceData = useMemo(
    () => (selectedInterface && interfaces ? interfaces[selectedInterface] : undefined),
    [interfaces, selectedInterface],
  );
  const existingRoutes = useMemo(() => {
    const routes = selectedInterfaceData?.Routes ?? [];
    return new Set(routes.map((route) => route.Destination));
  }, [selectedInterfaceData]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedInterface(null);
      setPendingRoute(null);
    }
  }, [isOpen, agentId]);

  useEffect(() => {
    if (selectedInterface && !(interfaces && interfaces[selectedInterface])) {
      setSelectedInterface(null);
    }
  }, [interfaces, selectedInterface]);

  const handleRouteSelection = useCallback(
    async (routeValue: string) => {
      if (!selectedInterface) return;
      setPendingRoute(routeValue);
      try {
        await onCreateRoute(selectedInterface, routeValue);
      } catch (error) {
        // Erros são tratados globalmente pelo ErrorContext
      } finally {
        setPendingRoute(null);
      }
    },
    [onCreateRoute, selectedInterface],
  );

  const agentLabel = agent?.Name || agentId || "Agente";
  const hasInterfaces = interfaceEntries.length > 0;
  const hasAgentRoutes = agentRoutes.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      size="lg"
      placement="top-center"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent>
        {(modalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span className="text-base font-semibold">Rotas do agente</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{agentLabel}</span>
            </ModalHeader>
            <ModalBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Interfaces Ligolo
                </span>
                {hasInterfaces ? (
                  <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
                    {interfaceEntries.map(([name, iface]) => {
                      const isSelected = selectedInterface === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setSelectedInterface(name)}
                          className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-700 ${
                            isSelected
                              ? "border-primary bg-primary/10 dark:bg-primary/20"
                              : "border-slate-200 bg-white hover:border-primary/60 hover:bg-primary/5 dark:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {name}
                            </span>
                            {isSelected ? (
                              <Chip color="primary" size="sm" variant="flat">
                                Selecionada
                              </Chip>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {iface?.Routes && iface.Routes.length > 0 ? (
                              iface.Routes.map((route, idx) => (
                                <Chip
                                  key={`${route.Destination}-${idx}`}
                                  color={route.Active ? "success" : "warning"}
                                  size="sm"
                                  variant="flat"
                                >
                                  {route.Destination}
                                </Chip>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Nenhuma rota cadastrada
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma interface Ligolo encontrada. Crie uma interface para adicionar rotas.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Rotas disponíveis do agente
                </span>
                {hasAgentRoutes ? (
                  selectedInterface ? (
                    <div className="flex flex-wrap gap-2">
                      {agentRoutes.map((route) => {
                        const alreadyAdded = existingRoutes.has(route.value);
                        const disabled = alreadyAdded || (pendingRoute !== null && pendingRoute !== route.value);
                        return (
                          <Tooltip
                            key={route.value}
                            content={
                              alreadyAdded
                                ? "Rota já adicionada"
                                : `Detectada em ${route.address}`
                            }
                            color={alreadyAdded ? "success" : "default"}
                          >
                            <Button
                              size="sm"
                              color={alreadyAdded ? "success" : "primary"}
                              variant={alreadyAdded ? "flat" : "bordered"}
                              isDisabled={disabled}
                              isLoading={pendingRoute === route.value}
                              onPress={() => handleRouteSelection(route.value)}
                            >
                              <div className="flex flex-col leading-tight">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-100">
                                  {route.value}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-300">
                                  {route.interfaceName}
                                </span>
                              </div>
                            </Button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Selecione uma interface Ligolo para habilitar as rotas sugeridas.
                    </span>
                  )
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma rede foi identificada para este agente.
                  </span>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="danger"
                variant="flat"
                onPress={() => {
                  modalClose();
                }}
              >
                Fechar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
