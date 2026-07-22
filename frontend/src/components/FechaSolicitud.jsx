import { formatDateTime } from '../utils/dateUtils';

// Fecha de solicitud en dos líneas (fecha arriba, hora abajo). El color lo define la celda contenedora.
export default function FechaSolicitud({ ts }) {
    const s = formatDateTime(ts);
    const idx = s.indexOf(', ');
    const date = idx === -1 ? s : s.slice(0, idx);
    const time = idx === -1 ? '' : s.slice(idx + 2);
    return (
        <>
            <div className="font-medium">{date}</div>
            <div className="text-sky-400">{time}</div>
        </>
    );
}
