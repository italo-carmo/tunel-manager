import { useCallback } from "react";
import {
  Button,
  CircularProgress,
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
import type { LigoloListeners } from "@/types/listeners.ts";

interface ListenerManagementSectionProps {
  listeners?: LigoloListeners;
  loading?: boolean;
  mutate?: KeyedMutator<LigoloListeners>;
  className?: string;
  title?: string;
}

export function ListenerManagementSection({
  listeners,
  loading = false,
  mutate,
  className,
  title = "Listeners",
}: ListenerManagementSectionProps) {
  const { del } = useApi();
  const { onOpenChange, onOpen, isOpen } = useDisclosure();

  const deleteListener = useCallback(
    (listener: LigoloListeners[number]) => async () => {
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
            <>
              {listeners
                ? Object.entries(listeners).map(([row, listener]) => (
                    <TableRow key={row}>
                      <TableCell>{listener.ListenerID}</TableCell>
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
                  ))
                : null}
            </>
          </TableBody>
        </Table>
      </section>
    </>
  );
}

export default ListenerManagementSection;
