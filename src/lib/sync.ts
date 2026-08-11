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

/** Dernier relevé collecté côté serveur, au format attendu par l'app. */
export async function fetchWaitsFromServer(): Promise<
  { at: number; source: "live"; rides: Record<number, { wait: number; open: boolean }>; vl: Record<number, boolean> } | null
> {
  const { data, error } = await db.rpc("ep_waits");
  if (error) throw new Error(error.message);
  if (!data?.at) return null;
  return {
    at: new Date(data.at).getTime(),
    source: "live",
    rides: data.rides ?? {},
    vl: data.vl ?? {}
  };
}

export type Horaire = {
  jour: string;
  premier_ouvert: string;
  dernier_ouvert: string;
  couvert_depuis: string;
  couvert_jusqua: string;
  fermeture_observee: boolean;
  releves_ouverts: number;
};

/** Amplitude réellement observée par la collecte, jour par jour. */
export async function fetchHoraires(): Promise<Horaire[]> {
  const { data, error } = await db.rpc("ep_horaires");
  if (error) throw new Error(error.message);
  return (data as Horaire[]) ?? [];
}

export type Courbe = {
  global: Record<string, number>;
  rides: Record<string, Record<string, number>>;
  releves: number;
  heures: number;
};

/**
 * Profil d'affluence observé. Le serveur renvoie des objets vides tant que la
 * collecte est trop jeune : c'est voulu, une prédiction bâtie sur trois relevés
 * serait pire que l'heuristique qu'elle remplace.
 */
export async function fetchCourbe(): Promise<Courbe | null> {
  const { data, error } = await db.rpc("ep_courbe");
  if (error) throw new Error(error.message);
  return (data as Courbe) ?? null;
}
