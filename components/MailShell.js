import { useEffect, useState } from 'react';
import MailIcon from './MailIcon';

export default function MailShell({ children, rail, list, reading, collapsed, drawerOpen, threadOpen, onMenu, onCompose }) {
  const [listWidth, setListWidth] = useState(380);
  useEffect(() => { try { const saved = Number(localStorage.getItem('mail_list_width')); if (saved >= 320 && saved <= 560) setListWidth(saved); } catch (error) {} }, []);
  const resizeList = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = listWidth;
    let finalWidth = startWidth;
    const move = (moveEvent) => { finalWidth = Math.max(320, Math.min(560, startWidth + moveEvent.clientX - startX)); setListWidth(finalWidth); };
    const stop = () => { try { localStorage.setItem('mail_list_width', String(finalWidth)); } catch (error) {} window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  };
  return <main className="mail-app" style={{ '--mail-list-width': `${listWidth}px` }} data-rail-collapsed={collapsed} data-drawer-open={drawerOpen} data-thread-open={threadOpen}><button className="mail-mobile-menu mail-icon-button" type="button" onClick={onMenu} aria-label="Open folders"><MailIcon name="menu" /></button>{rail}<div className="mail-list-wrap">{list}<button className="mail-list-divider" type="button" onPointerDown={resizeList} aria-label="Resize message list" title="Resize message list" /></div>{reading}{onCompose && <button className="mail-compose-fab" type="button" onClick={onCompose} aria-label="Compose new email"><MailIcon name="send" size={22} /></button>}</main>;
}
