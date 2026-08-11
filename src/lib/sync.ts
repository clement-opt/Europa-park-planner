import { createClient } from "@supabase/supabase-js";

/**
 * Sauvegarde partagée : les quatre téléphones lisent et écrivent la même ligne,
 * identifiée par un code de séjour. Il n'y a pas de compte, pas de connexion.
 *
 * La clé ci-dessous est une clé *publiable* : elle est faite pour vivre dans du code
 * client. Elle ne donne accès à rien d'autre qu'aux trois fonctions RPC du séjour,
 * qui ne savent ni créer ni supprimer de ligne — un code inconnu est rejeté.
 */
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://vcezvyosrxoeewtmhttq.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_jwfOB2PIwAYAzYxSxz4ldg_m6Iyz9na";

export const DEFAULT_CODE = import.meta.env.VITE_TRIP_CODE ?? "sejour-b7a1ccf1";

const db = createClient(URL, KEY, { auth: { persistSession: false } });

export type SyncState = "off" | "idle" | "push" | "pull" | "error";

export async function pullState(code: string): Promise<any | null> {
  const { data, error } = await db.rpc("ep_state_get", { p_code: code });
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function pushState(code: string, state: unknown, by: string): Promise<string | null> {
  const { data, error } = await db.rpc("ep_state_put", { p_code: code, p_state: state, p_by: by });
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Sonde légère : ne renvoie que l'horodatage, pour éviter de retélécharger l'état. */
export async function stampState(code: string): Promise<string | null> {
  const { data, error } = await db.rpc("ep_state_stamp", { p_code: code });
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Nom d'appareil, pour savoir qui a modifié en dernier. */
export function deviceName(): string {
  const k = "ep.device";
  let v = localStorage.getItem(k);
  if (!v) {
    const ua = navigator.userAgent;
    const guess = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : "Navigateur";
    v = `${guess}-${Math.random().toString(36).slice(2, 5)}`;
    try { localStorage.setItem(k, v); } catch { /* quota */ }
  }
  return v;
}

/** Réseau piéton figé côté serveur, servi en une requête (~158 ko). */
export async function fetchFootWays(): Promise<[number, number][][] | null> {
  const { data, error } = await db.rpc("ep_foot_graph");
  if (error) throw new Error(error.message);
  return (data as [number, number][][]) ?? null;
}
