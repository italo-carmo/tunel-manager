import { ListenerManagementSection } from "@/components/listeners/ListenerManagementSection.tsx";
import useListeners from "@/hooks/useListeners.ts";

export default function ListenersPage() {
  const { listeners, loading, mutate } = useListeners();

  return (
    <ListenerManagementSection
      listeners={listeners}
      loading={loading}
      mutate={mutate}
      className="py-6 md:py-10"
    />
  );
}
