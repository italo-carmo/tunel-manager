/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useEffect, useMemo, useRef, useState } from "react";

import { ListenerManagementSection } from "@/components/listeners/ListenerManagementSection.tsx";
import useAgents from "@/hooks/useAgents.ts";
import useListeners from "@/hooks/useListeners.ts";
import { useTheme } from "@/hooks/useTheme";
import type { LigoloAgent } from "@/types/agents.ts";
import type { Listener } from "@/types/listeners.ts";

type Vec2 = { x: number; y: number };

type Node = {
  id: string;
  kind: "proxy" | "agent";
  label: string;
  ips: string[];
  center: Vec2;
};

type Connection = {
  id: string;
  port: number | null;
  from: Vec2;
  to: Vec2;
};

type PortPin = {
  id: string;
  x: number;
  y: number;
  text: string;
  orientation: "horizontal" | "vertical";
  anchor: "start" | "end" | "center";
  dir: Vec2;
};

// layout base
const ROW_Y = 240;
const BOX = { w: 220, h: 140 };
const COL_X = [160, 560, 960]; // Proxy | meio | direita
const PIN_OFFSET = 28;
const TUNNEL_COLOR_LIGHT = "rgba(100,116,139,0.85)"; // slate-500
const TUNNEL_COLOR_DARK = "rgba(148,163,184,0.7)"; // slate-400
const PORT_FILL_LIGHT = "#ffcc29";
const PORT_FILL_DARK = "#facc15";
const TUNNEL_WIDTH = 10;
// distância entre túneis paralelos do mesmo par
const PARALLEL_GAP = 14;

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

function edgePoint(from: Vec2, toward: Vec2): Vec2 {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (!dx && !dy) return { ...from };
  const halfW = BOX.w / 2;
  const halfH = BOX.h / 2;
  const scale = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 1);
  return { x: from.x + dx / scale, y: from.y + dy / scale };
}

function createPortPin(
  id: string,
  origin: Vec2,
  target: Vec2,
  text: string,
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

  return { id, x: pos.x, y: pos.y, text, orientation, anchor, dir };
}

// componente ---------------------------------------------------------------
export default function Topology() {
  const { agents } = useAgents();
  const {
    listeners,
    loading: listenersLoading,
    mutate: mutateListeners,
  } = useListeners();
  const { isDark } = useTheme();
  const tunnelColor = isDark ? TUNNEL_COLOR_DARK : TUNNEL_COLOR_LIGHT;
  const portFill = isDark ? PORT_FILL_DARK : PORT_FILL_LIGHT;
  const listenerList = useMemo(
    () => asArray<Partial<Listener>>(listeners),
    [listeners],
  );

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
    const res: Node[] = [];

    // Proxy(s): redirect que não pertence a agente
    const proxyIPs = new Set<string>();
    listenerList.forEach((listener) => {
      const { host: target } = parseHostPort(listener?.RedirectAddr ?? listener?.RemoteAddr);
      if (target && !ipToAgent.has(target)) proxyIPs.add(target);
    });
    [...proxyIPs].forEach((ip) =>
      res.push({
        id: `proxy-${ip}`,
        kind: "proxy",
        label: "PROXY",
        ips: [ip],
        center: { x: COL_X[0], y: ROW_Y },
      }),
    );

    // Agents
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
      const x = hasToProxy ? COL_X[1] : COL_X[2];
      res.push({
        id: `agent-${agentId}`,
        kind: "agent",
        label: agent.Name || agentId,
        ips,
        center: { x, y: ROW_Y },
      });
    });

    return res;
  }, [agents, listenerList, ipToAgent]);

  // positions (draggable)
  const [pos, setPos] = useState<Record<string, Vec2>>(
    Object.fromEntries(initialNodes.map((n) => [n.id, n.center])),
  );
  // inicializa/atualiza se nós mudarem (ex.: reconexões)
  useEffect(() => {
    setPos((prev) => {
      const next = { ...prev };
      initialNodes.forEach((n) => {
        if (!next[n.id]) next[n.id] = n.center;
      });
      return next;
    });
  }, [initialNodes]);

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

  // -------------------- CONEXÕES (com linhas paralelas) -------------------
  const connections = useMemo<Connection[]>(() => {
    type BaseConn = {
      id: string;
      port: number | null;
      from: Vec2;
      to: Vec2;
      srcId: string;
      dstId: string;
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

      const from = edgePoint(srcNode.center, dstNode.center);
      const to = edgePoint(dstNode.center, srcNode.center);

      base.push({
        id: `conn-${index}`,
        port,
        from,
        to,
        // padroniza a “ordem” para agrupar (par não-direcionado)
        srcId: srcId < dstId ? srcId : dstId,
        dstId: srcId < dstId ? dstId : srcId,
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
        });
      });
    }

    return finalConns;
  }, [listenerList, nodesById, ipToAgent]);

  // --------- pins nas entradas/saídas (colados nas bordas) ---------------
  const portPins = useMemo<PortPin[]>(() => {
    const pins: PortPin[] = [];
    connections.forEach((conn) => {
      if (!conn.port) return;
      pins.push(createPortPin(`${conn.id}-from`, conn.from, conn.to, String(conn.port)));
      pins.push(createPortPin(`${conn.id}-to`, conn.to, conn.from, String(conn.port)));
    });
    return pins;
  }, [connections]);

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
      const nextX = clamp(local.x - drag.offset.x, BOX.w / 2, rect.width - BOX.w / 2);
      const nextY = clamp(local.y - drag.offset.y, BOX.h / 2, rect.height - BOX.h / 2);
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
  }, [drag]);

  function beginDrag(e: React.MouseEvent, n: Node) {
    const local = toLocalPoint(e.clientX, e.clientY);
    if (!local) return;
    setDrag({ id: n.id, offset: { x: local.x - n.center.x, y: local.y - n.center.y } });
  }

  // UI --------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8 py-6 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Topologia
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gerencie listeners enquanto visualiza a topologia da rede em tempo real.
        </p>
      </div>

      <ListenerManagementSection
        listeners={listeners}
        loading={listenersLoading}
        mutate={mutateListeners}
        className="gap-6"
      />

      <section className="flex flex-col gap-3">
        <div
          ref={stageRef}
          className="relative w-full min-h-[460px] rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900"
          style={{ minHeight: 900, height: "clamp(420px, 65vh, 720px)" }}
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
            const H = 20;
            const R = 8;
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
        {nodes.map((n) => (
          <div
            key={n.id}
            onMouseDown={(e) => beginDrag(e, n)}
            className="absolute -translate-x-1/2 -translate-y-1/2 select-none cursor-grab active:cursor-grabbing"
            style={{ left: n.center.x, top: n.center.y, width: BOX.w, height: BOX.h }}
          >
            <div className="h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xl transition-colors dark:border-slate-700 dark:bg-slate-800">
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-3">
                <div
                  style={{ fontSize: 12 }}
                  className="text-center text-base font-semibold text-slate-900 dark:text-slate-100"
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
            </div>
          </div>
        ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Dica: arraste as caixas livremente para reorganizar — os túneis paralelos se ajustam
          automaticamente.
        </p>
      </section>
    </div>
  );
}
