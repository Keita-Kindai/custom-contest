declare const __SERVER_ORIGIN__: string;

type GMRequestDetails = {
  method: "POST";
  url: string;
  headers: Record<string, string>;
  data: string;
  timeout: number;
  onload(response: { status: number; responseText: string }): void;
  onerror(): void;
  ontimeout(): void;
};

declare function GM_xmlhttpRequest(details: GMRequestDetails): void;
declare function GM_getValue<T>(key: string, fallback: T): T;
declare function GM_setValue<T>(key: string, value: T): void;
declare function GM_deleteValue(key: string): void;
