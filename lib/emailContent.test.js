import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeEmailHtml, substituteVariables } from './emailContent';

describe('email content helpers', () => {
  it('removes executable markup and unsafe links', () => {
    expect(sanitizeEmailHtml('<p>Hello</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'))
      .toBe('<p>Hello</p><a href="#">x</a>');
  });

  it('converts basic rich text to plain text', () => {
    expect(htmlToText('<p>Hello<br>world</p><ul><li>One</li></ul>')).toBe('Hello\nworld\n- One');
  });

  it('substitutes known variables and preserves unknown ones', () => {
    expect(substituteVariables('Hi {{customer_name}} {{missing}}', { customer_name: 'Ada' })).toBe('Hi Ada {{missing}}');
  });
});