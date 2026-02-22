import { QRCodeSVG } from 'qrcode.react';

interface TagQRCodeProps {
  tagNumber: string;
}

export function TagQRCode({ tagNumber }: TagQRCodeProps): JSX.Element {
  const payload = `loopvault:tag:${tagNumber}`;

  const onPrintLabel = (): void => {
    const sourceSvg = document.getElementById('tag-qr-svg');
    if (!sourceSvg) {
      return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Print Tag Label</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; display: grid; place-items: center; }
            .label { border: 2px solid #111; padding: 24px; text-align: center; }
            .tag { margin-top: 12px; font-size: 32px; font-weight: 800; letter-spacing: 0.04em; }
          </style>
        </head>
        <body>
          <div class="label">
            ${sourceSvg.outerHTML}
            <div class="tag">${tagNumber}</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="mb-3 text-lg font-semibold">Tag QR Code</h3>
      <div className="flex justify-center rounded-lg bg-white p-3">
        <QRCodeSVG bgColor="#ffffff" fgColor="#000000" id="tag-qr-svg" size={180} value={payload} />
      </div>
      <p className="mt-2 break-all text-xs text-slate-300">{payload}</p>
      <button className="mt-3 min-h-[44px] w-full rounded-lg bg-safety px-4 py-3 font-bold text-black" onClick={onPrintLabel} type="button">
        Print Label
      </button>
    </div>
  );
}
