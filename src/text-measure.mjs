/** A lazy canvas and font-aware cache scoped to one view or controller. */
export function createTextMeasurer() {
  let context, ready;
  const widths = new Map();

  return {
    measure(text, font) {
      const fontSet = document.fonts;
      if (fontSet?.ready !== ready) {
        ready = fontSet?.ready;
        widths.clear();
      }
      const key = JSON.stringify([font, text]);
      if (widths.has(key)) return widths.get(key);
      context ??= document.createElement('canvas').getContext('2d');
      context.font = font;
      const width = context.measureText(text).width;
      if (fontSet?.status !== 'loading') widths.set(key, width);
      return width;
    },
    clear() { widths.clear(); }
  };
}
