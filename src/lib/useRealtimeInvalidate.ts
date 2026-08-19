import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to postgres_changes for `table` and invalidates the given
 * React Query keys on any insert/update/delete, so pages built on useQuery
 * refresh live instead of needing a manual reload. Pass `filter` (e.g.
 * `inquiry_id=eq.<id>`) to scope the subscription to one row/relation.
 *
 * Requires the table to be added to Supabase's `supabase_realtime`
 * publication (see supabase/migrations) and RLS to allow the current
 * client's role to read it — otherwise no events arrive, silently.
 */
export function useRealtimeInvalidate(
  table: string,
  queryKeys: QueryKey[],
  options?: { filter?: string; enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const filter = options?.filter;
  const keysDep = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`realtime-${table}-${filter ?? "all"}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table },
        () => {
          for (const key of queryKeys) queryClient.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, enabled, keysDep]);
}
