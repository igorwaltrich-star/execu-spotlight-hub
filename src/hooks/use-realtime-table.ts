import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribe to a table and invalidate the matching React Query keys on any change. */
export function useRealtimeTable(table: string, queryKey: unknown[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(
      `rt:${table}:${Math.random().toString(36).slice(2)}`,
    );
    channel
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
