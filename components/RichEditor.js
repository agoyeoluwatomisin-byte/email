import { useEffect, useRef } from 'react';

export default function RichEditor({ value, onChange, placeholder, minHeight = 140 }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value || '';
  }, [value]);

  const emit = () => {
    const html = editorRef.current?.innerHTML || '';
    const text = editorRef.current?.innerText || '';
    onChange({ html, text });
  };

  const command = (name, argument) => {
    editorRef.current?.focus();
    document.execCommand(name, false, argument);
    emit();
  };

  return (
    <div className="mail-editor">
      <div className="mail-editor-toolbar">
        <button type="button" className="mail-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('bold')} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className="mail-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('italic')} aria-label="Italic"><em>I</em></button>
        <button type="button" className="mail-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('insertUnorderedList')} aria-label="Bulleted list">•</button>
        <button type="button" className="mail-button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('createLink', window.prompt('Link URL', 'https://'))} aria-label="Insert link">Link</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className="mail-editor-content"
        style={{ minHeight }}
        suppressContentEditableWarning
      />
    </div>
  );
}

