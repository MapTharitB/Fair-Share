import { parse, parsePct } from './numeric-input.mjs';
export const numericInputs = (() => {
  const stripRaw = text => String(text).replace(/,/g, '').replace(/[^\d.]/g, '');
  const normDots = text => {
    const decimalIndex = text.indexOf('.');
    if (decimalIndex >= 0) text = text.slice(0, decimalIndex + 1) + text.slice(decimalIndex + 1).replace(/\./g, '');
    if (text.startsWith('.')) text = '0' + text;
    if (text === '.') text = '0.';
    return text;
  };
  const normLeading = text => {
    const decimalIndex = text.indexOf('.');
    if (decimalIndex >= 0) {
      let integerPart = text.slice(0, decimalIndex) || '0';
      integerPart = integerPart.replace(/^0+(\d)/, '$1') || '0';
      return integerPart + text.slice(decimalIndex);
    }
    return text.replace(/^0+(\d)/, '$1') || text;
  };
  const truncDec = (text, maxFractionDigits) => {
    if (maxFractionDigits < 0) return text;
    const decimalIndex = text.indexOf('.');
    if (decimalIndex >= 0) return text.slice(0, decimalIndex + 1 + maxFractionDigits);
    return text;
  };
  const limitInt = (text, maxIntegerDigits) => {
    const decimalIndex = text.indexOf('.');
    const integerPart = decimalIndex >= 0 ? text.slice(0, decimalIndex) : text;
    const fractionPart = decimalIndex >= 0 ? text.slice(decimalIndex) : '';
    return integerPart.slice(0, maxIntegerDigits) + fractionPart;
  };
  const addCommas = text => {
    if (!text) return text;
    const decimalIndex = text.indexOf('.');
    let integerPart = decimalIndex >= 0 ? text.slice(0, decimalIndex) : text;
    const fractionPart = decimalIndex >= 0 ? text.slice(decimalIndex) : '';
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return integerPart + fractionPart;
  };
  function restoreCursor(input, oldValue, newValue, oldPosition) {
    const chars = oldValue.slice(0, oldPosition).replace(/,/g, '').length;
    let position = newValue.length,
      count = 0;
    for (let i = 0; i < newValue.length; i++) {
      if (count >= chars) {
        position = i;
        break;
      }
      if (newValue[i] !== ',') count++;
    }
    try {
      input.setSelectionRange(position, position);
    } catch (_) {}
  }
  function processPlain(text, maxInt, maxFrac) {
    text = stripRaw(text);
    text = normDots(text);
    text = normLeading(text);
    if (maxInt > 0) text = limitInt(text, maxInt);
    if (maxFrac >= 0) text = truncDec(text, maxFrac);
    return text;
  }
  function addTriggers(input, action) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        action();
        input.blur();
      }
    });
    input.addEventListener('beforeinput', e => {
      if (e.inputType === 'insertLineBreak' && !e.isComposing) {
        e.preventDefault();
        action();
        input.blur();
      }
    });
  }
  function bindPercAdj(input, onCommit) {
    function doI() {
      const text = processPlain(input.value, 3, 1);
      if (input.value !== text) input.value = text;
    }
    let atFocus = input.value;
    function doC() {
      if (input.value === atFocus) return;
      const text = processPlain(input.value, 3, 1);
      let value = parse(text);
      if (value === null || !isFinite(value) || value < 0) value = 0;
      if (value > 100) value = 100;
      input.value = value === 0 ? '' : String(value).replace(/\.$/, '');
      atFocus = input.value;
      onCommit(value);
    }
    input.addEventListener('input', doI);
    input.addEventListener('blur', doC);
    input.addEventListener('focus', () => {
      atFocus = input.value;
      input.select();
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      input.value = (e.clipboardData || window.clipboardData).getData('text');
      doI();
    });
    addTriggers(input, doC);
  }
  function bindMoneyAdj(input, onCommit, {
    trimZeros = false
  } = {}) {
    let atFocus = input.value;
    function doI() {
      input.value = processPlain(input.value, 4, 2);
    }
    function doC() {
      if (input.value === atFocus) return;
      const text = processPlain(input.value, 4, 2);
      let value = parse(text);
      if (value === null || !isFinite(value) || value < 0) value = 0;
      if (value === 0) {
        input.value = '';
      } else if (trimZeros) {
        const parts = value.toFixed(2).split('.');
        const dec = parts[1].replace(/0+$/, '');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        input.value = parts[0] + (dec ? '.' + dec : '');
      } else {
        input.value = addCommas(value.toFixed(2));
      }
      atFocus = input.value;
      onCommit(value);
    }
    input.addEventListener('input', doI);
    input.addEventListener('blur', doC);
    input.addEventListener('focus', () => {
      atFocus = input.value;
      input.select();
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      input.value = (e.clipboardData || window.clipboardData).getData('text');
      doI();
    });
    addTriggers(input, doC);
  }
  function bindNumeric(input, {
    allowDecimal = true,
    maxIntDigits = 6,
    maxFracDigits = 2,
    showCommas = false
  } = {}) {
    function process() {
      const oldLength = input.value.length,
        position = input.selectionStart;
      let value = input.value.replace(/,/g, '').replace(/[^\d.]/g, '');
      if (!allowDecimal) {
        value = value.replace(/\D/g, '');
        value = value.replace(/^0+(\d)/, '$1').replace(/^0{2,}/, '0');
        value = value.slice(0, maxIntDigits);
      } else {
        const dot = value.indexOf('.');
        if (dot >= 0) {
          let integerPart = value.slice(0, dot).slice(0, maxIntDigits);
          const decimalPart = value.slice(dot + 1).replace(/\./g, '').slice(0, maxFracDigits);
          if (!integerPart) integerPart = '0';else integerPart = integerPart.replace(/^0+(\d)/, '$1').replace(/^0{2,}/, '0');
          value = integerPart + '.' + decimalPart;
        } else {
          value = value.slice(0, maxIntDigits);
          value = value.replace(/^0+(\d)/, '$1').replace(/^0{2,}/, '0');
        }
      }
      if (showCommas && value) {
        const parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const f = parts.join('.');
        input.value = f;
        const diff = f.length - oldLength;
        try {
          input.setSelectionRange(position + diff, position + diff);
        } catch (_) {}
      } else input.value = value;
    }
    input.addEventListener('input', process);
    input.addEventListener('paste', e => {
      e.preventDefault();
      let raw = (e.clipboardData || window.clipboardData).getData('text').replace(/,/g, '');
      if (!allowDecimal) raw = raw.replace(/\D/g, '');else {
        raw = raw.replace(/[^\d.]/g, '');
        const parts = raw.split('.');
        if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
      }
      input.value = raw;
      process();
    });
    input.addEventListener('keydown', e => {
      if (e.key === ',' || e.key === '،') e.preventDefault();
    });
  }
  return {
    stripRaw,
    normDots,
    normLeading,
    truncDec,
    limitInt,
    addCommas,
    restoreCursor,
    parse,
    parsePct,
    processPlain,
    addTriggers,
    bindPercAdj,
    bindMoneyAdj,
    bindNumeric
  };
})();
