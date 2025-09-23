import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useAgents from "@/hooks/useAgents.ts";
import {
  Button,
  Form,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { EthernetPort } from "lucide-react";
import { useDragControls } from "framer-motion";
import { useApi } from "@/hooks/useApi.ts";
import { LigoloAgent } from "@/types/agents.ts";
import ErrorContext from "@/contexts/Error.tsx";
import { listenerSchema } from "@/schemas/listeners.ts";
import clsx from "clsx";

interface ListenerCreationProps {
  isOpen?: boolean;
  onOpenChange?: () => void;
  mutate?: () => Promise<unknown>;
  agentId?: number;
}

function uniqueIPv4s(addresses?: string[]) {
  const seen = new Set<string>();
  (addresses ?? []).forEach((addr) => {
    const ip = addr?.split?.("/")?.[0];
    if (ip && ip.includes(".") && ip !== "127.0.0.1" && !seen.has(ip)) {
      seen.add(ip);
    }
  });
  return Array.from(seen);
}

export function ListenerCreationModal({
  isOpen,
  onOpenChange,
  mutate,
  agentId,
}: ListenerCreationProps) {
  const [selectedAgent, setSelectedAgent] = useState(agentId);
  const [listenerProtocol, setListenerProtocol] = useState("");
  const [redirectAddr, setRedirectAddr] = useState("");
  const [listenerAddr, setListenerAddr] = useState("");

  const { post } = useApi();
  const { agents } = useAgents();
  const { setError } = useContext(ErrorContext);
  const [formErrors, setFormErrors] = useState({});
  const dragControls = useDragControls();

  useEffect(() => {
    setSelectedAgent(agentId);
  }, [agentId]);

  const selectedAgentData = useMemo(() => {
    if (!agents) return null;
    if (selectedAgent == null) return null;
    const record = agents as unknown as Record<string, LigoloAgent>;
    return record[String(selectedAgent)] ?? null;
  }, [agents, selectedAgent]);

  const agentInterfaces = useMemo(() => {
    if (!selectedAgentData) return [];
    return (selectedAgentData.Network ?? []).map((network, index) => {
      const ips = uniqueIPv4s(network?.Addresses);
      return {
        key: `${network.Index ?? network.Name ?? index}`,
        name: network.Name || `Interface ${network.Index ?? index + 1}`,
        ips,
      };
    });
  }, [selectedAgentData]);

  const listenerIp = useMemo(() => {
    if (!listenerAddr) return "";
    const colonIndex = listenerAddr.lastIndexOf(":");
    if (colonIndex === -1) return listenerAddr;
    return listenerAddr.slice(0, colonIndex);
  }, [listenerAddr]);

  const handleSelectIp = useCallback(
    (ip: string) => {
      setListenerAddr((currentValue) => {
        if (!currentValue) return ip;

        const colonIndex = currentValue.lastIndexOf(":");
        const portPart = colonIndex !== -1 ? currentValue.slice(colonIndex) : "";

        return `${ip}${portPart}`;
      });
    },
    [setListenerAddr],
  );

  const addInterface = useCallback(
    (callback: () => unknown) => async () => {
      const result = listenerSchema.safeParse({
        redirectAddr,
        listenerAddr,
        agentId: selectedAgent,
      });

      if (!result.success) {
        setFormErrors(result.error.flatten().fieldErrors);
        return;
      }

      setFormErrors({});

      await post("api/v1/listeners", {
        listenerAddr,
        redirectAddr,
        agentId: selectedAgent,
        network: listenerProtocol,
      }).catch(setError);

      if (mutate) mutate();
      if (callback) callback();
    },
    [mutate, selectedAgent, listenerAddr, redirectAddr, listenerProtocol],
  );

  const handleHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragControls.start(event.nativeEvent);
    },
    [dragControls],
  );

  return (
    <Modal
      isOpen={isOpen}
      placement="top-center"
      onOpenChange={onOpenChange}
      motionProps={{
        drag: true,
        dragControls,
        dragListener: false,
        dragMomentum: false,
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader
              className="flex flex-col gap-1 cursor-move select-none active:cursor-grabbing"
              onPointerDown={handleHeaderPointerDown}
            >
              Add a new listener
            </ModalHeader>
            <ModalBody>
              <Form validationErrors={formErrors}>
                <Select
                  selectedKeys={selectedAgent != null ? [String(selectedAgent)] : []}
                  onSelectionChange={(keys) => {
                    const key = keys.currentKey;
                    setSelectedAgent(key != null ? Number(key) : undefined);
                  }}
                  label={"Agent"}
                  name={"agentId"}
                >
                  {agents
                    ? Object.entries<LigoloAgent>(agents).map(
                        ([row, agent]) => (
                          <SelectItem
                            key={row}
                            textValue={`${agent.Name} - ${agent.SessionID}`}
                          >
                            {agent.Name} - {agent.SessionID} ({agent.RemoteAddr}
                            )
                          </SelectItem>
                        ),
                      )
                    : null}
                </Select>
                {selectedAgentData ? (
                  <div className="mt-2 rounded-lg border border-default-200 bg-default-50 px-3 py-2">
                    <p className="mb-2 text-xs font-semibold text-default-500">
                      IPv4 disponíveis
                    </p>
                    <div className="flex flex-col gap-2">
                      {agentInterfaces.length ? (
                        agentInterfaces.map((iface) => (
                          <div key={iface.key} className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-default-600">
                              {iface.name}
                            </span>
                            {iface.ips.length ? (
                              <div className="flex flex-wrap gap-2">
                                {iface.ips.map((ip) => (
                                  <button
                                    key={ip}
                                    type="button"
                                    onClick={() => handleSelectIp(ip)}
                                    aria-pressed={listenerIp === ip}
                                    className={clsx(
                                      "rounded-md border px-2 py-0.5 text-[11px] transition-colors focus:outline-none",
                                      listenerIp === ip
                                        ? "border-primary-400 bg-primary-100 text-primary"
                                        : "border-default-200 bg-white text-default-600 hover:border-default-300 hover:bg-default-100",
                                    )}
                                  >
                                    {ip}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-default-400">
                                Nenhum IPv4 disponível.
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-default-400">
                          Nenhuma interface encontrada.
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
                <Input
                  endContent={
                    <EthernetPort className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
                  }
                  label="Agent listening address"
                  placeholder="0.0.0.0:1234"
                  variant="bordered"
                  value={listenerAddr}
                  onValueChange={setListenerAddr}
                  name={"listenerAddr"}
                />
                <Input
                  endContent={
                    <EthernetPort className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
                  }
                  label="Redirect target"
                  placeholder="127.0.0.1:8080"
                  variant="bordered"
                  value={redirectAddr}
                  onValueChange={setRedirectAddr}
                  name={"redirectAddr"}
                />
                <Select
                  defaultSelectedKeys={[listenerProtocol]}
                  onSelectionChange={(keys) => {
                    setListenerProtocol(String(keys.currentKey));
                  }}
                  label="Protocol"
                  placeholder="Protocol"
                >
                  <SelectItem key={"tcp"}>TCP</SelectItem>
                  <SelectItem key={"udp"}>UDP</SelectItem>
                </Select>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="flat" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={addInterface(onClose)}>
                Add listener
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
