import { LigoloAgent } from "@/types/agents.ts";
import {
  Accordion,
  AccordionItem,
  Button,
  Chip,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronsLeftRightEllipsis,
  FileCog,
  NetworkIcon,
  Power,
  PowerOff,
} from "lucide-react";
import useInterfaces from "@/hooks/useInterfaces.ts";
import { useContext, useMemo, type Key, type ReactNode } from "react";
import { AgentTableContext } from "@/pages/agents/contexts/agentTableContext.ts";
import { getAvailableTunnelInterfaceNames } from "@/lib/ligoloInterfaceNames.ts";

interface IAgentActionsProps {
  agent: LigoloAgent;
  row: string;
}

type TunnelActionItem = {
  key: string;
  label: string;
  description: string;
  action: "new" | "existing";
  iface?: string;
  icon: ReactNode;
  showDivider?: boolean;
};

export const AgentActions = ({ agent, row }: IAgentActionsProps) => {
  const { interfaces } = useInterfaces();
  const {
    onTunnelStart,
    onTunnelStop,
    onInterfaceModal,
    onAutorouteModal,
    toggleAgentExpand,
    agentExpand,
  } = useContext(AgentTableContext);
  const tunnelItems = useMemo<TunnelActionItem[]>(() => {
    const interfaceNames = getAvailableTunnelInterfaceNames(interfaces);

    return [
      {
        key: "new-interface",
        label: "Start with a new interface",
        description: "Create a random interface then start the tunnel",
        action: "new",
        icon: (
          <NetworkIcon className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
        ),
        showDivider: interfaceNames.length > 0,
      },
      ...interfaceNames.map((ifName) => ({
        key: `interface-${ifName}`,
        label: `Bind to ${ifName}`,
        description: "Use the following interface",
        action: "existing" as const,
        iface: ifName,
        icon: (
          <ChevronsLeftRightEllipsis className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
        ),
      })),
    ];
  }, [interfaces]);

  const handleTunnelAction = (key: Key) => {
    const item = tunnelItems.find((option) => option.key === String(key));
    if (!item) return;

    if (item.action === "new") {
      void onInterfaceModal(parseInt(row))();
      return;
    }

    if (item.iface) void onTunnelStart(row, item.iface)();
  };

  return (
    <div className="relative flex justify-between">
      <div className="flex items-center gap-2">
        <Button size="sm" isIconOnly onPress={onAutorouteModal(parseInt(row))}>
          <Tooltip content={"Autoroute"}>
            <FileCog size={15} />
          </Tooltip>
        </Button>
        <Dropdown>
          {agent.Running ? (
            <Button
              color={"danger"}
              size="sm"
              isIconOnly
              onPress={onTunnelStop(row)}
            >
              <Tooltip color={"danger"} content={"Stop tunneling"}>
                <PowerOff size={15} />
              </Tooltip>
            </Button>
          ) : (
            <DropdownTrigger>
              <Button color={"default"} size="sm" isIconOnly>
                <Tooltip color={"default"} content={"Setup tunneling"}>
                  <Power size={15} />
                </Tooltip>
              </Button>
            </DropdownTrigger>
          )}

          {!agent.Running && (
            <>
              <DropdownMenu
                aria-label="Static Actions"
                items={tunnelItems}
                onAction={handleTunnelAction}
              >
                {(item) => (
                  <DropdownItem
                    key={item.key}
                    textValue={item.label}
                    startContent={item.icon}
                    showDivider={item.showDivider}
                    description={item.description}
                  >
                    {item.label}
                  </DropdownItem>
                )}
              </DropdownMenu>
            </>
          )}
        </Dropdown>
      </div>
      <Button
        size="sm"
        isIconOnly
        onPress={() => toggleAgentExpand(parseInt(row))}
      >
        {row === `${agentExpand}` ? (
          <ChevronDown size={15} />
        ) : (
          <ChevronLeft size={15} />
        )}
      </Button>
    </div>
  );
};

interface AgentInterfaceListProps {
  agent: LigoloAgent;
  open: boolean;
}

export const AgentInterfaceList = ({
  agent,
  open,
}: AgentInterfaceListProps) => {
  return (
    <Accordion selectedKeys={open ? ["1"] : []} className="-mt-[50px]">
      <AccordionItem key="1" indicator={<></>}>
        <Divider className="mt-4" />
        <Table removeWrapper hideHeader className="flex flex-col p-2">
          <TableHeader>
            <TableColumn>Name</TableColumn>
            <TableColumn>Ifaces</TableColumn>
          </TableHeader>
          <TableBody>
            {agent.Network.map((network) => (
              <TableRow key={network.Name} className="flex items-center ">
                <TableCell> {network.Name}: </TableCell>
                <TableCell className="flex gap-2">
                  {network.Addresses
                    ? network.Addresses.map((net) => (
                        <Chip size="sm" key={net}>
                          {net}
                        </Chip>
                      ))
                    : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionItem>
    </Accordion>
  );
};
