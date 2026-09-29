import { QRCodeSVG } from 'qrcode.react';
import { TEXT } from '../../config/content';
import s from './QRFinal.module.css';

/** QR de 400×400 sobre placa blanca con instrucción de 36 px. */
export function QRFinal({ url }: { url: string }) {
  return (
    <div className={s.root}>
      <div className={s.plate}>
        <QRCodeSVG value={url} size={400} level="M" />
      </div>
      <div className={s.text}>{TEXT.result.qr}</div>
    </div>
  );
}
