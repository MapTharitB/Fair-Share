const colorRoles = {
  background: '--color-background',
  surface: '--color-surface',
  card: '--color-card',
  emphasis: '--color-orange-on-light',
  text: '--color-text',
  muted: '--color-text-muted',
  subdued: '--color-text-subdued',
  border: '--color-border',
  success: '--color-success',
  danger: '--color-danger',
  accentWash: '--color-accent-export-wash',
  sectionLabel: '--section-label-color'
};

export function readUiTheme(root = document.documentElement) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const style = window.getComputedStyle(root);
  function required(token) {
    const value = style.getPropertyValue(token).trim();
    if (!value) throw Error('ไม่พบค่าธีม ' + token);
    return value;
  }
  const colors = {};
  const fonts = Object.fromEntries(['body', 'mono', 'heading', 'brand'].map(role =>
    [role, required('--font-' + role)]
  ));
  const probe = document.createElement('span');
  probe.hidden = true;
  root.append(probe);
  try {
    for (const [role, token] of Object.entries(colorRoles)) {
      const value = required(token);
      if (!window.CSS.supports('color', value)) throw Error('ค่าสีธีมไม่ถูกต้อง ' + token);
      probe.style.color = value;
      colors[role] = window.getComputedStyle(probe).color;
    }
  } finally {
    probe.remove();
  }
  return {colors, fonts};
}
