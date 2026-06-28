export const dangerousMarkdownLinks = [
  "[x](javascript:alert(1))",
  "[x](JaVaScRiPt:alert(1))",
  "[x](file:///etc/passwd)",
  "[x](//evil.example/path)",
  "[x](data:text/html,<script>alert(1)</script>)"
];

export const dangerousHtmlFragments = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<base href="https://evil.example/">',
  '<form action="https://evil.example"><input></form>',
  '<span style="background:url(javascript:alert(1))">x</span>',
  '<span style="@import url(https://evil.example/x.css)">x</span>',
  '<span style="background:url(file:///etc/passwd)">x</span>'
];

export const dangerousSvgFragments = [
  "<script>alert(1)</script>",
  "<foreignObject><script>alert(1)</script></foreignObject>",
  '<a href="javascript:alert(1)">x</a>',
  '<use href="https://evil.example/icon.svg#x"></use>',
  '<image href="file:///secret.png"></image>',
  '<a xlink:href="java&#x73;cript:alert(1)">x</a>'
];

export const forbiddenSanitizedOutputPatterns = [
  /<script/i,
  /\son[a-z]+\s*=/i,
  /javascript:/i,
  /file:/i,
  /<iframe/i,
  /<webview/i,
  /<foreignObject/i,
  /https:\/\/evil\.example/i
];
