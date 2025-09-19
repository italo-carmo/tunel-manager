import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import clsx from "clsx";
import { Chip, CircularProgress } from "@heroui/react";

import useAgents from "@/hooks/useAgents.ts";
import useListeners from "@/hooks/useListeners.ts";
import { LigoloAgent } from "@/types/agents.ts";
import { Listener } from "@/types/listeners.ts";

interface Position {
  x: number;
  y: number;
}

interface NodeSize {
  width: number;
  height: number;
}

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
}

interface TunnelConnection {
  id: string;
  from: Position;
  to: Position;
  status: "online" | "offline";
  path: string;
  label?: string | null;
  labelPosition?: Position;
}

interface TunnelConnectionMetadata {
  listenerId: number;
  agentId: number;
  targetHost: string | null;
  targetPort: string | null;
  listenerPort: string | null;
  candidateHosts: string[];
  displayPort: string | null;
  displayTarget: string | null;
}

interface NormalizedTunnel {
  id: string;
  status: "online" | "offline";
  label: string;
  details: string[];
  kind: "listener" | "primary";
  connection?: TunnelConnectionMetadata;
}

interface TunnelEndpoint {
  id: string;
  x: number;
  y: number;
  tunnel: NormalizedTunnel;
}

interface RemoteHostConnectionInfo {
  agentId: string;
  agentName: string;
  tunnel: NormalizedTunnel;
}

interface AgentTopologyNode {
  id: string;
  kind: "agent";
  label: string;
  status: "online" | "offline";
  agentId: string;
  agent: LigoloAgent;
  tunnels: NormalizedTunnel[];
}

interface HostTopologyNode {
  id: string;
  kind: "host";
  label: string;
  status: "online" | "offline";
  normalizedHost: string;
  connections: RemoteHostConnectionInfo[];
}

type TopologyNode = AgentTopologyNode | HostTopologyNode;

const DEFAULT_COLUMNS = 3;
const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 260;
const HORIZONTAL_PADDING = 64;
const VERTICAL_PADDING = 64;
const DEFAULT_NODE_SIZE: NodeSize = { width: 288, height: 240 };
const TUNNEL_LENGTH = 180;

interface ParsedAddress {
  host: string;
  port: string | null;
  normalizedHost: string;
}

const normalizeHostValue = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).toLowerCase();
  }

  return trimmed.toLowerCase();
};

const parseAddress = (value?: string | null): ParsedAddress | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    const closingIndex = trimmed.indexOf("]");
    const hostPart = trimmed.slice(1, closingIndex);
    const remainder = trimmed.slice(closingIndex + 1);

    let port: string | null = null;
    if (remainder.startsWith(":")) {
      const portCandidate = remainder.slice(1);
      if (portCandidate && /^\d+$/.test(portCandidate)) port = portCandidate;
    }

    const normalizedHost = normalizeHostValue(hostPart) ?? hostPart.toLowerCase();
    return { host: hostPart, port, normalizedHost };
  }

  const colonCount = (trimmed.match(/:/g) || []).length;

  if (colonCount === 1) {
    const [hostPart, portCandidate] = trimmed.split(":");
    if (portCandidate && /^\d+$/.test(portCandidate)) {
      const normalizedHost =
        normalizeHostValue(hostPart) ?? hostPart.toLowerCase();
      return { host: hostPart, port: portCandidate, normalizedHost };
    }
  }

  const normalizedHost = normalizeHostValue(trimmed) ?? trimmed.toLowerCase();

  return {
    host: trimmed,
    port: null,
    normalizedHost,
  };
};

const parseCidrHost = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) return trimmed;

  return trimmed.slice(0, slashIndex);
};

const uniqueHosts = (values: Array<string | null | undefined>) => {
  const set = new Set<string>();
  values.forEach((value) => {
    const normalized = normalizeHostValue(value);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

const getConnectionLabel = (connection?: TunnelConnectionMetadata) =>
  connection?.displayPort ??
  connection?.listenerPort ??
  connection?.targetPort ??
  null;

const getTunnelHostCandidates = (tunnel: NormalizedTunnel) => {
  if (!tunnel.connection) return [] as string[];

  const hosts = new Set<string>();

  tunnel.connection.candidateHosts.forEach((host) => hosts.add(host));

  const normalizedTarget = normalizeHostValue(tunnel.connection.targetHost);
  if (normalizedTarget) hosts.add(normalizedTarget);

  if (tunnel.connection.displayTarget) {
    const parsedDisplay = parseAddress(tunnel.connection.displayTarget);
    if (parsedDisplay?.normalizedHost) hosts.add(parsedDisplay.normalizedHost);
  }

  return Array.from(hosts);
};

const buildTunnelPath = (from: Position, to: Position) => {
  const midX = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
};

const isListenerLike = (value: unknown): value is Listener => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.ListenerID === "number" &&
    typeof candidate.AgentID === "number" &&
    (typeof candidate.ListenerAddr === "string" ||
      typeof candidate.ListenerAddr === "undefined")
  );
};

const normalizeListener = (listener: Listener): NormalizedTunnel => {
  const details: string[] = [];

  if (listener.ListenerAddr) details.push(`Bind ${listener.ListenerAddr}`);
  if (listener.RedirectAddr) details.push(`Target ${listener.RedirectAddr}`);
  if (listener.RemoteAddr) details.push(`Remote ${listener.RemoteAddr}`);
  if (listener.Network) details.push(`Network ${listener.Network}`);

  const parsedListenerAddr = parseAddress(listener.ListenerAddr);
  const parsedRedirectAddr = parseAddress(listener.RedirectAddr);
  const parsedRemoteAddr = parseAddress(listener.RemoteAddr);

  const candidateHosts = uniqueHosts([
    parsedRedirectAddr?.host,
    parsedRemoteAddr?.host,
  ]);

  const connection: TunnelConnectionMetadata | undefined =
    candidateHosts.length ||
    parsedListenerAddr?.port ||
    parsedRedirectAddr?.port ||
    parsedRemoteAddr?.port
      ? {
          listenerId: listener.ListenerID,
          agentId: listener.AgentID,
          targetHost:
            parsedRedirectAddr?.host ?? parsedRemoteAddr?.host ?? null,
          targetPort:
            parsedRedirectAddr?.port ?? parsedRemoteAddr?.port ?? null,
          listenerPort: parsedListenerAddr?.port ?? null,
          candidateHosts,
          displayPort:
            parsedRedirectAddr?.port ??
            parsedListenerAddr?.port ??
            parsedRemoteAddr?.port ??
            null,
          displayTarget:
            listener.RedirectAddr || listener.RemoteAddr || listener.ListenerAddr ||
            null,
        }
      : undefined;

  return {
    id: `listener-${listener.ListenerID}`,
    status: listener.Online ? "online" : "offline",
    label:
      listener.RedirectAddr ||
      listener.ListenerAddr ||
      `Listener #${listener.ListenerID}`,
    details,
    kind: "listener",
    connection,
  };
};

const createPrimaryTunnel = (
  agent: LigoloAgent,
  agentId: string,
): NormalizedTunnel => {
  const details: string[] = [];

  if (agent.Interface) details.push(`Interface ${agent.Interface}`);
  if (agent.RemoteAddr) details.push(`Remote ${agent.RemoteAddr}`);

  return {
    id: `primary-${agentId}`,
    status: agent.Running ? "online" : "offline",
    label: agent.Interface || "Ligolo tunnel",
    details,
    kind: "primary",
  };
};

const dedupeTunnels = (tunnels: NormalizedTunnel[]) => {
  const map = new Map<string, NormalizedTunnel>();
  tunnels.forEach((tunnel) => {
    if (!map.has(tunnel.id)) map.set(tunnel.id, tunnel);
  });

  return Array.from(map.values());
};

export default function TopologyPage() {
  const { agents, loading: agentsLoading } = useAgents();
  const { listeners, loading: listenersLoading } = useListeners();

  const agentEntries = useMemo(
    () => Object.entries(agents ?? {}) as Array<[string, LigoloAgent]>,
    [agents],
  );

  const listenersByAgent = useMemo(() => {
    if (!listeners) return {} as Record<string, Listener[]>;

    return listeners.reduce<Record<string, Listener[]>>((acc, listener) => {
      const key = `${listener.AgentID}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(listener);
      return acc;
    }, {});
  }, [listeners]);

  const agentAddressMap = useMemo(() => {
    const map = new Map<string, string>();

    agentEntries.forEach(([agentId, agent]) => {
      const addresses = new Set<string>();

      const parsedRemote = parseAddress(agent.RemoteAddr);
      if (parsedRemote?.normalizedHost)
        addresses.add(parsedRemote.normalizedHost);

      agent.Network.forEach((network) => {
        network.Addresses?.forEach((address) => {
          const host = parseCidrHost(address);
          if (!host) return;
          const normalized = normalizeHostValue(host);
          if (normalized) addresses.add(normalized);
        });
      });

      addresses.forEach((address) => {
        if (!map.has(address)) map.set(address, agentId);
      });
    });

    return map;
  }, [agentEntries]);

  const tunnelsByAgent = useMemo(() => {
    const map: Record<string, NormalizedTunnel[]> = {};

    agentEntries.forEach(([agentId, agent]) => {
      const aggregated: NormalizedTunnel[] = [];

      const agentListeners = (agent as unknown as { Listeners?: unknown }).Listeners;
      if (Array.isArray(agentListeners)) {
        agentListeners
          .filter(isListenerLike)
          .forEach((listener) => aggregated.push(normalizeListener(listener)));
      }

      const globalListeners = listenersByAgent[agentId];
      if (globalListeners) {
        globalListeners.forEach((listener) =>
          aggregated.push(normalizeListener(listener)),
        );
      }

      if (agent.Running || !aggregated.length) {
        aggregated.unshift(createPrimaryTunnel(agent, agentId));
      }

      map[agentId] = dedupeTunnels(aggregated);
    });

    return map;
  }, [agentEntries, listenersByAgent]);

  const remoteHostData = useMemo(() => {
    const hostMap = new Map<
      string,
      { label: string; connections: RemoteHostConnectionInfo[] }
    >();

    agentEntries.forEach(([agentId, agent]) => {
      const tunnels = tunnelsByAgent[agentId] ?? [];

      tunnels.forEach((tunnel) => {
        if (tunnel.kind !== "listener" || !tunnel.connection) return;

        const hostCandidates = getTunnelHostCandidates(tunnel);

        const targetAgentId = hostCandidates
          .map((candidate) => agentAddressMap.get(candidate))
          .find(
            (value): value is string => Boolean(value) && value !== agentId,
          );

        if (targetAgentId) return;

        const remoteHostKey = hostCandidates.find(
          (candidate) => !agentAddressMap.has(candidate),
        );

        if (!remoteHostKey) return;

        const displayHost =
          tunnel.connection.targetHost ??
          parseAddress(tunnel.connection.displayTarget)?.host ??
          remoteHostKey;

        if (!hostMap.has(remoteHostKey)) {
          hostMap.set(remoteHostKey, {
            label: displayHost,
            connections: [],
          });
        }

        hostMap.get(remoteHostKey)!.connections.push({
          agentId,
          agentName: agent.Name || `Agent #${agentId}`,
          tunnel,
        });
      });
    });

    const remoteNodes: HostTopologyNode[] = Array.from(hostMap.entries()).map(
      ([normalizedHost, value]) => ({
        id: `host-${normalizedHost}`,
        kind: "host",
        label: value.label,
        status: value.connections.some((item) => item.tunnel.status === "online")
          ? "online"
          : "offline",
        normalizedHost,
        connections: value.connections,
      }),
    );

    const hostIdMap = new Map<string, string>();
    remoteNodes.forEach((node) => hostIdMap.set(node.normalizedHost, node.id));

    return { remoteNodes, hostIdMap };
  }, [agentEntries, agentAddressMap, tunnelsByAgent]);

  const remoteHostNodes = remoteHostData.remoteNodes;
  const remoteHostIdMap = remoteHostData.hostIdMap;

  const agentNodes = useMemo<AgentTopologyNode[]>(
    () =>
      agentEntries.map(([agentId, agent]) => ({
        id: agentId,
        kind: "agent" as const,
        label: agent.Name || "Unnamed agent",
        status: agent.Running ? "online" : "offline",
        agentId,
        agent,
        tunnels: tunnelsByAgent[agentId] ?? [],
      })),
    [agentEntries, tunnelsByAgent],
  );

  const topologyNodes = useMemo<TopologyNode[]>(
    () => [...agentNodes, ...remoteHostNodes],
    [agentNodes, remoteHostNodes],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [nodeSizes, setNodeSizes] = useState<Record<string, NodeSize>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (!topologyNodes.length) {
      setPositions({});
      return;
    }

    setPositions((prev) => {
      const next = { ...prev };
      let changed = false;

      topologyNodes.forEach((node, index) => {
        if (!next[node.id]) {
          const column = index % DEFAULT_COLUMNS;
          const row = Math.floor(index / DEFAULT_COLUMNS);

          next[node.id] = {
            x: HORIZONTAL_PADDING + column * COLUMN_WIDTH,
            y: VERTICAL_PADDING + row * ROW_HEIGHT,
          };
          changed = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!topologyNodes.some((node) => node.id === id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [topologyNodes]);

  useLayoutEffect(() => {
    const updateSizes = () => {
      const updated: Record<string, NodeSize> = {};

      Object.entries(nodeRefs.current).forEach(([id, node]) => {
        if (!node) return;
        updated[id] = {
          width: node.offsetWidth,
          height: node.offsetHeight,
        };
      });

      setNodeSizes((prev) => {
        const prevKeys = Object.keys(prev);
        const updatedKeys = Object.keys(updated);
        const sameSize =
          prevKeys.length === updatedKeys.length &&
          updatedKeys.every(
            (key) =>
              prev[key]?.width === updated[key].width &&
              prev[key]?.height === updated[key].height,
          );

        return sameSize ? prev : updated;
      });
    };

    updateSizes();
    window.addEventListener("resize", updateSizes);

    return () => window.removeEventListener("resize", updateSizes);
  }, [topologyNodes]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const size = nodeSizes[dragState.id] ?? DEFAULT_NODE_SIZE;

      const rawX = event.clientX - rect.left - dragState.offsetX;
      const rawY = event.clientY - rect.top - dragState.offsetY;
      const maxX = Math.max(0, rect.width - size.width);
      const maxY = Math.max(0, rect.height - size.height);

      const clampedX = Math.min(Math.max(0, rawX), maxX);
      const clampedY = Math.min(Math.max(0, rawY), maxY);

      setPositions((prev) => {
        const current = prev[dragState.id];
        if (!current) return prev;
        if (current.x === clampedX && current.y === clampedY) return prev;

        return {
          ...prev,
          [dragState.id]: { x: clampedX, y: clampedY },
        };
      });
    };

    const handlePointerUp = () => setDragState(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, nodeSizes]);

  const handlePointerDown = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();

      setDragState({
        id,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      });
    },
    [],
  );

  const { connections, endpoints } = useMemo(() => {
    const connectionList: TunnelConnection[] = [];
    const endpointList: TunnelEndpoint[] = [];

    const targetTotals = new Map<string, number>();

    agentNodes.forEach((agentNode) => {
      agentNode.tunnels.forEach((tunnel) => {
        if (tunnel.kind !== "listener" || !tunnel.connection) return;

        const hostCandidates = getTunnelHostCandidates(tunnel);

        const targetAgentId = hostCandidates
          .map((candidate) => agentAddressMap.get(candidate))
          .find(
            (value): value is string =>
              Boolean(value) && value !== agentNode.agentId,
          );

        if (targetAgentId) {
          targetTotals.set(
            targetAgentId,
            (targetTotals.get(targetAgentId) ?? 0) + 1,
          );
          return;
        }

        const remoteHostId = hostCandidates
          .map((candidate) => remoteHostIdMap.get(candidate))
          .find((value): value is string => Boolean(value));

        if (remoteHostId) {
          targetTotals.set(
            remoteHostId,
            (targetTotals.get(remoteHostId) ?? 0) + 1,
          );
        }
      });
    });

    const targetUsage = new Map<string, number>();

    agentNodes.forEach((agentNode) => {
      const position = positions[agentNode.id];
      if (!position) return;

      const tunnels = agentNode.tunnels;
      if (!tunnels.length) return;

      const size = nodeSizes[agentNode.id] ?? DEFAULT_NODE_SIZE;
      const step = Math.max(size.height / (tunnels.length + 1), 56);

      tunnels.forEach((tunnel, index) => {
        const anchorY =
          position.y + Math.min(size.height - 32, step * (index + 1));
        const baseFromRight = {
          x: position.x + size.width,
          y: anchorY,
        };
        const baseFromLeft = {
          x: position.x,
          y: anchorY,
        };
        const id = `${agentNode.id}-${tunnel.id}`;
        const label = getConnectionLabel(tunnel.connection);

        const pushConnection = (
          to: Position,
          shouldCreateEndpoint: boolean,
          fromOverride?: Position,
        ) => {
          const fromPoint = fromOverride ?? baseFromRight;
          const path = buildTunnelPath(fromPoint, to);
          connectionList.push({
            id,
            from: fromPoint,
            to,
            status: tunnel.status,
            path,
            label,
            labelPosition: label
              ? {
                  x: fromPoint.x + (to.x - fromPoint.x) / 2,
                  y: fromPoint.y + (to.y - fromPoint.y) / 2 - 12,
                }
              : undefined,
          });

          if (shouldCreateEndpoint) {
            endpointList.push({ id, x: to.x, y: anchorY, tunnel });
          }
        };

        if (tunnel.connection) {
          const hostCandidates = getTunnelHostCandidates(tunnel);

          const targetAgentId = hostCandidates
            .map((candidate) => agentAddressMap.get(candidate))
            .find(
              (value): value is string =>
                Boolean(value) && value !== agentNode.agentId,
            );

          if (targetAgentId && targetAgentId !== agentNode.agentId) {
            const targetPosition = positions[targetAgentId];
            if (targetPosition) {
              const targetSize =
                nodeSizes[targetAgentId] ?? DEFAULT_NODE_SIZE;
              const total = targetTotals.get(targetAgentId) ?? 1;
              const usage = (targetUsage.get(targetAgentId) ?? 0) + 1;
              targetUsage.set(targetAgentId, usage);
              const targetStep = Math.max(targetSize.height / (total + 1), 56);
              const targetAnchorY =
                targetPosition.y +
                Math.min(targetSize.height - 32, targetStep * usage);
              const targetOnRight = targetPosition.x >= position.x;
              const to = {
                x: targetOnRight
                  ? targetPosition.x
                  : targetPosition.x + targetSize.width,
                y: targetAnchorY,
              };
              const fromPoint = targetOnRight ? baseFromRight : baseFromLeft;

              pushConnection(to, false, fromPoint);
              return;
            }
          }

          const remoteHostId = hostCandidates
            .map((candidate) => remoteHostIdMap.get(candidate))
            .find((value): value is string => Boolean(value));

          if (remoteHostId) {
            const targetPosition = positions[remoteHostId];
            if (targetPosition) {
              const targetSize =
                nodeSizes[remoteHostId] ?? DEFAULT_NODE_SIZE;
              const total = targetTotals.get(remoteHostId) ?? 1;
              const usage = (targetUsage.get(remoteHostId) ?? 0) + 1;
              targetUsage.set(remoteHostId, usage);
              const targetStep = Math.max(targetSize.height / (total + 1), 56);
              const targetAnchorY =
                targetPosition.y +
                Math.min(targetSize.height - 32, targetStep * usage);
              const targetOnRight = targetPosition.x >= position.x;
              const to = {
                x: targetOnRight
                  ? targetPosition.x
                  : targetPosition.x + targetSize.width,
                y: targetAnchorY,
              };
              const fromPoint = targetOnRight ? baseFromRight : baseFromLeft;

              pushConnection(to, false, fromPoint);
              return;
            }
          }

          if (tunnel.connection.targetHost) {
            const to = { x: baseFromRight.x + TUNNEL_LENGTH, y: anchorY };
            pushConnection(to, true);
            return;
          }
        }

        const fallbackTo = { x: baseFromRight.x + TUNNEL_LENGTH, y: anchorY };
        pushConnection(fallbackTo, true);
      });
    });

    return { connections: connectionList, endpoints: endpointList };
  }, [agentAddressMap, agentNodes, nodeSizes, positions, remoteHostIdMap]);

  const totalNodes = topologyNodes.length;
  const rows = Math.max(1, Math.ceil(totalNodes / DEFAULT_COLUMNS));
  const canvasHeight = Math.max(rows * ROW_HEIGHT + VERTICAL_PADDING * 2, 520);

  const isInitialLoading = agentsLoading && !agentEntries.length;
  const isListenersLoading = listenersLoading && !listeners;
  const showSpinner = isInitialLoading || isListenersLoading;

  return (
    <section className="flex flex-col gap-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-default-900">Network topology</h1>
        <p className="text-sm text-default-500">
          Visualize connected agents, their interfaces, and every active tunnel in a
          single interactive map.
        </p>
      </header>

      <div
        ref={containerRef}
        className="full relative isolate w-full overflow-hidden rounded-3xl border border-default-200/60 bg-default-50/40 shadow-sm"
        style={{
          height: `${canvasHeight}px`,
          minHeight: `${canvasHeight}px`,
          backgroundImage:
            "linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), " +
            "linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 z-0"
          width="100%"
          height="100%"
          aria-hidden
        >
          <defs>
            <filter id="tunnel-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="6"
                floodColor="rgba(248, 113, 113, 0.55)"
              />
            </filter>
          </defs>
          {connections.map((connection) => (
            <g key={connection.id}>
              <path
                d={connection.path}
                fill="none"
                stroke={
                  connection.status === "online"
                    ? "rgba(248, 113, 113, 0.95)"
                    : "rgba(148, 163, 184, 0.55)"
                }
                strokeWidth={12}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={
                  connection.status === "online" ? undefined : "14 14"
                }
                filter={
                  connection.status === "online" ? "url(#tunnel-glow)" : undefined
                }
              />
              {connection.label ? (
                <text
                  x={
                    connection.labelPosition?.x ??
                    connection.from.x + (connection.to.x - connection.from.x) / 2
                  }
                  y={
                    connection.labelPosition?.y ??
                    connection.from.y + (connection.to.y - connection.from.y) / 2 - 12
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={
                    connection.status === "online"
                      ? "rgba(248, 113, 113, 0.95)"
                      : "rgba(100, 116, 139, 0.75)"
                  }
                >
                  {connection.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>

        {showSpinner ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-content1/40 backdrop-blur-sm">
            <CircularProgress aria-label="Loading topology" size="lg" />
          </div>
        ) : null}

        {!showSpinner && !agentEntries.length ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-lg font-semibold text-default-600">No agents connected</p>
            <p className="max-w-sm text-sm text-default-400">
              Agents will appear automatically as soon as they establish a session with
              the Ligolo server.
            </p>
          </div>
        ) : null}

        {topologyNodes.map((node) => {
          const position = positions[node.id];
          if (!position) return null;

          const isDragging = dragState?.id === node.id;

          let content: JSX.Element;

          if (node.kind === "agent") {
            const agent = node.agent;
            const filteredNetworks = agent.Network.filter(
              (network) => network.Name !== "lo",
            );

            content = (
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-default-200/80 bg-content1/95 p-4 shadow-xl backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">
                      Agent #{node.agentId}
                    </p>
                    <h2 className="text-lg font-semibold text-default-900">
                      {agent.Name || "Unnamed agent"}
                    </h2>
                    <p className="font-mono text-[11px] text-default-500">
                      {agent.RemoteAddr}
                    </p>
                  </div>
                  <Chip
                    color={node.status === "online" ? "success" : "default"}
                    size="sm"
                    variant="flat"
                  >
                    {node.status === "online" ? "Active" : "Stopped"}
                  </Chip>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-default-400">
                    Session
                  </p>
                  <div className="rounded-xl border border-default-200/70 bg-default-100/70 px-3 py-2 text-xs text-default-600 shadow-sm">
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-default-500">Session ID</span>
                      <span className="font-mono text-[11px] text-default-800">
                        {agent.SessionID || "—"}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-default-500">Interface</span>
                      <span className="font-mono text-[11px] text-default-800">
                        {agent.Interface || "—"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-default-400">
                    Network interfaces
                  </p>
                  {filteredNetworks.length ? (
                    <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                      {filteredNetworks.map((network) => (
                        <div
                          key={`${network.Index}-${network.Name}`}
                          className="rounded-xl border border-default-200/70 bg-default-50/80 px-3 py-2 text-[11px] text-default-500 shadow-inner"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-default-700">
                              {network.Name}
                            </span>
                            <span>MTU {network.MTU}</span>
                          </div>
                          {network.Addresses?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {network.Addresses.map((address) => (
                                <Chip
                                  key={address}
                                  size="sm"
                                  variant="flat"
                                  radius="sm"
                                  className="font-mono text-[11px]"
                                >
                                  {address}
                                </Chip>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] italic text-default-400">
                              No addresses
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-default-400">
                      No network interfaces to display.
                    </p>
                  )}
                </div>
              </div>
            );
          } else {
            content = (
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-default-200/80 bg-content1/95 p-4 shadow-xl backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-default-400">
                      Remote host
                    </p>
                    <h2 className="text-lg font-semibold text-default-900">
                      {node.label}
                    </h2>
                    <p className="font-mono text-[11px] text-default-500">
                      {node.normalizedHost}
                    </p>
                  </div>
                  <Chip
                    color={node.status === "online" ? "success" : "default"}
                    size="sm"
                    variant="flat"
                  >
                    {node.status === "online" ? "Active" : "Offline"}
                  </Chip>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-default-400">
                    Linked tunnels
                  </p>
                  {node.connections.length ? (
                    <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                      {node.connections.map((connection) => (
                        <div
                          key={`${node.id}-${connection.tunnel.id}-${connection.agentId}`}
                          className={clsx(
                            "rounded-xl border px-3 py-2 text-[11px] shadow-sm",
                            connection.tunnel.status === "online"
                              ? "border-danger-200/80 bg-danger-50/80 text-danger-600"
                              : "border-default-200 bg-default-50 text-default-500",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              {connection.agentName}
                            </span>
                            <div className="flex items-center gap-1">
                              {connection.tunnel.connection?.displayPort ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  radius="sm"
                                  className="font-mono text-[10px]"
                                >
                                  Port {connection.tunnel.connection.displayPort}
                                </Chip>
                              ) : null}
                              <Chip
                                color={
                                  connection.tunnel.status === "online"
                                    ? "success"
                                    : "default"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {connection.tunnel.status === "online"
                                  ? "Active"
                                  : "Offline"}
                              </Chip>
                            </div>
                          </div>
                          {connection.tunnel.connection?.displayTarget ? (
                            <p className="mt-1 font-mono text-[11px] text-current/80">
                              {connection.tunnel.connection.displayTarget}
                            </p>
                          ) : null}
                          {connection.tunnel.details.length ? (
                            <ul className="mt-2 space-y-[2px] text-[10px] text-current/80">
                              {connection.tunnel.details.map((detail, index) => (
                                <li
                                  key={`${node.id}-${connection.tunnel.id}-detail-${index}`}
                                  className="font-mono"
                                >
                                  {detail}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-default-400">
                      No tunnels linked to this host yet.
                    </p>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={node.id}
              ref={(element) => {
                if (!element) delete nodeRefs.current[node.id];
                else nodeRefs.current[node.id] = element;
              }}
              className={clsx(
                "absolute w-72 select-none transition-shadow",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: isDragging ? 30 : 10,
              }}
              onPointerDown={handlePointerDown(node.id)}
            >
              {content}
            </div>
          );
        })}

        {endpoints.map((endpoint) => (
          <div
            key={endpoint.id}
            className="absolute flex items-center gap-3"
            style={{
              left: `${endpoint.x + 16}px`,
              top: `${endpoint.y - 28}px`,
              zIndex: 20,
            }}
          >
            <span
              className={clsx(
                "block h-4 w-4 rounded-full shadow-lg",
                endpoint.tunnel.status === "online"
                  ? "bg-danger-500 shadow-danger-400/70"
                  : "bg-default-400 shadow-default-300/70",
              )}
            />
            <div
              className={clsx(
                "min-w-[180px] rounded-xl border px-3 py-2 text-xs backdrop-blur-md",
                endpoint.tunnel.status === "online"
                  ? "border-danger-200/80 bg-danger-50/90 text-danger-700"
                  : "border-default-200 bg-default-50/95 text-default-500",
              )}
            >
              <p className="font-semibold">
                {endpoint.tunnel.connection?.targetHost ?? endpoint.tunnel.label}
              </p>
              {endpoint.tunnel.connection?.displayPort ? (
                <p className="font-mono text-[10px] uppercase tracking-wide text-current/70">
                  Port {endpoint.tunnel.connection.displayPort}
                </p>
              ) : null}
              {endpoint.tunnel.details.length ? (
                <ul className="mt-1 space-y-[2px] text-[11px]">
                  {endpoint.tunnel.details.map((detail, index) => (
                    <li
                      key={`${endpoint.id}-endpoint-detail-${index}`}
                      className="font-mono"
                    >
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
