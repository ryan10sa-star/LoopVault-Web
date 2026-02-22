declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: unknown;
  }
  interface Element {}
}

declare module 'react' {
  export type ReactNode = any;
  export interface ErrorInfo {
    componentStack: string;
  }
  export class Component<P = unknown, S = unknown> {
    constructor(props: P);
    props: P;
    state: S;
    context: unknown;
    refs: any;
    setState(state: Partial<S>): void;
    forceUpdate(): void;
  }
  export interface StrictModeProps {
    children?: unknown;
  }
  export interface SuspenseProps {
    children?: unknown;
    fallback?: unknown;
  }
  export const StrictMode: (props: StrictModeProps) => JSX.Element;
  export const Suspense: (props: SuspenseProps) => JSX.Element;
  export function lazy<T>(factory: () => Promise<{ default: T }>): T;
  const ReactDefault: {
    StrictMode: typeof StrictMode;
    Suspense: typeof Suspense;
  };
  export default ReactDefault;
  export function useEffect(effect: () => (() => void) | void, deps: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void];
}

declare module 'react-dom/client' {
  interface Root {
    render(node: unknown): void;
  }
  export function createRoot(container: Element): Root;
}

declare module 'react-router-dom' {
  export function BrowserRouter(props: { children?: unknown }): JSX.Element;
  export function Routes(props: { children?: unknown }): JSX.Element;
  export function Route(props: { path: string; element: JSX.Element }): JSX.Element;
  export function Link(props: { to: string; className?: string; children?: unknown; onClick?: () => void }): JSX.Element;
  export function useNavigate(): (to: string) => void;
  export function useParams(): Record<string, string | undefined>;
  export function useSearchParams(): [URLSearchParams, (next: Record<string, string>) => void];
}

declare module 'dexie-react-hooks' {
  export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[], defaultResult: T): T;
}

declare module 'qrcode.react' {
  export function QRCodeSVG(props: {
    id?: string;
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
  }): JSX.Element;
}

declare module 'react-signature-canvas' {
  import type { Component, ReactNode } from 'react';

  export interface SignatureCanvasProps {
    canvasProps?: {
      className?: string;
    };
    penColor?: string;
    ref?: unknown;
  }

  export default class SignatureCanvas extends Component<SignatureCanvasProps, any> {
    render(): ReactNode;
    clear(): void;
    isEmpty(): boolean;
    getTrimmedCanvas(): HTMLCanvasElement;
  }
}

declare module 'jspdf' {
  interface JsPdfOptions {
    unit?: string;
    format?: string;
  }

  export default class jsPDF {
    constructor(options?: JsPdfOptions);
    setFontSize(size: number): void;
    text(text: string, x: number, y: number, options?: { maxWidth?: number }): void;
    addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): void;
    addPage(): void;
    save(filename: string): void;
  }
}

declare module 'jspdf-autotable' {
  import type jsPDF from 'jspdf';

  interface AutoTableOptions {
    startY?: number;
    head: string[][];
    body: string[][];
    theme?: string;
    headStyles?: { fillColor?: number[] };
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}


declare module 'jszip' {
  export interface JSZipFile {
    async(type: 'string'): Promise<string>;
    async(type: 'blob'): Promise<Blob>;
  }

  export default class JSZip {
    static loadAsync(data: ArrayBuffer): Promise<JSZip>;
    folder(name: string): JSZip | null;
    file(path: string): JSZipFile | null;
    file(path: string, data: string | Blob): JSZip;
    generateAsync(options: { type: 'blob' }): Promise<Blob>;
  }
}

declare module 'file-saver' {
  export function saveAs(data: Blob, filename: string): void;
}

declare module '@zxing/library' {
  export interface Result {
    getText(): string;
  }

  export class BrowserMultiFormatReader {
    decodeFromVideoDevice(
      deviceId: string | undefined,
      video: HTMLVideoElement | null,
      callback: (result: Result | undefined, error: Error | undefined) => void
    ): Promise<void>;
    reset(): void;
  }
}

declare module 'lucide-react' {
  export function Database(props: { size?: number }): JSX.Element;
  export function QrCode(props: { size?: number }): JSX.Element;
  export function Tags(props: { size?: number }): JSX.Element;
}

declare module 'dexie' {
  export interface Transaction {
    table(name: string): {
      toCollection(): {
        modify(mutator: (record: Record<string, unknown>) => void): Promise<void>;
      };
    };
  }

  export interface Version {
    stores(schema: Record<string, string>): Version;
    upgrade(callback: (tx: Transaction) => Promise<void> | void): Version;
  }

  export interface Collection<TRecord> {
    toArray(): Promise<TRecord[]>;
  }

  export interface WhereClause<TRecord> {
    equals(value: unknown): Collection<TRecord>;
  }

  export interface Table<TRecord, TKey> {
    bulkPut(items: TRecord[]): Promise<void>;
    get(key: TKey): Promise<TRecord | undefined>;
    where(index: string): WhereClause<TRecord>;
    add(item: TRecord): Promise<TKey>;
    put(item: TRecord): Promise<TKey>;
    bulkAdd(items: TRecord[]): Promise<void>;
    clear(): Promise<void>;
    count(): Promise<number>;
    toArray(): Promise<TRecord[]>;
  }

  export default class Dexie {
    constructor(name: string);
    version(versionNumber: number): Version;
    transaction(mode: string, ...args: unknown[]): Promise<void>;
  }
}
