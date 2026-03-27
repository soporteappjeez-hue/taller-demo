import { getSupabase, getValidToken, meliGet, MeliAccount } from "@/lib/meli";
import { humanizeError, extractErrorCode } from "@/lib/sync-error-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos (requiere Vercel Pro o Hobby con límite)

interface AutoSyncRequest {
  origin_id?: string;
  dest_id?: string;
  mode?: "all" | "new_only";
  resume_job_id?: string;
  item_ids?: string[]; // Manual mode: skip compare, clone these specific IDs
}

export async function POST(req: Request) {
  let body: AutoSyncRequest;
  try { body = await req.json(); } catch { body = {}; }

  const { origin_id, dest_id, mode = "all", resume_job_id, item_ids } = body;
  const baseUrl = new URL(req.url).origin;
  const supabase = getSupabase();
  const enc = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      // Keep-alive ping every 25s to prevent Vercel from closing idle connections
      const pingInterval = setInterval(() => {
        if (cancelled) return;
        try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { /* ignored */ }
      }, 25000);

      try {
        let jobId: string;
        let checkpoint: Record<string, unknown> = {};
        let dbAvailable = true; // se pone en false si sync_jobs no existe

        // Helper para operaciones DB que pueden fallar silenciosamente
        const dbUpdate = async (id: string, data: Record<string, unknown>) => {
          if (!dbAvailable || id === "local") return;
          try { await supabase.from("sync_jobs").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id); }
          catch { /* DB unavailable */ }
        };
        const dbCheckStatus = async (id: string): Promise<string | null> => {
          if (!dbAvailable || id === "local") return null;
          try {
            const { data } = await supabase.from("sync_jobs").select("status").eq("id", id).single();
            return (data?.status as string | null) ?? null;
          } catch { return null; }
        };

        if (resume_job_id) {
          const { data: job } = await supabase
            .from("sync_jobs")
            .select("id, checkpoint, status")
            .eq("id", resume_job_id)
            .single();
          if (!job) {
            send("error", { message: "Job no encontrado" });
            clearInterval(pingInterval); controller.close(); return;
          }
          jobId = job.id as string;
          checkpoint = (job.checkpoint ?? {}) as Record<string, unknown>;
          await dbUpdate(jobId, { status: "running" });
        } else {
          const { data: job, error } = await supabase
            .from("sync_jobs")
            .insert({
              status: "running", mode,
              origin_id: origin_id ?? null,
              dest_id: dest_id ?? null,
              checkpoint: {}, summary: {}, error_log: [], logs: [],
            })
            .select("id")
            .single();
          if (error || !job) {
            // Tabla sync_jobs no existe todavía — continuar sin persistencia
            dbAvailable = false;
            jobId = "local";
            send("log", { msg: "⚠️ Nota: ejecutá sync-jobs.sql en Supabase para habilitar Stop/Resume. Continuando sin checkpoint..." });
          } else {
            jobId = (job as { id: string }).id;
          }
        }

        send("jobId", { job_id: jobId });

        // Load active accounts
        const { data: accounts } = await supabase
          .from("meli_accounts")
          .select("id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status")
          .eq("status", "active");

        if (!accounts || accounts.length < 2) {
          send("error", { message: "Se necesitan al menos 2 cuentas activas" });
          await dbUpdate(jobId, { status: "error" });
          clearInterval(pingInterval); controller.close(); return;
        }

        // ---- Manual mode: item_ids provided → skip compare, clone directly ----
        if (item_ids && item_ids.length > 0 && origin_id && dest_id) {
          const orig = accounts.find(a => a.id === origin_id) as MeliAccount | undefined;
          const dst  = accounts.find(a => a.id === dest_id) as MeliAccount | undefined;
          if (!orig || !dst) {
            send("error", { message: "Cuentas no encontradas" });
            await dbUpdate(jobId, { status: "error" });
            clearInterval(pingInterval); controller.close(); return;
          }
          // Validate tokens
          send("log", { msg: "Verificando tokens de las cuentas..." });
          const [originToken, destToken] = await Promise.all([getValidToken(orig), getValidToken(dst)]);
          if (!originToken || !destToken) {
            send("error", { message: "Token expirado. Reconectá las cuentas en Configuración." });
            await dbUpdate(jobId, { status: "error" });
            clearInterval(pingInterval); controller.close(); return;
          }
          send("log", { msg: `✓ Tokens activos. Clonando ${item_ids.length} publicación(es) de ${orig.nickname} → ${dst.nickname}` });

          let totalCloned = 0, totalSkipped = 0, totalErrors = 0;
          const allErrors: Array<{ item_id: string; title: string; reason_code: string; reason_human: string; suggestion: string }> = [];

          const BATCH = 20;
          for (let batchStart = 0; batchStart < item_ids.length; batchStart += BATCH) {
            const statusNow = await dbCheckStatus(jobId);
            if (statusNow === "stopping") {
              await dbUpdate(jobId, {
                status: "paused",
                checkpoint: { item_ids_remaining: item_ids.slice(batchStart) },
                summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors },
              });
              send("stopped", { job_id: jobId, summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors } });
              clearInterval(pingInterval); controller.close(); return;
            }

            const batch = item_ids.slice(batchStart, batchStart + BATCH);
            const batchNum = Math.floor(batchStart / BATCH) + 1;
            const totalBatches = Math.ceil(item_ids.length / BATCH);
            send("log", { msg: `Clonando lote ${batchNum}/${totalBatches} (${batch.length} items)...` });

            try {
              const cloneRes = await fetch(`${baseUrl}/api/meli-sync/clone`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ origin_id, dest_id, item_ids: batch }),
              });
              if (cloneRes.ok) {
                const r = await cloneRes.json() as {
                  summary: { cloned: number; skipped_duplicate: number; errors: number };
                  results: Array<{ item_id: string; title: string; status: string; reason?: string }>;
                };
                totalCloned  += r.summary?.cloned ?? 0;
                totalSkipped += r.summary?.skipped_duplicate ?? 0;
                totalErrors  += r.summary?.errors ?? 0;
                send("log", { msg: `✓ ${r.summary?.cloned ?? 0} clonadas, ${r.summary?.skipped_duplicate ?? 0} omitidas, ${r.summary?.errors ?? 0} errores` });
                for (const er of (r.results ?? []).filter(x => x.status === "error")) {
                  const code = extractErrorCode(er.reason ?? "");
                  const { label, suggestion } = humanizeError(code);
                  allErrors.push({ item_id: er.item_id, title: er.title, reason_code: code, reason_human: label, suggestion });
                }
              } else {
                send("log", { msg: `⚠️ Error lote HTTP ${cloneRes.status}` });
                totalErrors += batch.length;
              }
            } catch (e) {
              send("log", { msg: `⚠️ Error de red: ${(e as Error).message}` });
              totalErrors += batch.length;
            }
            send("progress", { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors });
          }

          await dbUpdate(jobId, {
            status: "done",
            checkpoint: {},
            summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors },
            error_log: allErrors,
          });

          send("log", { msg: "=== CLONACIÓN MANUAL COMPLETA ===" });
          send("log", { msg: `Clonadas: ${totalCloned} | Omitidas: ${totalSkipped} | Errores: ${totalErrors}` });
          send("done", { job_id: jobId, summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors }, errors: allErrors });
          clearInterval(pingInterval); controller.close(); return;
        }

        // ---- Determine pairs (auto mode) ----
        type Pair = { origin: MeliAccount; dest: MeliAccount };
        let pairs: Pair[];

        if (origin_id && dest_id) {
          const orig = accounts.find(a => a.id === origin_id) as MeliAccount | undefined;
          const dst  = accounts.find(a => a.id === dest_id) as MeliAccount | undefined;
          if (!orig || !dst) {
            send("error", { message: "Cuentas no encontradas" });
            clearInterval(pingInterval); controller.close(); return;
          }
          pairs = [{ origin: orig, dest: dst }];
        } else {
          // Auto: detect account with most items as main origin
          send("log", { msg: "Analizando cuentas para detectar la principal..." });
          const counts = await Promise.all(accounts.map(async (acc) => {
            try {
              const token = await getValidToken(acc as MeliAccount);
              if (!token) return { acc, total: 0 };
              const d = await meliGet(`/users/${acc.meli_user_id}/items/search?status=active&limit=1`, token);
              return { acc, total: (d?.paging?.total as number) ?? 0 };
            } catch { return { acc, total: 0 }; }
          }));
          counts.sort((a, b) => b.total - a.total);
          const main = counts[0].acc as MeliAccount;
          send("log", { msg: `Cuenta principal: ${main.nickname} (${counts[0].total} publicaciones)` });
          pairs = counts.slice(1).map(c => ({ origin: main, dest: c.acc as MeliAccount }));
        }

        // ---- Checkpoint state ----
        const pairsDone = new Set<string>((checkpoint.pairs_done as string[] | undefined) ?? []);

        let totalCloned = 0, totalSkipped = 0, totalErrors = 0;
        const allErrors: Array<{
          item_id: string; title: string;
          reason_code: string; reason_human: string; suggestion: string;
        }> = [];

        // Helper: paginate all item IDs for a user
        const getAllIds = async (userId: string, token: string): Promise<string[]> => {
          const ids: string[] = [];
          for (const status of ["active", "paused"]) {
            let offset = 0;
            while (offset < 5000) {
              const d = await meliGet(`/users/${userId}/items/search?status=${status}&limit=100&offset=${offset}`, token);
              const r = (d?.results ?? []) as string[];
              if (!r.length) break;
              ids.push(...r);
              const total = (d?.paging?.total as number) ?? r.length;
              offset += 100;
              if (offset >= total) break;
            }
          }
          return ids;
        };

        // ---- Main loop ----
        for (const { origin, dest } of pairs) {
          const pairKey = `${origin.id}->${dest.id}`;

          if (pairsDone.has(pairKey)) {
            send("log", { msg: `⏭ ${origin.nickname} → ${dest.nickname}: ya sincronizada (retomando)` });
            continue;
          }

          // Check stop signal
          const statusNow = await dbCheckStatus(jobId);
          if (statusNow === "stopping") {
            await dbUpdate(jobId, {
              status: "paused",
              checkpoint: { pairs_done: Array.from(pairsDone) },
              summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors },
            });
            send("stopped", { job_id: jobId, summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors } });
            clearInterval(pingInterval); controller.close(); return;
          }

          send("log", { msg: `--- ${origin.nickname} → ${dest.nickname} ---` });

          const [originToken, destToken] = await Promise.all([getValidToken(origin), getValidToken(dest)]);
          if (!originToken || !destToken) {
            send("log", { msg: `⚠️ Token expirado para ${origin.nickname} o ${dest.nickname}. Saltando...` });
            continue;
          }

          send("log", { msg: "Obteniendo publicaciones..." });
          const [originIds, destIds] = await Promise.all([
            getAllIds(String(origin.meli_user_id), originToken),
            getAllIds(String(dest.meli_user_id), destToken),
          ]);
          send("log", { msg: `Origen: ${originIds.length} | Destino: ${destIds.length}` });

          // Build dest titles set for dedup
          const destTitlesNorm = new Set<string>();
          for (let i = 0; i < destIds.length; i += 20) {
            const chunk = destIds.slice(i, i + 20);
            const data = await meliGet(`/items?ids=${chunk.join(",")}&attributes=title`, destToken);
            const list = (data ?? []) as Array<{ code: number; body: { title: string } }>;
            for (const e of list) if (e.code === 200) destTitlesNorm.add(e.body.title.toLowerCase().trim());
          }

          // Get origin titles
          const originItems: Array<{ id: string; title: string }> = [];
          for (let i = 0; i < originIds.length; i += 20) {
            const chunk = originIds.slice(i, i + 20);
            const data = await meliGet(`/items?ids=${chunk.join(",")}&attributes=id,title`, originToken);
            const list = (data ?? []) as Array<{ code: number; body: { id: string; title: string } }>;
            for (const e of list) if (e.code === 200) originItems.push(e.body);
          }

          const toClone = originItems.filter(item => !destTitlesNorm.has(item.title.toLowerCase().trim()));
          const alreadyExists = originItems.length - toClone.length;
          send("log", { msg: `${toClone.length} para clonar, ${alreadyExists} ya existen` });

          if (!toClone.length) {
            pairsDone.add(pairKey);
            continue;
          }

          // Resume: skip items already done in this pair
          const itemsDoneInPair = new Set<string>(
            checkpoint.current_pair === pairKey ? (checkpoint.items_done as string[] | undefined) ?? [] : []
          );
          const remaining = toClone.filter(item => !itemsDoneInPair.has(item.id));

          const BATCH = 20;
          for (let batchStart = 0; batchStart < remaining.length; batchStart += BATCH) {
            // Check stop signal every batch
            const batchStatus = await dbCheckStatus(jobId);
            if (batchStatus === "stopping") {
              const itemsDone = remaining.slice(0, batchStart).map(i => i.id);
              await dbUpdate(jobId, {
                status: "paused",
                checkpoint: { pairs_done: Array.from(pairsDone), current_pair: pairKey, items_done: itemsDone },
                summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors },
              });
              send("stopped", { job_id: jobId, summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors } });
              clearInterval(pingInterval); controller.close(); return;
            }

            const batch = remaining.slice(batchStart, batchStart + BATCH).map(i => i.id);
            const batchNum = Math.floor(batchStart / BATCH) + 1;
            const totalBatches = Math.ceil(remaining.length / BATCH);
            send("log", { msg: `Clonando lote ${batchNum}/${totalBatches} (${batch.length} items)...` });

            try {
              const cloneRes = await fetch(`${baseUrl}/api/meli-sync/clone`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ origin_id: origin.id, dest_id: dest.id, item_ids: batch }),
              });

              if (cloneRes.ok) {
                const r = await cloneRes.json() as {
                  summary: { cloned: number; skipped_duplicate: number; errors: number };
                  results: Array<{ item_id: string; title: string; status: string; reason?: string }>;
                };
                totalCloned  += r.summary?.cloned ?? 0;
                totalSkipped += r.summary?.skipped_duplicate ?? 0;
                totalErrors  += r.summary?.errors ?? 0;
                send("log", { msg: `✓ ${r.summary?.cloned ?? 0} clonadas, ${r.summary?.skipped_duplicate ?? 0} omitidas, ${r.summary?.errors ?? 0} errores` });

                for (const er of (r.results ?? []).filter(x => x.status === "error")) {
                  const code = extractErrorCode(er.reason ?? "");
                  const { label, suggestion } = humanizeError(code);
                  allErrors.push({ item_id: er.item_id, title: er.title, reason_code: code, reason_human: label, suggestion });
                }
              } else {
                send("log", { msg: `⚠️ Error en lote HTTP ${cloneRes.status}` });
                totalErrors += batch.length;
              }
            } catch (e) {
              send("log", { msg: `⚠️ Error de red: ${(e as Error).message}` });
              totalErrors += batch.length;
            }

            send("progress", { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors });
          }

          pairsDone.add(pairKey);
          await dbUpdate(jobId, {
            checkpoint: { pairs_done: Array.from(pairsDone) },
            summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors },
          });
        }

        // Done!
        await dbUpdate(jobId, {
          status: "done",
          checkpoint: {},
          summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors },
          error_log: allErrors,
        });

        send("log", { msg: "=== SINCRONIZACIÓN COMPLETA ===" });
        send("log", { msg: `Clonadas: ${totalCloned} | Omitidas: ${totalSkipped} | Errores: ${totalErrors}` });
        send("done", { job_id: jobId, summary: { cloned: totalCloned, skipped: totalSkipped, errors: totalErrors }, errors: allErrors });

      } catch (e) {
        send("error", { message: (e as Error).message });
      } finally {
        clearInterval(pingInterval);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { cancelled = true; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache, no-store, no-transform",
      "Connection":      "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
