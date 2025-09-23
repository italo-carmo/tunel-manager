/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useEffect, useMemo, useRef, useState } from "react";
import useAgents from "@/hooks/useAgents.ts";
import useListeners from "@/hooks/useListeners.ts";
import ciber from "../../assets/ciber.png";
type Vec2 = { x: number; y: number };

// layout base
const ROW_Y = 240;
const BOX = { w: 220, h: 140 };
const COL_X = [160, 560, 960]; // Proxy | meio | direita
const LANE_GAP = 22;

// helpers -----------------------------------------------------------------
function asArray<T = any>(val: any): T[] {
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
function uniqueIPv4s(addresses?: any): string[] {
  const out: string[] = [];
  asArray<string>(addresses).forEach((a) => {
    const ip = String(a).split("/")[0];
    if (ip && ip.includes(".") && ip !== "127.0.0.1" && !out.includes(ip)) out.push(ip);
  });
  return out;
}

// -------------------------------------------------------------------------
type Node = {
  id: string;
  kind: "proxy" | "agent";
  label: string;
  ips: string[];
  center: Vec2;
};

// componente ---------------------------------------------------------------
export default function Topology() {
  const { agents } = useAgents();
  const { listeners } = useListeners();
  const listenerList = asArray(listeners);

  // ip -> agentId
  const ipToAgent = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(agents ?? {}).forEach(([agentId, agent]) => {
      asArray(agent?.Network).forEach((net: any) => {
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
    listenerList.forEach((l: any) => {
      const { host: target } = parseHostPort(l?.RedirectAddr ?? l?.RemoteAddr);
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
    Object.entries(agents ?? {}).forEach(([agentId, agent]) => {
      const ips: string[] = [];
      asArray(agent?.Network).forEach((n: any) => ips.push(...uniqueIPv4s(n?.Addresses)));
      const hasToProxy = listenerList.some((l: any) => {
        const { host: src } = parseHostPort(l?.ListenerAddr);
        const { host: dst } = parseHostPort(l?.RedirectAddr ?? l?.RemoteAddr);
        return src && ipToAgent.get(src) === agentId && dst && proxyIPs.has(dst);
      });
      const x = hasToProxy ? COL_X[1] : COL_X[2];
      res.push({
        id: `agent-${agentId}`,
        kind: "agent",
        label: (agent as any)?.Name || agentId,
        ips: ips.slice(0, 2),
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

  // lanes (sem label central; só pins nas pontas)
  const laneYByPort = useMemo(() => {
    const ports = new Set<number>();
    listenerList.forEach((l: any) => {
      const p =
        parseHostPort(l?.RedirectAddr ?? l?.RemoteAddr).port ??
        parseHostPort(l?.ListenerAddr).port;
      if (p) ports.add(p);
    });
    const sorted = Array.from(ports.values()).sort((a, b) => a - b);
    const map: Record<string, number> = {};
    const startOffset = -((sorted.length - 1) / 2) * LANE_GAP;
    sorted.forEach((p, i) => (map[String(p)] = ROW_Y + startOffset + i * LANE_GAP));
    return map;
  }, [listenerList]);

  // barras contínuas por porta
  type PortBar = { id: string; y: number; x1: number; x2: number; port: number };
  const portBars = useMemo<PortBar[]>(() => {
    const nodesForPort = new Map<number, Set<string>>();
    listenerList.forEach((l: any) => {
      const src = parseHostPort(l?.ListenerAddr);
      const dst = parseHostPort(l?.RedirectAddr ?? l?.RemoteAddr);
      const port = dst.port ?? src.port ?? null;
      if (!port) return;
      const srcId = ipToAgent.get(src.host ?? "")
        ? `agent-${ipToAgent.get(src.host ?? "")}`
        : src.host
        ? `proxy-${src.host}`
        : null;
      const dstId = ipToAgent.get(dst.host ?? "")
        ? `agent-${ipToAgent.get(dst.host ?? "")}`
        : dst.host
        ? `proxy-${dst.host}`
        : null;
      const set = nodesForPort.get(port) ?? new Set<string>();
      if (srcId) set.add(srcId);
      if (dstId) set.add(dstId);
      nodesForPort.set(port, set);
    });

    const bars: PortBar[] = [];
    Array.from(nodesForPort.entries()).forEach(([port, ids]) => {
      const list = Array.from(ids)
        .map((id) => nodesById[id])
        .filter(Boolean) as Node[];
      if (!list.length) return;
      const x1 = Math.min(...list.map((n) => n.center.x - BOX.w / 2));
      const x2 = Math.max(...list.map((n) => n.center.x + BOX.w / 2));
      const y = laneYByPort[String(port)] ?? ROW_Y;
      bars.push({ id: `p-${port}`, y, x1, x2, port });
    });
    bars.sort((a, b) => a.port - b.port);
    return bars;
  }, [listenerList, nodesById, ipToAgent, laneYByPort]);

  // pins nas entradas/saídas (colados nas bordas)
  type PortPin = { id: string; x: number; y: number; text: string; anchor: "start" | "end" };
  const portPins = useMemo<PortPin[]>(() => {
    const pins: PortPin[] = [];
    listenerList.forEach((l: any, i: number) => {
      const src = parseHostPort(l?.ListenerAddr);
      const dst = parseHostPort(l?.RedirectAddr ?? l?.RemoteAddr);
      const port = dst.port ?? src.port ?? null;
      if (!port) return;
      const y = laneYByPort[String(port)] ?? ROW_Y;

      const srcId = ipToAgent.get(src.host ?? "")
        ? `agent-${ipToAgent.get(src.host ?? "")}`
        : src.host
        ? `proxy-${src.host}`
        : null;
      const dstId = ipToAgent.get(dst.host ?? "")
        ? `agent-${ipToAgent.get(dst.host ?? "")}`
        : dst.host
        ? `proxy-${dst.host}`
        : null;

      const srcNode = srcId ? nodesById[srcId] : undefined;
      const dstNode = dstId ? nodesById[dstId] : undefined;

      if (srcNode) pins.push({ id: `pin-s-${i}`, x: srcNode.center.x + BOX.w / 2 + 6, y, text: String(port), anchor: "start" });
      if (dstNode) pins.push({ id: `pin-d-${i}`, x: dstNode.center.x - BOX.w / 2 - 6, y, text: String(port), anchor: "end" });
    });
    return pins;
  }, [listenerList, nodesById, ipToAgent, laneYByPort]);

  // drag-n-drop ------------------------------------------------------------
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; offsetX: number } | null>(null);

  function toLocalX(clientX: number) {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? clientX - r.left : clientX;
    // arraste só no eixo X para manter túneis paralelos
  }

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!drag) return;
      const x = toLocalX(ev.clientX) - drag.offsetX;
      setPos((p) => ({ ...p, [drag.id]: { x, y: ROW_Y } }));
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
    const localX = toLocalX(e.clientX);
    setDrag({ id: n.id, offsetX: localX - n.center.x });
  }

  // UI --------------------------------------------------------------------
  return (
    <div className="p-8">
      <div style={{display: 'flex', alignItems: 'center'}}>
      <h1 className="text-2xl font-semibold mb-6">Topologia</h1>
      <img style={{marginLeft:10}} src={ciber} alt="Ciber" className="mb-6 h-12 object-contain" />

      </div>
      <div ref={stageRef} className="relative w-full h-[460px] rounded-xl border bg-white">
        {/* lanes (atrás das caixas) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
  {portBars.map((b) => (
    <g key={b.id}>
      <line
        x1={b.x1}
        y1={b.y}
        x2={b.x2}
        y2={b.y}
        strokeWidth={18}
        stroke="rgba(100,116,139,0.85)" /* slate-500 */
        strokeLinecap="round"
      />
    </g>
  ))}

  {portPins.map((p) => {
    // config da “bolinha”
    const W = 40, H = 20, R = 8;

    // x da borda esquerda do retângulo (depende do lado)
    const rectX = p.anchor === "end" ? p.x - W : p.x;
    // centro do retângulo
    const cx = rectX + W / 2;
    const cy = p.y;

    return (
      <g key={p.id}>
        <rect
          x={rectX}
          y={cy - H / 2}
          width={W}
          height={H}
          rx={R}
          fill="#ffcc29"
          opacity="0.85"
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-800 font-mono text-[11px]"
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
            <div className="h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex h-full flex-col items-center justify-center gap-1 px-4">
                {/* chips de IPs */}
                {n.ips[0] && (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    {n.ips[0]}
                  </span>
                )}
                <div className="text-base font-semibold text-slate-900">{n.label}</div>
                {n.ips[1] && (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    {n.ips[1]}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Dica: arraste as caixas na horizontal para reorganizar — as linhas se ajustam automaticamente.
      </p>
    </div>
  );
}
