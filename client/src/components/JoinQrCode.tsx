import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function JoinQrCode({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}${window.location.pathname}#/room/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#181022', light: '#ffd166' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [code]);

  if (!dataUrl) return null;
  return <img src={dataUrl} alt="QR code pour rejoindre la partie" style={{ borderRadius: 16, width: 200, height: 200 }} />;
}
