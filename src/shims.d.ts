declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: unknown;
  }
  interface Element {}
}

declare module 'react' {
  export interface StrictModeProps {
    children?: unknown;
  }
  export const StrictMode: (props: StrictModeProps) => JSX.Element;
  const ReactDefault: {
    StrictMode: typeof StrictMode;
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
  export function Link(props: { to: string; className?: string; children?: unknown }): JSX.Element;
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
  export default class SignatureCanvas {
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
    version(versionNumber: number): { stores(schema: Record<string, string>): void };
    transaction(mode: string, ...args: unknown[]): Promise<void>;
  }
}
