(() => {
  const script = document.currentScript;
  const endpoint = script?.dataset.endpoint || new URL('/api/contact-widget', script?.src || window.location.href).href;
  const title = script?.dataset.title || 'Contact us';
  const accent = script?.dataset.accent || '#2563eb';

  const style = document.createElement('style');
  style.textContent = `
    .agosoft-contact-root { position: fixed; right: 24px; bottom: 24px; z-index: 99999; font-family: Inter, Arial, sans-serif; }
    .agosoft-contact-button { border: 0; border-radius: 999px; padding: 14px 18px; background: ${accent}; color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 10px 30px rgba(15,23,42,.25); }
    .agosoft-contact-panel { display: none; width: min(360px, calc(100vw - 32px)); margin-bottom: 10px; padding: 18px; border: 1px solid #dbeafe; border-radius: 14px; background: #fff; color: #0f172a; box-shadow: 0 20px 50px rgba(15,23,42,.22); }
    .agosoft-contact-panel.is-open { display: block; }
    .agosoft-contact-panel h2 { margin: 0 0 14px; font-size: 20px; }
    .agosoft-contact-panel label { display: block; margin-top: 10px; font-size: 12px; font-weight: 700; }
    .agosoft-contact-panel input, .agosoft-contact-panel textarea { width: 100%; box-sizing: border-box; margin-top: 5px; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; }
    .agosoft-contact-panel textarea { min-height: 90px; resize: vertical; }
    .agosoft-contact-submit { width: 100%; margin-top: 14px; padding: 10px; border: 0; border-radius: 7px; background: ${accent}; color: #fff; font-weight: 700; cursor: pointer; }
    .agosoft-contact-status { margin: 10px 0 0; font-size: 12px; }
    .agosoft-contact-honeypot { position: absolute; left: -10000px; opacity: 0; }
    @media (max-width: 600px) { .agosoft-contact-root { right: 16px; bottom: 16px; } }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'agosoft-contact-root';
  root.innerHTML = `
    <div class="agosoft-contact-panel" aria-hidden="true">
      <h2>${escapeHtml(title)}</h2>
      <form>
        <label>Name<input name="name" required maxlength="120" autocomplete="name"></label>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Subject<input name="subject" maxlength="180"></label>
        <label>Message<textarea name="message" required maxlength="5000"></textarea></label>
        <input class="agosoft-contact-honeypot" name="website" tabindex="-1" autocomplete="off">
        <button class="agosoft-contact-submit" type="submit">Send message</button>
        <p class="agosoft-contact-status" role="status"></p>
      </form>
    </div>
    <button class="agosoft-contact-button" type="button">${escapeHtml(title)}</button>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector('.agosoft-contact-panel');
  const toggle = root.querySelector('.agosoft-contact-button');
  const form = root.querySelector('form');
  const submit = root.querySelector('.agosoft-contact-submit');
  const status = root.querySelector('.agosoft-contact-status');

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    panel.setAttribute('aria-hidden', String(!open));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Sending...';
    submit.disabled = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send message.');
      form.reset();
      status.textContent = 'Thanks, your message was sent.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }
})();
