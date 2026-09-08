var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/gifenc/dist/gifenc.js
var require_gifenc = __commonJS({
  "node_modules/gifenc/dist/gifenc.js"(exports) {
    var __defProp2 = Object.defineProperty;
    var __markAsModule = (target) => __defProp2(target, "__esModule", { value: true });
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    __markAsModule(exports);
    __export(exports, {
      GIFEncoder: () => GIFEncoder2,
      applyPalette: () => applyPalette2,
      default: () => src_default,
      nearestColor: () => nearestColor,
      nearestColorIndex: () => nearestColorIndex,
      nearestColorIndexWithDistance: () => nearestColorIndexWithDistance,
      prequantize: () => prequantize,
      quantize: () => quantize2,
      snapColorsToPalette: () => snapColorsToPalette
    });
    var constants_default = {
      signature: "GIF",
      version: "89a",
      trailer: 59,
      extensionIntroducer: 33,
      applicationExtensionLabel: 255,
      graphicControlExtensionLabel: 249,
      imageSeparator: 44,
      signatureSize: 3,
      versionSize: 3,
      globalColorTableFlagMask: 128,
      colorResolutionMask: 112,
      sortFlagMask: 8,
      globalColorTableSizeMask: 7,
      applicationIdentifierSize: 8,
      applicationAuthCodeSize: 3,
      disposalMethodMask: 28,
      userInputFlagMask: 2,
      transparentColorFlagMask: 1,
      localColorTableFlagMask: 128,
      interlaceFlagMask: 64,
      idSortFlagMask: 32,
      localColorTableSizeMask: 7
    };
    function createStream(initialCapacity = 256) {
      let cursor = 0;
      let contents = new Uint8Array(initialCapacity);
      return {
        get buffer() {
          return contents.buffer;
        },
        reset() {
          cursor = 0;
        },
        bytesView() {
          return contents.subarray(0, cursor);
        },
        bytes() {
          return contents.slice(0, cursor);
        },
        writeByte(byte) {
          expand(cursor + 1);
          contents[cursor] = byte;
          cursor++;
        },
        writeBytes(data, offset = 0, byteLength = data.length) {
          expand(cursor + byteLength);
          for (let i = 0; i < byteLength; i++) {
            contents[cursor++] = data[i + offset];
          }
        },
        writeBytesView(data, offset = 0, byteLength = data.byteLength) {
          expand(cursor + byteLength);
          contents.set(data.subarray(offset, offset + byteLength), cursor);
          cursor += byteLength;
        }
      };
      function expand(newCapacity) {
        var prevCapacity = contents.length;
        if (prevCapacity >= newCapacity)
          return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
        if (prevCapacity != 0)
          newCapacity = Math.max(newCapacity, 256);
        const oldContents = contents;
        contents = new Uint8Array(newCapacity);
        if (cursor > 0)
          contents.set(oldContents.subarray(0, cursor), 0);
      }
    }
    var BITS = 12;
    var DEFAULT_HSIZE = 5003;
    var MASKS = [
      0,
      1,
      3,
      7,
      15,
      31,
      63,
      127,
      255,
      511,
      1023,
      2047,
      4095,
      8191,
      16383,
      32767,
      65535
    ];
    function lzwEncode(width, height, pixels, colorDepth, outStream = createStream(512), accum = new Uint8Array(256), htab = new Int32Array(DEFAULT_HSIZE), codetab = new Int32Array(DEFAULT_HSIZE)) {
      const hsize = htab.length;
      const initCodeSize = Math.max(2, colorDepth);
      accum.fill(0);
      codetab.fill(0);
      htab.fill(-1);
      let cur_accum = 0;
      let cur_bits = 0;
      const init_bits = initCodeSize + 1;
      const g_init_bits = init_bits;
      let clear_flg = false;
      let n_bits = g_init_bits;
      let maxcode = (1 << n_bits) - 1;
      const ClearCode = 1 << init_bits - 1;
      const EOFCode = ClearCode + 1;
      let free_ent = ClearCode + 2;
      let a_count = 0;
      let ent = pixels[0];
      let hshift = 0;
      for (let fcode = hsize; fcode < 65536; fcode *= 2) {
        ++hshift;
      }
      hshift = 8 - hshift;
      outStream.writeByte(initCodeSize);
      output(ClearCode);
      const length = pixels.length;
      for (let idx = 1; idx < length; idx++) {
        next_block: {
          const c = pixels[idx];
          const fcode = (c << BITS) + ent;
          let i = c << hshift ^ ent;
          if (htab[i] === fcode) {
            ent = codetab[i];
            break next_block;
          }
          const disp = i === 0 ? 1 : hsize - i;
          while (htab[i] >= 0) {
            i -= disp;
            if (i < 0)
              i += hsize;
            if (htab[i] === fcode) {
              ent = codetab[i];
              break next_block;
            }
          }
          output(ent);
          ent = c;
          if (free_ent < 1 << BITS) {
            codetab[i] = free_ent++;
            htab[i] = fcode;
          } else {
            htab.fill(-1);
            free_ent = ClearCode + 2;
            clear_flg = true;
            output(ClearCode);
          }
        }
      }
      output(ent);
      output(EOFCode);
      outStream.writeByte(0);
      return outStream.bytesView();
      function output(code) {
        cur_accum &= MASKS[cur_bits];
        if (cur_bits > 0)
          cur_accum |= code << cur_bits;
        else
          cur_accum = code;
        cur_bits += n_bits;
        while (cur_bits >= 8) {
          accum[a_count++] = cur_accum & 255;
          if (a_count >= 254) {
            outStream.writeByte(a_count);
            outStream.writeBytesView(accum, 0, a_count);
            a_count = 0;
          }
          cur_accum >>= 8;
          cur_bits -= 8;
        }
        if (free_ent > maxcode || clear_flg) {
          if (clear_flg) {
            n_bits = g_init_bits;
            maxcode = (1 << n_bits) - 1;
            clear_flg = false;
          } else {
            ++n_bits;
            maxcode = n_bits === BITS ? 1 << n_bits : (1 << n_bits) - 1;
          }
        }
        if (code == EOFCode) {
          while (cur_bits > 0) {
            accum[a_count++] = cur_accum & 255;
            if (a_count >= 254) {
              outStream.writeByte(a_count);
              outStream.writeBytesView(accum, 0, a_count);
              a_count = 0;
            }
            cur_accum >>= 8;
            cur_bits -= 8;
          }
          if (a_count > 0) {
            outStream.writeByte(a_count);
            outStream.writeBytesView(accum, 0, a_count);
            a_count = 0;
          }
        }
      }
    }
    var lzwEncode_default = lzwEncode;
    function rgb888_to_rgb565(r, g, b) {
      return r << 8 & 63488 | g << 2 & 992 | b >> 3;
    }
    function rgba8888_to_rgba4444(r, g, b, a) {
      return r >> 4 | g & 240 | (b & 240) << 4 | (a & 240) << 8;
    }
    function rgb888_to_rgb444(r, g, b) {
      return r >> 4 << 8 | g & 240 | b >> 4;
    }
    function clamp(value, min2, max2) {
      return value < min2 ? min2 : value > max2 ? max2 : value;
    }
    function sqr(value) {
      return value * value;
    }
    function find_nn(bins, idx, hasAlpha) {
      var nn = 0;
      var err = 1e100;
      const bin1 = bins[idx];
      const n1 = bin1.cnt;
      const wa = bin1.ac;
      const wr = bin1.rc;
      const wg = bin1.gc;
      const wb = bin1.bc;
      for (var i = bin1.fw; i != 0; i = bins[i].fw) {
        const bin = bins[i];
        const n2 = bin.cnt;
        const nerr2 = n1 * n2 / (n1 + n2);
        if (nerr2 >= err)
          continue;
        var nerr = 0;
        if (hasAlpha) {
          nerr += nerr2 * sqr(bin.ac - wa);
          if (nerr >= err)
            continue;
        }
        nerr += nerr2 * sqr(bin.rc - wr);
        if (nerr >= err)
          continue;
        nerr += nerr2 * sqr(bin.gc - wg);
        if (nerr >= err)
          continue;
        nerr += nerr2 * sqr(bin.bc - wb);
        if (nerr >= err)
          continue;
        err = nerr;
        nn = i;
      }
      bin1.err = err;
      bin1.nn = nn;
    }
    function create_bin() {
      return {
        ac: 0,
        rc: 0,
        gc: 0,
        bc: 0,
        cnt: 0,
        nn: 0,
        fw: 0,
        bk: 0,
        tm: 0,
        mtm: 0,
        err: 0
      };
    }
    function create_bin_list(data, format2) {
      const bincount = format2 === "rgb444" ? 4096 : 65536;
      const bins = new Array(bincount);
      const size = data.length;
      if (format2 === "rgba4444") {
        for (let i = 0; i < size; ++i) {
          const color2 = data[i];
          const a = color2 >> 24 & 255;
          const b = color2 >> 16 & 255;
          const g = color2 >> 8 & 255;
          const r = color2 & 255;
          const index = rgba8888_to_rgba4444(r, g, b, a);
          let bin = index in bins ? bins[index] : bins[index] = create_bin();
          bin.rc += r;
          bin.gc += g;
          bin.bc += b;
          bin.ac += a;
          bin.cnt++;
        }
      } else if (format2 === "rgb444") {
        for (let i = 0; i < size; ++i) {
          const color2 = data[i];
          const b = color2 >> 16 & 255;
          const g = color2 >> 8 & 255;
          const r = color2 & 255;
          const index = rgb888_to_rgb444(r, g, b);
          let bin = index in bins ? bins[index] : bins[index] = create_bin();
          bin.rc += r;
          bin.gc += g;
          bin.bc += b;
          bin.cnt++;
        }
      } else {
        for (let i = 0; i < size; ++i) {
          const color2 = data[i];
          const b = color2 >> 16 & 255;
          const g = color2 >> 8 & 255;
          const r = color2 & 255;
          const index = rgb888_to_rgb565(r, g, b);
          let bin = index in bins ? bins[index] : bins[index] = create_bin();
          bin.rc += r;
          bin.gc += g;
          bin.bc += b;
          bin.cnt++;
        }
      }
      return bins;
    }
    function quantize2(rgba2, maxColors, opts = {}) {
      const {
        format: format2 = "rgb565",
        clearAlpha = true,
        clearAlphaColor = 0,
        clearAlphaThreshold = 0,
        oneBitAlpha = false
      } = opts;
      if (!rgba2 || !rgba2.buffer) {
        throw new Error("quantize() expected RGBA Uint8Array data");
      }
      if (!(rgba2 instanceof Uint8Array) && !(rgba2 instanceof Uint8ClampedArray)) {
        throw new Error("quantize() expected RGBA Uint8Array data");
      }
      const data = new Uint32Array(rgba2.buffer);
      let useSqrt = opts.useSqrt !== false;
      const hasAlpha = format2 === "rgba4444";
      const bins = create_bin_list(data, format2);
      const bincount = bins.length;
      const bincountMinusOne = bincount - 1;
      const heap2 = new Uint32Array(bincount + 1);
      var maxbins = 0;
      for (var i = 0; i < bincount; ++i) {
        const bin = bins[i];
        if (bin != null) {
          var d = 1 / bin.cnt;
          if (hasAlpha)
            bin.ac *= d;
          bin.rc *= d;
          bin.gc *= d;
          bin.bc *= d;
          bins[maxbins++] = bin;
        }
      }
      if (sqr(maxColors) / maxbins < 0.022) {
        useSqrt = false;
      }
      var i = 0;
      for (; i < maxbins - 1; ++i) {
        bins[i].fw = i + 1;
        bins[i + 1].bk = i;
        if (useSqrt)
          bins[i].cnt = Math.sqrt(bins[i].cnt);
      }
      if (useSqrt)
        bins[i].cnt = Math.sqrt(bins[i].cnt);
      var h, l, l2;
      for (i = 0; i < maxbins; ++i) {
        find_nn(bins, i, false);
        var err = bins[i].err;
        for (l = ++heap2[0]; l > 1; l = l2) {
          l2 = l >> 1;
          if (bins[h = heap2[l2]].err <= err)
            break;
          heap2[l] = h;
        }
        heap2[l] = i;
      }
      var extbins = maxbins - maxColors;
      for (i = 0; i < extbins; ) {
        var tb;
        for (; ; ) {
          var b1 = heap2[1];
          tb = bins[b1];
          if (tb.tm >= tb.mtm && bins[tb.nn].mtm <= tb.tm)
            break;
          if (tb.mtm == bincountMinusOne)
            b1 = heap2[1] = heap2[heap2[0]--];
          else {
            find_nn(bins, b1, false);
            tb.tm = i;
          }
          var err = bins[b1].err;
          for (l = 1; (l2 = l + l) <= heap2[0]; l = l2) {
            if (l2 < heap2[0] && bins[heap2[l2]].err > bins[heap2[l2 + 1]].err)
              l2++;
            if (err <= bins[h = heap2[l2]].err)
              break;
            heap2[l] = h;
          }
          heap2[l] = b1;
        }
        var nb = bins[tb.nn];
        var n1 = tb.cnt;
        var n2 = nb.cnt;
        var d = 1 / (n1 + n2);
        if (hasAlpha)
          tb.ac = d * (n1 * tb.ac + n2 * nb.ac);
        tb.rc = d * (n1 * tb.rc + n2 * nb.rc);
        tb.gc = d * (n1 * tb.gc + n2 * nb.gc);
        tb.bc = d * (n1 * tb.bc + n2 * nb.bc);
        tb.cnt += nb.cnt;
        tb.mtm = ++i;
        bins[nb.bk].fw = nb.fw;
        bins[nb.fw].bk = nb.bk;
        nb.mtm = bincountMinusOne;
      }
      let palette = [];
      var k = 0;
      for (i = 0; ; ++k) {
        let r = clamp(Math.round(bins[i].rc), 0, 255);
        let g = clamp(Math.round(bins[i].gc), 0, 255);
        let b = clamp(Math.round(bins[i].bc), 0, 255);
        let a = 255;
        if (hasAlpha) {
          a = clamp(Math.round(bins[i].ac), 0, 255);
          if (oneBitAlpha) {
            const threshold = typeof oneBitAlpha === "number" ? oneBitAlpha : 127;
            a = a <= threshold ? 0 : 255;
          }
          if (clearAlpha && a <= clearAlphaThreshold) {
            r = g = b = clearAlphaColor;
            a = 0;
          }
        }
        const color2 = hasAlpha ? [r, g, b, a] : [r, g, b];
        const exists = existsInPalette(palette, color2);
        if (!exists)
          palette.push(color2);
        if ((i = bins[i].fw) == 0)
          break;
      }
      return palette;
    }
    function existsInPalette(palette, color2) {
      for (let i = 0; i < palette.length; i++) {
        const p = palette[i];
        let matchesRGB = p[0] === color2[0] && p[1] === color2[1] && p[2] === color2[2];
        let matchesAlpha = p.length >= 4 && color2.length >= 4 ? p[3] === color2[3] : true;
        if (matchesRGB && matchesAlpha)
          return true;
      }
      return false;
    }
    function euclideanDistanceSquared(a, b) {
      var sum = 0;
      var n;
      for (n = 0; n < a.length; n++) {
        const dx = a[n] - b[n];
        sum += dx * dx;
      }
      return sum;
    }
    function roundStep(byte, step) {
      return step > 1 ? Math.round(byte / step) * step : byte;
    }
    function prequantize(rgba2, { roundRGB = 5, roundAlpha = 10, oneBitAlpha = null } = {}) {
      const data = new Uint32Array(rgba2.buffer);
      for (let i = 0; i < data.length; i++) {
        const color2 = data[i];
        let a = color2 >> 24 & 255;
        let b = color2 >> 16 & 255;
        let g = color2 >> 8 & 255;
        let r = color2 & 255;
        a = roundStep(a, roundAlpha);
        if (oneBitAlpha) {
          const threshold = typeof oneBitAlpha === "number" ? oneBitAlpha : 127;
          a = a <= threshold ? 0 : 255;
        }
        r = roundStep(r, roundRGB);
        g = roundStep(g, roundRGB);
        b = roundStep(b, roundRGB);
        data[i] = a << 24 | b << 16 | g << 8 | r << 0;
      }
    }
    function applyPalette2(rgba2, palette, format2 = "rgb565") {
      if (!rgba2 || !rgba2.buffer) {
        throw new Error("quantize() expected RGBA Uint8Array data");
      }
      if (!(rgba2 instanceof Uint8Array) && !(rgba2 instanceof Uint8ClampedArray)) {
        throw new Error("quantize() expected RGBA Uint8Array data");
      }
      if (palette.length > 256) {
        throw new Error("applyPalette() only works with 256 colors or less");
      }
      const data = new Uint32Array(rgba2.buffer);
      const length = data.length;
      const bincount = format2 === "rgb444" ? 4096 : 65536;
      const index = new Uint8Array(length);
      const cache = new Array(bincount);
      const hasAlpha = format2 === "rgba4444";
      if (format2 === "rgba4444") {
        for (let i = 0; i < length; i++) {
          const color2 = data[i];
          const a = color2 >> 24 & 255;
          const b = color2 >> 16 & 255;
          const g = color2 >> 8 & 255;
          const r = color2 & 255;
          const key = rgba8888_to_rgba4444(r, g, b, a);
          const idx = key in cache ? cache[key] : cache[key] = nearestColorIndexRGBA(r, g, b, a, palette);
          index[i] = idx;
        }
      } else {
        const rgb888_to_key = format2 === "rgb444" ? rgb888_to_rgb444 : rgb888_to_rgb565;
        for (let i = 0; i < length; i++) {
          const color2 = data[i];
          const b = color2 >> 16 & 255;
          const g = color2 >> 8 & 255;
          const r = color2 & 255;
          const key = rgb888_to_key(r, g, b);
          const idx = key in cache ? cache[key] : cache[key] = nearestColorIndexRGB(r, g, b, palette);
          index[i] = idx;
        }
      }
      return index;
    }
    function nearestColorIndexRGBA(r, g, b, a, palette) {
      let k = 0;
      let mindist = 1e100;
      for (let i = 0; i < palette.length; i++) {
        const px2 = palette[i];
        const a2 = px2[3];
        let curdist = sqr2(a2 - a);
        if (curdist > mindist)
          continue;
        const r2 = px2[0];
        curdist += sqr2(r2 - r);
        if (curdist > mindist)
          continue;
        const g2 = px2[1];
        curdist += sqr2(g2 - g);
        if (curdist > mindist)
          continue;
        const b2 = px2[2];
        curdist += sqr2(b2 - b);
        if (curdist > mindist)
          continue;
        mindist = curdist;
        k = i;
      }
      return k;
    }
    function nearestColorIndexRGB(r, g, b, palette) {
      let k = 0;
      let mindist = 1e100;
      for (let i = 0; i < palette.length; i++) {
        const px2 = palette[i];
        const r2 = px2[0];
        let curdist = sqr2(r2 - r);
        if (curdist > mindist)
          continue;
        const g2 = px2[1];
        curdist += sqr2(g2 - g);
        if (curdist > mindist)
          continue;
        const b2 = px2[2];
        curdist += sqr2(b2 - b);
        if (curdist > mindist)
          continue;
        mindist = curdist;
        k = i;
      }
      return k;
    }
    function snapColorsToPalette(palette, knownColors, threshold = 5) {
      if (!palette.length || !knownColors.length)
        return;
      const paletteRGB = palette.map((p) => p.slice(0, 3));
      const thresholdSq = threshold * threshold;
      const dim = palette[0].length;
      for (let i = 0; i < knownColors.length; i++) {
        let color2 = knownColors[i];
        if (color2.length < dim) {
          color2 = [color2[0], color2[1], color2[2], 255];
        } else if (color2.length > dim) {
          color2 = color2.slice(0, 3);
        } else {
          color2 = color2.slice();
        }
        const r = nearestColorIndexWithDistance(paletteRGB, color2.slice(0, 3), euclideanDistanceSquared);
        const idx = r[0];
        const distanceSq = r[1];
        if (distanceSq > 0 && distanceSq <= thresholdSq) {
          palette[idx] = color2;
        }
      }
    }
    function sqr2(a) {
      return a * a;
    }
    function nearestColorIndex(colors, pixel, distanceFn = euclideanDistanceSquared) {
      let minDist = Infinity;
      let minDistIndex = -1;
      for (let j = 0; j < colors.length; j++) {
        const paletteColor = colors[j];
        const dist = distanceFn(pixel, paletteColor);
        if (dist < minDist) {
          minDist = dist;
          minDistIndex = j;
        }
      }
      return minDistIndex;
    }
    function nearestColorIndexWithDistance(colors, pixel, distanceFn = euclideanDistanceSquared) {
      let minDist = Infinity;
      let minDistIndex = -1;
      for (let j = 0; j < colors.length; j++) {
        const paletteColor = colors[j];
        const dist = distanceFn(pixel, paletteColor);
        if (dist < minDist) {
          minDist = dist;
          minDistIndex = j;
        }
      }
      return [minDistIndex, minDist];
    }
    function nearestColor(colors, pixel, distanceFn = euclideanDistanceSquared) {
      return colors[nearestColorIndex(colors, pixel, distanceFn)];
    }
    function GIFEncoder2(opt = {}) {
      const { initialCapacity = 4096, auto = true } = opt;
      const stream = createStream(initialCapacity);
      const HSIZE = 5003;
      const accum = new Uint8Array(256);
      const htab = new Int32Array(HSIZE);
      const codetab = new Int32Array(HSIZE);
      let hasInit = false;
      return {
        reset() {
          stream.reset();
          hasInit = false;
        },
        finish() {
          stream.writeByte(constants_default.trailer);
        },
        bytes() {
          return stream.bytes();
        },
        bytesView() {
          return stream.bytesView();
        },
        get buffer() {
          return stream.buffer;
        },
        get stream() {
          return stream;
        },
        writeHeader,
        writeFrame(index, width, height, opts = {}) {
          const {
            transparent = false,
            transparentIndex = 0,
            delay = 0,
            palette = null,
            repeat = 0,
            colorDepth = 8,
            dispose = -1
          } = opts;
          let first = false;
          if (auto) {
            if (!hasInit) {
              first = true;
              writeHeader();
              hasInit = true;
            }
          } else {
            first = Boolean(opts.first);
          }
          width = Math.max(0, Math.floor(width));
          height = Math.max(0, Math.floor(height));
          if (first) {
            if (!palette) {
              throw new Error("First frame must include a { palette } option");
            }
            encodeLogicalScreenDescriptor(stream, width, height, palette, colorDepth);
            encodeColorTable(stream, palette);
            if (repeat >= 0) {
              encodeNetscapeExt(stream, repeat);
            }
          }
          const delayTime = Math.round(delay / 10);
          encodeGraphicControlExt(stream, dispose, delayTime, transparent, transparentIndex);
          const useLocalColorTable = Boolean(palette) && !first;
          encodeImageDescriptor(stream, width, height, useLocalColorTable ? palette : null);
          if (useLocalColorTable)
            encodeColorTable(stream, palette);
          encodePixels(stream, index, width, height, colorDepth, accum, htab, codetab);
        }
      };
      function writeHeader() {
        writeUTFBytes(stream, "GIF89a");
      }
    }
    function encodeGraphicControlExt(stream, dispose, delay, transparent, transparentIndex) {
      stream.writeByte(33);
      stream.writeByte(249);
      stream.writeByte(4);
      if (transparentIndex < 0) {
        transparentIndex = 0;
        transparent = false;
      }
      var transp, disp;
      if (!transparent) {
        transp = 0;
        disp = 0;
      } else {
        transp = 1;
        disp = 2;
      }
      if (dispose >= 0) {
        disp = dispose & 7;
      }
      disp <<= 2;
      const userInput = 0;
      stream.writeByte(0 | disp | userInput | transp);
      writeUInt16(stream, delay);
      stream.writeByte(transparentIndex || 0);
      stream.writeByte(0);
    }
    function encodeLogicalScreenDescriptor(stream, width, height, palette, colorDepth = 8) {
      const globalColorTableFlag = 1;
      const sortFlag = 0;
      const globalColorTableSize = colorTableSize(palette.length) - 1;
      const fields = globalColorTableFlag << 7 | colorDepth - 1 << 4 | sortFlag << 3 | globalColorTableSize;
      const backgroundColorIndex = 0;
      const pixelAspectRatio = 0;
      writeUInt16(stream, width);
      writeUInt16(stream, height);
      stream.writeBytes([fields, backgroundColorIndex, pixelAspectRatio]);
    }
    function encodeNetscapeExt(stream, repeat) {
      stream.writeByte(33);
      stream.writeByte(255);
      stream.writeByte(11);
      writeUTFBytes(stream, "NETSCAPE2.0");
      stream.writeByte(3);
      stream.writeByte(1);
      writeUInt16(stream, repeat);
      stream.writeByte(0);
    }
    function encodeColorTable(stream, palette) {
      const colorTableLength = 1 << colorTableSize(palette.length);
      for (let i = 0; i < colorTableLength; i++) {
        let color2 = [0, 0, 0];
        if (i < palette.length) {
          color2 = palette[i];
        }
        stream.writeByte(color2[0]);
        stream.writeByte(color2[1]);
        stream.writeByte(color2[2]);
      }
    }
    function encodeImageDescriptor(stream, width, height, localPalette) {
      stream.writeByte(44);
      writeUInt16(stream, 0);
      writeUInt16(stream, 0);
      writeUInt16(stream, width);
      writeUInt16(stream, height);
      if (localPalette) {
        const interlace = 0;
        const sorted = 0;
        const palSize = colorTableSize(localPalette.length) - 1;
        stream.writeByte(128 | interlace | sorted | 0 | palSize);
      } else {
        stream.writeByte(0);
      }
    }
    function encodePixels(stream, index, width, height, colorDepth = 8, accum, htab, codetab) {
      lzwEncode_default(width, height, index, colorDepth, stream, accum, htab, codetab);
    }
    function writeUInt16(stream, short) {
      stream.writeByte(short & 255);
      stream.writeByte(short >> 8 & 255);
    }
    function writeUTFBytes(stream, text) {
      for (var i = 0; i < text.length; i++) {
        stream.writeByte(text.charCodeAt(i));
      }
    }
    function colorTableSize(length) {
      return Math.max(Math.ceil(Math.log2(length)), 1);
    }
    var src_default = GIFEncoder2;
  }
});

// src/utils/path.ts
import * as path from "node:path";
var PathValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PathValidationError";
  }
};
var CONTROL_CHARS = /[\u0000-\u001F]/;
var ALLOWED_EXTENSIONS = [".svg", ".gif"];
function outputFormat(value) {
  return value.toLowerCase().endsWith(".gif") ? "gif" : "svg";
}
function validateOutputPath(raw) {
  const value = raw.trim();
  if (value.length === 0) {
    throw new PathValidationError("Output path must not be empty.");
  }
  if (value.length > 400) {
    throw new PathValidationError("Output path is too long (max 400 chars).");
  }
  if (CONTROL_CHARS.test(value)) {
    throw new PathValidationError("Output path contains control characters.");
  }
  if (value.includes("\\")) {
    throw new PathValidationError(
      "Output path must use forward slashes, not backslashes."
    );
  }
  if (value.includes("\0")) {
    throw new PathValidationError("Output path contains a null byte.");
  }
  if (path.posix.isAbsolute(value) || /^[a-zA-Z]:/.test(value)) {
    throw new PathValidationError("Output path must be relative.");
  }
  if (value.startsWith("//")) {
    throw new PathValidationError("Output path must not be a UNC path.");
  }
  if (!ALLOWED_EXTENSIONS.some((ext) => value.toLowerCase().endsWith(ext))) {
    throw new PathValidationError(
      'Output path must end with ".svg" or ".gif".'
    );
  }
  const segments = value.split("/").filter((s) => s.length > 0);
  for (const segment of segments) {
    if (segment === "..") {
      throw new PathValidationError("Output path must not traverse upward.");
    }
    if (segment === ".git") {
      throw new PathValidationError('Output path must not target ".git".');
    }
  }
  const normalized = path.posix.normalize(value);
  if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
    throw new PathValidationError("Output path escapes the workspace.");
  }
  return normalized;
}
function deriveDualPaths(raw) {
  const normalized = validateOutputPath(raw);
  const extensionIndex = normalized.lastIndexOf(".");
  if (extensionIndex <= 0) {
    throw new PathValidationError(
      "Output path must have a name before the file extension."
    );
  }
  const stem = normalized.slice(0, extensionIndex);
  const extension = normalized.slice(extensionIndex);
  const base = stem.split("/").pop() ?? "";
  if (base.length === 0) {
    throw new PathValidationError(
      "Output path must have a file name before the file extension."
    );
  }
  const light = validateOutputPath(`${stem}-light${extension}`);
  const dark = validateOutputPath(`${stem}-dark${extension}`);
  if (light.toLowerCase() === dark.toLowerCase()) {
    throw new PathValidationError(
      "Derived light and dark output paths must be distinct."
    );
  }
  return { light, dark };
}

// src/config/defaults.ts
var DEFAULT_COLUMNS = 52;
var DEFAULT_ROWS = 26;
var DEFAULT_AXIS_FONT_SIZE = 10;
var DEFAULT_DUAL_THEME = false;
var MAX_REPOSITORIES = 20;
function configRepositories(config) {
  const list = config.repositories;
  return list && list.length > 0 ? list : [config.repository];
}
function configDualTheme(config) {
  return config.dualTheme ?? DEFAULT_DUAL_THEME;
}
function normalizeChartConfig(config) {
  const showXAxis = config.showXAxis ?? true;
  const showYAxis = config.showYAxis ?? config.style !== "sparkline";
  const showLegend = config.showLegend ?? config.style !== "sparkline";
  const columns = resolveDimension(config.columns, DEFAULT_COLUMNS);
  const rows = resolveDimension(config.rows, DEFAULT_ROWS);
  const axisFontSize = resolveDimension(
    config.axisFontSize,
    DEFAULT_AXIS_FONT_SIZE
  );
  if (columns === config.columns && rows === config.rows && axisFontSize === config.axisFontSize && showXAxis === config.showXAxis && showYAxis === config.showYAxis && showLegend === config.showLegend) {
    return config;
  }
  return {
    ...config,
    columns,
    rows,
    axisFontSize,
    showXAxis,
    showYAxis,
    showLegend
  };
}
function normalizeChartModel(model) {
  const config = normalizeChartConfig(model.config);
  if (config === model.config && model.selectedWeeks !== void 0 && model.peakGain !== void 0) {
    return model;
  }
  const selectedWeeks = model.selectedWeeks ?? [];
  return {
    ...model,
    config,
    selectedWeeks,
    peakGain: model.peakGain ?? peakOf(selectedWeeks)
  };
}
function peakOf(weeks) {
  return weeks.reduce((max2, week) => Math.max(max2, week.added), 0);
}
function resolveDimension(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// src/config/validate.ts
var ConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
};
function parseBoolean(name, raw, fallback) {
  if (raw === void 0 || raw.trim() === "") {
    return fallback;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new ConfigError(
    `Input "${name}" must be "true" or "false" (got "${raw}").`
  );
}
function parseInteger(name, raw, fallback, min2, max2) {
  if (raw === void 0 || raw.trim() === "") {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new ConfigError(`Input "${name}" must be an integer (got "${raw}").`);
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value)) {
    throw new ConfigError(`Input "${name}" is out of range.`);
  }
  if (value < min2 || value > max2) {
    throw new ConfigError(
      `Input "${name}" must be between ${min2} and ${max2} (got ${value}).`
    );
  }
  return value;
}
function parseOptionalInteger(name, raw, min2, max2) {
  if (raw === void 0 || raw.trim() === "" || raw.trim() === "auto") {
    return null;
  }
  return parseInteger(name, raw, min2, min2, max2);
}
function parseSeconds(name, raw, fallback, min2, max2) {
  if (raw === void 0 || raw.trim() === "") {
    return fallback;
  }
  const trimmed = raw.trim().toLowerCase();
  const msMatch = /^(\d+(?:\.\d+)?)ms$/.exec(trimmed);
  const sMatch = /^(\d+(?:\.\d+)?)s?$/.exec(trimmed);
  let seconds2;
  if (msMatch) {
    seconds2 = Number.parseFloat(msMatch[1] ?? "") / 1e3;
  } else if (sMatch) {
    seconds2 = Number.parseFloat(sMatch[1] ?? "");
  } else {
    throw new ConfigError(
      `Input "${name}" must be a duration like "4s" or "500ms" (got "${raw}").`
    );
  }
  if (!Number.isFinite(seconds2)) {
    throw new ConfigError(`Input "${name}" is not a finite duration.`);
  }
  if (seconds2 < min2 || seconds2 > max2) {
    throw new ConfigError(
      `Input "${name}" must be between ${min2}s and ${max2}s (got ${seconds2}s).`
    );
  }
  return seconds2;
}
function parseEnum(name, raw, allowed, fallback) {
  if (raw === void 0 || raw.trim() === "") {
    return fallback;
  }
  const value = raw.trim().toLowerCase();
  if (!allowed.includes(value)) {
    throw new ConfigError(
      `Input "${name}" must be one of: ${allowed.join(", ")} (got "${raw}").`
    );
  }
  return value;
}
var HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function parseColor(name, raw) {
  const value = raw.trim();
  if (!HEX_COLOR.test(value)) {
    throw new ConfigError(
      `Input "${name}" must be a hex colour like "#40c463" (got "${raw}").`
    );
  }
  return value.toLowerCase();
}
function parseBackground(name, raw) {
  if (raw === void 0 || raw.trim() === "") {
    return "transparent";
  }
  const value = raw.trim().toLowerCase();
  if (value === "transparent" || value === "none") {
    return "transparent";
  }
  return parseColor(name, raw);
}
var FONT_TOKEN = /^[A-Za-z0-9 _-]+$/;
function parseFontFamily(name, raw, fallback) {
  if (raw === void 0 || raw.trim() === "") {
    return fallback;
  }
  const value = raw.trim();
  if (value.length > 200) {
    throw new ConfigError(`Input "${name}" is too long (max 200 chars).`);
  }
  if (/[\u0000-\u001F;{}()<>\\]/.test(value)) {
    throw new ConfigError(`Input "${name}" contains invalid characters.`);
  }
  const families = value.split(",").map((f) => f.trim());
  const cleaned = [];
  for (const family of families) {
    if (family.length === 0) {
      throw new ConfigError(`Input "${name}" has an empty family name.`);
    }
    const quoted = family.startsWith('"') && family.endsWith('"') || family.startsWith("'") && family.endsWith("'");
    const inner = quoted ? family.slice(1, -1) : family;
    if (!FONT_TOKEN.test(inner)) {
      throw new ConfigError(
        `Input "${name}" has an invalid family name: "${family}".`
      );
    }
    cleaned.push(inner.includes(" ") ? `"${inner}"` : inner);
  }
  return cleaned.join(", ");
}
function parseRepository(raw) {
  const value = (raw ?? "").trim();
  if (value.length === 0) {
    throw new ConfigError(
      'A repository is required (set "repository" or run inside a repo).'
    );
  }
  if (/[\s]/.test(value) || value.includes("://") || value.includes("@")) {
    throw new ConfigError(
      `Repository must be "owner/repo", not a URL (got "${raw}").`
    );
  }
  const parts = value.split("/");
  if (parts.length !== 2) {
    throw new ConfigError(`Repository must be "owner/repo" (got "${raw}").`);
  }
  const [owner, repo] = parts;
  const namePattern = /^[A-Za-z0-9._-]+$/;
  if (!owner || !namePattern.test(owner)) {
    throw new ConfigError(`Repository owner is invalid (got "${raw}").`);
  }
  if (!repo || !namePattern.test(repo) || repo === "." || repo === "..") {
    throw new ConfigError(`Repository name is invalid (got "${raw}").`);
  }
  return { owner, repo };
}
function parseRepositories(raw, options = {}) {
  const warn = options.warn ?? (() => void 0);
  const max2 = options.max ?? 20;
  const value = raw ?? "";
  if (value.trim() === "") {
    return [];
  }
  const entries = value.split(/[\n,]/).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (entries.length === 0) {
    return [];
  }
  const seen = /* @__PURE__ */ new Map();
  const parsed = [];
  const duplicates = [];
  for (const entry of entries) {
    const repository = parseRepository(entry);
    const key = `${repository.owner}/${repository.repo}`.toLowerCase();
    const first = seen.get(key);
    if (first !== void 0) {
      duplicates.push(entry);
      continue;
    }
    seen.set(key, entry);
    parsed.push(repository);
  }
  if (duplicates.length > 0) {
    warn(
      `Input "repositories" contains duplicate entries that were ignored: ${duplicates.join(", ")}.`
    );
  }
  if (parsed.length > max2) {
    throw new ConfigError(
      `Input "repositories" accepts at most ${max2} repositories (got ${parsed.length}).`
    );
  }
  return parsed;
}
function parseTitle(raw) {
  if (raw === void 0 || raw.trim() === "") {
    return null;
  }
  const value = raw.trim();
  if (value.length > 200) {
    throw new ConfigError('Input "title" is too long (max 200 chars).');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    throw new ConfigError('Input "title" contains control characters.');
  }
  return value;
}

// src/config/inputs.ts
var STYLES = [
  "contributions",
  "line",
  "area",
  "bar",
  "sparkline",
  "grid",
  "step-line",
  "milestone-scatter",
  "milestone-area",
  "clustered-bar",
  "neon-glow",
  "neon-glow-stream",
  "ascii-terminal",
  "hand-drawn"
];
var THEMES = ["light", "dark", "auto"];
var DEFAULT_THEME = "light";
var SCALES = ["absolute", "visible"];
var DATE_FORMATS = ["short", "long", "iso"];
var PERIODS = ["3m", "6m", "1y", "2y", "5y", "all"];
var PERIOD_WEEKS = {
  "3m": 13,
  "6m": 26,
  "1y": 52,
  "2y": 104,
  "5y": 260
};
var DEFAULT_FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
var MAX_WEEKS = 3e3;
var BACKGROUND_MODES = ["transparent", "solid"];
function parseInputs(raw, options = {}) {
  const env = options.env ?? {};
  const warn = options.warn ?? (() => void 0);
  const token = firstNonEmpty(raw.token, env.GITHUB_TOKEN, env.INPUT_TOKEN) ?? "";
  const repositories = resolveRepositories(raw, env, warn);
  const repository = repositories[0];
  const output = validateOutputPath(
    firstNonEmpty(raw.output) ?? "assets/star-chart.svg"
  );
  const style = parseEnum("style", raw.style, STYLES, "contributions");
  const dualTheme = parseBoolean("dual_theme", raw.dual_theme, false);
  const theme = resolveTheme(raw, dualTheme, warn);
  if (outputFormat(output) === "gif" && theme === "auto" && !dualTheme) {
    throw new ConfigError(
      'A GIF output cannot use theme "auto" (raster images cannot respond to prefers-color-scheme). Set theme to "light" or "dark", or enable dual_theme to emit both.'
    );
  }
  const scale = parseEnum("scale", raw.scale, SCALES, "absolute");
  const dateFormat = parseEnum(
    "date_format",
    raw.date_format,
    DATE_FORMATS,
    "short"
  );
  const { weeks, period } = resolveWeeks(raw, warn);
  const columns = parseInteger("columns", raw.columns, DEFAULT_COLUMNS, 1, 260);
  const rows = parseInteger("rows", raw.rows, DEFAULT_ROWS, 1, 200);
  if (columns * rows > 52e3) {
    throw new ConfigError(
      `columns \xD7 rows must not exceed 52,000 (got ${columns * rows}).`
    );
  }
  const width = parseInteger("width", raw.width, 900, 240, 2400);
  const height = parseOptionalInteger("height", raw.height, 120, 4800);
  const cellSize = parseOptionalInteger("cell_size", raw.cell_size, 1, 32);
  const cellGap = parseOptionalInteger("cell_gap", raw.cell_gap, 0, 12);
  const cellRadius = parseOptionalInteger(
    "cell_radius",
    raw.cell_radius,
    0,
    16
  );
  if (cellRadius !== null && cellSize !== null && cellRadius > Math.floor(cellSize / 2)) {
    throw new ConfigError("cell_radius must not exceed half of cell_size.");
  }
  const axisFontSize = parseInteger(
    "axis_font_size",
    raw.axis_font_size,
    DEFAULT_AXIS_FONT_SIZE,
    6,
    48
  );
  const paletteOverrides = resolvePaletteOverrides(raw);
  const background = resolveBackground(raw, warn);
  const fontFamily = parseFontFamily(
    "font_family",
    raw.font_family,
    DEFAULT_FONT
  );
  const animation = resolveAnimation(raw);
  const config = {
    repository,
    repositories,
    output,
    style,
    theme,
    dualTheme,
    weeks,
    period,
    columns,
    rows,
    width,
    height,
    showTitle: parseBoolean("show_title", raw.show_title, true),
    showTotal: parseBoolean("show_total", raw.show_total, true),
    showChange: parseBoolean("show_change", raw.show_change, true),
    showDates: parseBoolean("show_dates", raw.show_dates, true),
    showXAxis: parseBoolean("show_x_axis", raw.show_x_axis, true),
    showYAxis: parseBoolean(
      "show_y_axis",
      raw.show_y_axis,
      style !== "sparkline"
    ),
    showLegend: parseBoolean(
      "show_legend",
      raw.show_legend,
      style !== "sparkline"
    ),
    title: parseTitle(raw.title),
    dateFormat,
    axisFontSize,
    cellSize,
    cellGap,
    cellRadius,
    background,
    paletteOverrides,
    fontFamily,
    scale,
    logo: parseBoolean("logo", raw.logo, true),
    animation
  };
  return { config, token };
}
function resolveRepositories(raw, env, warn) {
  const list = parseRepositories(raw.repositories, {
    max: MAX_REPOSITORIES,
    warn
  });
  if (list.length === 0) {
    return [
      parseRepository(firstNonEmpty(raw.repository, env.GITHUB_REPOSITORY))
    ];
  }
  const explicit = firstNonEmpty(raw.repository);
  const inherited = firstNonEmpty(env.GITHUB_REPOSITORY);
  const isWorkflowDefault = explicit !== void 0 && inherited !== void 0 && explicit.trim().toLowerCase() === inherited.trim().toLowerCase();
  const alreadyListed = explicit !== void 0 && list.some(
    (entry) => `${entry.owner}/${entry.repo}`.toLowerCase() === explicit.trim().toLowerCase()
  );
  if (explicit !== void 0 && !isWorkflowDefault && !alreadyListed) {
    warn(
      `Both "repositories" and "repository" were supplied; "repositories" takes precedence and "${explicit.trim()}" is not charted.`
    );
  }
  return list;
}
function resolveTheme(raw, dualTheme, warn) {
  const theme = parseEnum("theme", raw.theme, THEMES, DEFAULT_THEME);
  if (dualTheme && firstNonEmpty(raw.theme) !== void 0 && theme !== DEFAULT_THEME) {
    warn(
      `"dual_theme" renders fixed light and dark files; the "theme" input ("${theme}") is ignored.`
    );
  }
  return theme;
}
function resolveWeeks(raw, warn) {
  const rawPeriod = firstNonEmpty(raw.period);
  const rawWeeks = firstNonEmpty(raw.weeks);
  if (rawPeriod !== void 0) {
    const period = parseEnum("period", rawPeriod, PERIODS, "1y");
    if (rawWeeks !== void 0) {
      warn(
        'Both "period" and "weeks" were supplied; "period" takes precedence.'
      );
    }
    if (period === "all") {
      return { weeks: MAX_WEEKS, period };
    }
    return { weeks: PERIOD_WEEKS[period], period };
  }
  if (rawWeeks !== void 0) {
    const weeks = parseInteger("weeks", rawWeeks, 52, 1, MAX_WEEKS);
    return { weeks, period: null };
  }
  return { weeks: PERIOD_WEEKS["1y"], period: "1y" };
}
function resolveBackground(raw, warn) {
  const rawMode = firstNonEmpty(raw.background_mode);
  if (rawMode === void 0) {
    return parseBackground("background", raw.background);
  }
  const mode = parseEnum(
    "background_mode",
    rawMode,
    BACKGROUND_MODES,
    "transparent"
  );
  const rawBackground = firstNonEmpty(raw.background);
  if (mode === "transparent") {
    if (rawBackground !== void 0 && !isTransparentKeyword(rawBackground)) {
      warn(
        `background_mode "transparent" ignores the supplied "background" value ("${rawBackground}").`
      );
    }
    return "transparent";
  }
  if (rawBackground === void 0 || isTransparentKeyword(rawBackground)) {
    throw new ConfigError(
      `background_mode "solid" requires a hex "background" colour (got "${rawBackground ?? ""}").`
    );
  }
  return parseColor("background", rawBackground);
}
function isTransparentKeyword(raw) {
  const value = raw.trim().toLowerCase();
  return value === "transparent" || value === "none";
}
function resolvePaletteOverrides(raw) {
  const overrides = {};
  const map2 = [
    ["empty", "empty_color"],
    ["level1", "level_1_color"],
    ["level2", "level_2_color"],
    ["level3", "level_3_color"],
    ["level4", "level_4_color"]
  ];
  for (const [key, input] of map2) {
    const value = firstNonEmpty(raw[input]);
    if (value !== void 0) {
      overrides[key] = parseColor(input, value);
    }
  }
  return overrides;
}
function resolveAnimation(raw) {
  const mode = parseEnum(
    "animation",
    raw.animation,
    ["none", "once", "loop"],
    "none"
  );
  return {
    mode,
    durationSeconds: parseSeconds(
      "animation_duration",
      raw.animation_duration,
      4,
      0.2,
      60
    ),
    pauseSeconds: parseSeconds(
      "animation_pause",
      raw.animation_pause,
      2,
      0,
      60
    ),
    delaySeconds: parseSeconds(
      "animation_delay",
      raw.animation_delay,
      0,
      0,
      60
    ),
    style: parseEnum(
      "animation_style",
      raw.animation_style,
      ["grow", "reveal", "cascade"],
      "grow"
    ),
    direction: parseEnum(
      "animation_direction",
      raw.animation_direction,
      ["chronological", "simultaneous"],
      "chronological"
    ),
    easing: parseEnum(
      "animation_easing",
      raw.animation_easing,
      ["linear", "ease-in", "ease-out", "ease-in-out"],
      "ease-out"
    ),
    animateTotal: parseBoolean("animate_total", raw.animate_total, false)
  };
}
function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== void 0 && value.trim() !== "") {
      return value;
    }
  }
  return void 0;
}

// src/config/themes.ts
var LIGHT_PALETTE = {
  empty: "#ebedf0",
  level1: "#9be9a8",
  level2: "#40c463",
  level3: "#30a14e",
  level4: "#216e39"
};
var DARK_PALETTE = {
  // Lighter than GitHub's #161b22 so unfilled cells read as grey squares
  // against a dark README canvas instead of blending into it.
  empty: "#30363d",
  level1: "#0e4429",
  level2: "#006d32",
  level3: "#26a641",
  level4: "#39d353"
};
var LIGHT_COLORS = {
  text: "#1f2328",
  muted: "#59636e",
  border: "#d1d9e0",
  accent: "#e3b341",
  stroke: "#2da44e",
  fill: "#2da44e",
  axis: "#d1d9e0"
};
var DARK_COLORS = {
  text: "#e6edf3",
  muted: "#9198a1",
  border: "#3d444d",
  accent: "#e3b341",
  stroke: "#3fb950",
  fill: "#3fb950",
  axis: "#3d444d"
};
function basePalette(theme) {
  return theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}
function applyOverrides(base, overrides) {
  return {
    empty: overrides.empty ?? base.empty,
    level1: overrides.level1 ?? base.level1,
    level2: overrides.level2 ?? base.level2,
    level3: overrides.level3 ?? base.level3,
    level4: overrides.level4 ?? base.level4
  };
}
function seriesColor(index, theme) {
  const hues = [140, 215, 32, 280, 350, 180];
  const hue = hues[index] ?? index * 137.508 % 360;
  return `hsl(${Math.round(hue)},${theme === "dark" ? 72 : 66}%,${theme === "dark" ? 65 : 36}%)`;
}

// node_modules/d3-time/src/interval.js
var t0 = /* @__PURE__ */ new Date();
var t1 = /* @__PURE__ */ new Date();
function timeInterval(floori, offseti, count, field) {
  function interval(date2) {
    return floori(date2 = arguments.length === 0 ? /* @__PURE__ */ new Date() : /* @__PURE__ */ new Date(+date2)), date2;
  }
  interval.floor = (date2) => {
    return floori(date2 = /* @__PURE__ */ new Date(+date2)), date2;
  };
  interval.ceil = (date2) => {
    return floori(date2 = new Date(date2 - 1)), offseti(date2, 1), floori(date2), date2;
  };
  interval.round = (date2) => {
    const d0 = interval(date2), d1 = interval.ceil(date2);
    return date2 - d0 < d1 - date2 ? d0 : d1;
  };
  interval.offset = (date2, step) => {
    return offseti(date2 = /* @__PURE__ */ new Date(+date2), step == null ? 1 : Math.floor(step)), date2;
  };
  interval.range = (start, stop, step) => {
    const range = [];
    start = interval.ceil(start);
    step = step == null ? 1 : Math.floor(step);
    if (!(start < stop) || !(step > 0)) return range;
    let previous;
    do
      range.push(previous = /* @__PURE__ */ new Date(+start)), offseti(start, step), floori(start);
    while (previous < start && start < stop);
    return range;
  };
  interval.filter = (test) => {
    return timeInterval((date2) => {
      if (date2 >= date2) while (floori(date2), !test(date2)) date2.setTime(date2 - 1);
    }, (date2, step) => {
      if (date2 >= date2) {
        if (step < 0) while (++step <= 0) {
          while (offseti(date2, -1), !test(date2)) {
          }
        }
        else while (--step >= 0) {
          while (offseti(date2, 1), !test(date2)) {
          }
        }
      }
    });
  };
  if (count) {
    interval.count = (start, end) => {
      t0.setTime(+start), t1.setTime(+end);
      floori(t0), floori(t1);
      return Math.floor(count(t0, t1));
    };
    interval.every = (step) => {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null : !(step > 1) ? interval : interval.filter(field ? (d) => field(d) % step === 0 : (d) => interval.count(0, d) % step === 0);
    };
  }
  return interval;
}

// node_modules/d3-time/src/millisecond.js
var millisecond = timeInterval(() => {
}, (date2, step) => {
  date2.setTime(+date2 + step);
}, (start, end) => {
  return end - start;
});
millisecond.every = (k) => {
  k = Math.floor(k);
  if (!isFinite(k) || !(k > 0)) return null;
  if (!(k > 1)) return millisecond;
  return timeInterval((date2) => {
    date2.setTime(Math.floor(date2 / k) * k);
  }, (date2, step) => {
    date2.setTime(+date2 + step * k);
  }, (start, end) => {
    return (end - start) / k;
  });
};
var milliseconds = millisecond.range;

// node_modules/d3-time/src/duration.js
var durationSecond = 1e3;
var durationMinute = durationSecond * 60;
var durationHour = durationMinute * 60;
var durationDay = durationHour * 24;
var durationWeek = durationDay * 7;
var durationMonth = durationDay * 30;
var durationYear = durationDay * 365;

// node_modules/d3-time/src/second.js
var second = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds());
}, (date2, step) => {
  date2.setTime(+date2 + step * durationSecond);
}, (start, end) => {
  return (end - start) / durationSecond;
}, (date2) => {
  return date2.getUTCSeconds();
});
var seconds = second.range;

// node_modules/d3-time/src/minute.js
var timeMinute = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds() - date2.getSeconds() * durationSecond);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationMinute);
}, (start, end) => {
  return (end - start) / durationMinute;
}, (date2) => {
  return date2.getMinutes();
});
var timeMinutes = timeMinute.range;
var utcMinute = timeInterval((date2) => {
  date2.setUTCSeconds(0, 0);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationMinute);
}, (start, end) => {
  return (end - start) / durationMinute;
}, (date2) => {
  return date2.getUTCMinutes();
});
var utcMinutes = utcMinute.range;

// node_modules/d3-time/src/hour.js
var timeHour = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds() - date2.getSeconds() * durationSecond - date2.getMinutes() * durationMinute);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationHour);
}, (start, end) => {
  return (end - start) / durationHour;
}, (date2) => {
  return date2.getHours();
});
var timeHours = timeHour.range;
var utcHour = timeInterval((date2) => {
  date2.setUTCMinutes(0, 0, 0);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationHour);
}, (start, end) => {
  return (end - start) / durationHour;
}, (date2) => {
  return date2.getUTCHours();
});
var utcHours = utcHour.range;

// node_modules/d3-time/src/day.js
var timeDay = timeInterval(
  (date2) => date2.setHours(0, 0, 0, 0),
  (date2, step) => date2.setDate(date2.getDate() + step),
  (start, end) => (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay,
  (date2) => date2.getDate() - 1
);
var timeDays = timeDay.range;
var utcDay = timeInterval((date2) => {
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCDate(date2.getUTCDate() + step);
}, (start, end) => {
  return (end - start) / durationDay;
}, (date2) => {
  return date2.getUTCDate() - 1;
});
var utcDays = utcDay.range;
var unixDay = timeInterval((date2) => {
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCDate(date2.getUTCDate() + step);
}, (start, end) => {
  return (end - start) / durationDay;
}, (date2) => {
  return Math.floor(date2 / durationDay);
});
var unixDays = unixDay.range;

// node_modules/d3-time/src/week.js
function timeWeekday(i) {
  return timeInterval((date2) => {
    date2.setDate(date2.getDate() - (date2.getDay() + 7 - i) % 7);
    date2.setHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setDate(date2.getDate() + step * 7);
  }, (start, end) => {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}
var timeSunday = timeWeekday(0);
var timeMonday = timeWeekday(1);
var timeTuesday = timeWeekday(2);
var timeWednesday = timeWeekday(3);
var timeThursday = timeWeekday(4);
var timeFriday = timeWeekday(5);
var timeSaturday = timeWeekday(6);
var timeSundays = timeSunday.range;
var timeMondays = timeMonday.range;
var timeTuesdays = timeTuesday.range;
var timeWednesdays = timeWednesday.range;
var timeThursdays = timeThursday.range;
var timeFridays = timeFriday.range;
var timeSaturdays = timeSaturday.range;
function utcWeekday(i) {
  return timeInterval((date2) => {
    date2.setUTCDate(date2.getUTCDate() - (date2.getUTCDay() + 7 - i) % 7);
    date2.setUTCHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setUTCDate(date2.getUTCDate() + step * 7);
  }, (start, end) => {
    return (end - start) / durationWeek;
  });
}
var utcSunday = utcWeekday(0);
var utcMonday = utcWeekday(1);
var utcTuesday = utcWeekday(2);
var utcWednesday = utcWeekday(3);
var utcThursday = utcWeekday(4);
var utcFriday = utcWeekday(5);
var utcSaturday = utcWeekday(6);
var utcSundays = utcSunday.range;
var utcMondays = utcMonday.range;
var utcTuesdays = utcTuesday.range;
var utcWednesdays = utcWednesday.range;
var utcThursdays = utcThursday.range;
var utcFridays = utcFriday.range;
var utcSaturdays = utcSaturday.range;

// node_modules/d3-time/src/month.js
var timeMonth = timeInterval((date2) => {
  date2.setDate(1);
  date2.setHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setMonth(date2.getMonth() + step);
}, (start, end) => {
  return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
}, (date2) => {
  return date2.getMonth();
});
var timeMonths = timeMonth.range;
var utcMonth = timeInterval((date2) => {
  date2.setUTCDate(1);
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCMonth(date2.getUTCMonth() + step);
}, (start, end) => {
  return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
}, (date2) => {
  return date2.getUTCMonth();
});
var utcMonths = utcMonth.range;

// node_modules/d3-time/src/year.js
var timeYear = timeInterval((date2) => {
  date2.setMonth(0, 1);
  date2.setHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setFullYear(date2.getFullYear() + step);
}, (start, end) => {
  return end.getFullYear() - start.getFullYear();
}, (date2) => {
  return date2.getFullYear();
});
timeYear.every = (k) => {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date2) => {
    date2.setFullYear(Math.floor(date2.getFullYear() / k) * k);
    date2.setMonth(0, 1);
    date2.setHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setFullYear(date2.getFullYear() + step * k);
  });
};
var timeYears = timeYear.range;
var utcYear = timeInterval((date2) => {
  date2.setUTCMonth(0, 1);
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCFullYear(date2.getUTCFullYear() + step);
}, (start, end) => {
  return end.getUTCFullYear() - start.getUTCFullYear();
}, (date2) => {
  return date2.getUTCFullYear();
});
utcYear.every = (k) => {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date2) => {
    date2.setUTCFullYear(Math.floor(date2.getUTCFullYear() / k) * k);
    date2.setUTCMonth(0, 1);
    date2.setUTCHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setUTCFullYear(date2.getUTCFullYear() + step * k);
  });
};
var utcYears = utcYear.range;

// node_modules/d3-array/src/ascending.js
function ascending(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

// node_modules/d3-array/src/descending.js
function descending(a, b) {
  return a == null || b == null ? NaN : b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
}

// node_modules/d3-array/src/bisector.js
function bisector(f) {
  let compare1, compare2, delta;
  if (f.length !== 2) {
    compare1 = ascending;
    compare2 = (d, x2) => ascending(f(d), x2);
    delta = (d, x2) => f(d) - x2;
  } else {
    compare1 = f === ascending || f === descending ? f : zero;
    compare2 = f;
    delta = f;
  }
  function left(a, x2, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x2, x2) !== 0) return hi;
      do {
        const mid = lo + hi >>> 1;
        if (compare2(a[mid], x2) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }
  function right(a, x2, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x2, x2) !== 0) return hi;
      do {
        const mid = lo + hi >>> 1;
        if (compare2(a[mid], x2) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }
  function center(a, x2, lo = 0, hi = a.length) {
    const i = left(a, x2, lo, hi - 1);
    return i > lo && delta(a[i - 1], x2) > -delta(a[i], x2) ? i - 1 : i;
  }
  return { left, center, right };
}
function zero() {
  return 0;
}

// node_modules/d3-array/src/number.js
function number(x2) {
  return x2 === null ? NaN : +x2;
}

// node_modules/d3-array/src/bisect.js
var ascendingBisect = bisector(ascending);
var bisectRight = ascendingBisect.right;
var bisectLeft = ascendingBisect.left;
var bisectCenter = bisector(number).center;
var bisect_default = bisectRight;

// node_modules/d3-array/src/ticks.js
var e10 = Math.sqrt(50);
var e5 = Math.sqrt(10);
var e2 = Math.sqrt(2);
function tickSpec(start, stop, count) {
  const step = (stop - start) / Math.max(0, count), power = Math.floor(Math.log10(step)), error = step / Math.pow(10, power), factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}
function ticks(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start, [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1, ticks2 = new Array(n);
  if (reverse) {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks2[i] = (i2 - i) / -inc;
    else for (let i = 0; i < n; ++i) ticks2[i] = (i2 - i) * inc;
  } else {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks2[i] = (i1 + i) / -inc;
    else for (let i = 0; i < n; ++i) ticks2[i] = (i1 + i) * inc;
  }
  return ticks2;
}
function tickIncrement(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  return tickSpec(start, stop, count)[2];
}
function tickStep(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  const reverse = stop < start, inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

// node_modules/d3-array/src/max.js
function max(values, valueof) {
  let max2;
  if (valueof === void 0) {
    for (const value of values) {
      if (value != null && (max2 < value || max2 === void 0 && value >= value)) {
        max2 = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null && (max2 < value || max2 === void 0 && value >= value)) {
        max2 = value;
      }
    }
  }
  return max2;
}

// node_modules/d3-array/src/min.js
function min(values, valueof) {
  let min2;
  if (valueof === void 0) {
    for (const value of values) {
      if (value != null && (min2 > value || min2 === void 0 && value >= value)) {
        min2 = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null && (min2 > value || min2 === void 0 && value >= value)) {
        min2 = value;
      }
    }
  }
  return min2;
}

// node_modules/d3-time/src/ticks.js
function ticker(year, month, week, day, hour, minute) {
  const tickIntervals = [
    [second, 1, durationSecond],
    [second, 5, 5 * durationSecond],
    [second, 15, 15 * durationSecond],
    [second, 30, 30 * durationSecond],
    [minute, 1, durationMinute],
    [minute, 5, 5 * durationMinute],
    [minute, 15, 15 * durationMinute],
    [minute, 30, 30 * durationMinute],
    [hour, 1, durationHour],
    [hour, 3, 3 * durationHour],
    [hour, 6, 6 * durationHour],
    [hour, 12, 12 * durationHour],
    [day, 1, durationDay],
    [day, 2, 2 * durationDay],
    [week, 1, durationWeek],
    [month, 1, durationMonth],
    [month, 3, 3 * durationMonth],
    [year, 1, durationYear]
  ];
  function ticks2(start, stop, count) {
    const reverse = stop < start;
    if (reverse) [start, stop] = [stop, start];
    const interval = count && typeof count.range === "function" ? count : tickInterval(start, stop, count);
    const ticks3 = interval ? interval.range(start, +stop + 1) : [];
    return reverse ? ticks3.reverse() : ticks3;
  }
  function tickInterval(start, stop, count) {
    const target = Math.abs(stop - start) / count;
    const i = bisector(([, , step2]) => step2).right(tickIntervals, target);
    if (i === tickIntervals.length) return year.every(tickStep(start / durationYear, stop / durationYear, count));
    if (i === 0) return millisecond.every(Math.max(tickStep(start, stop, count), 1));
    const [t, step] = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
    return t.every(step);
  }
  return [ticks2, tickInterval];
}
var [utcTicks, utcTickInterval] = ticker(utcYear, utcMonth, utcSunday, unixDay, utcHour, utcMinute);
var [timeTicks, timeTickInterval] = ticker(timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute);

// node_modules/d3-time-format/src/locale.js
function localDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date2 = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
    date2.setFullYear(d.y);
    return date2;
  }
  return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}
function utcDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date2 = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
    date2.setUTCFullYear(d.y);
    return date2;
  }
  return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}
function newDate(y2, m, d) {
  return { y: y2, m, d, H: 0, M: 0, S: 0, L: 0 };
}
function formatLocale(locale3) {
  var locale_dateTime = locale3.dateTime, locale_date = locale3.date, locale_time = locale3.time, locale_periods = locale3.periods, locale_weekdays = locale3.days, locale_shortWeekdays = locale3.shortDays, locale_months = locale3.months, locale_shortMonths = locale3.shortMonths;
  var periodRe = formatRe(locale_periods), periodLookup = formatLookup(locale_periods), weekdayRe = formatRe(locale_weekdays), weekdayLookup = formatLookup(locale_weekdays), shortWeekdayRe = formatRe(locale_shortWeekdays), shortWeekdayLookup = formatLookup(locale_shortWeekdays), monthRe = formatRe(locale_months), monthLookup = formatLookup(locale_months), shortMonthRe = formatRe(locale_shortMonths), shortMonthLookup = formatLookup(locale_shortMonths);
  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "f": formatMicroseconds,
    "g": formatYearISO,
    "G": formatFullYearISO,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "q": formatQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatSeconds,
    "u": formatWeekdayNumberMonday,
    "U": formatWeekNumberSunday,
    "V": formatWeekNumberISO,
    "w": formatWeekdayNumberSunday,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };
  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "f": formatUTCMicroseconds,
    "g": formatUTCYearISO,
    "G": formatUTCFullYearISO,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "q": formatUTCQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatUTCSeconds,
    "u": formatUTCWeekdayNumberMonday,
    "U": formatUTCWeekNumberSunday,
    "V": formatUTCWeekNumberISO,
    "w": formatUTCWeekdayNumberSunday,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };
  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "f": parseMicroseconds,
    "g": parseYear,
    "G": parseFullYear,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "q": parseQuarter,
    "Q": parseUnixTimestamp,
    "s": parseUnixTimestampSeconds,
    "S": parseSeconds2,
    "u": parseWeekdayNumberMonday,
    "U": parseWeekNumberSunday,
    "V": parseWeekNumberISO,
    "w": parseWeekdayNumberSunday,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  };
  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);
  function newFormat(specifier, formats2) {
    return function(date2) {
      var string = [], i = -1, j = 0, n = specifier.length, c, pad2, format2;
      if (!(date2 instanceof Date)) date2 = /* @__PURE__ */ new Date(+date2);
      while (++i < n) {
        if (specifier.charCodeAt(i) === 37) {
          string.push(specifier.slice(j, i));
          if ((pad2 = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
          else pad2 = c === "e" ? " " : "0";
          if (format2 = formats2[c]) c = format2(date2, pad2);
          string.push(c);
          j = i + 1;
        }
      }
      string.push(specifier.slice(j, i));
      return string.join("");
    };
  }
  function newParse(specifier, Z) {
    return function(string) {
      var d = newDate(1900, void 0, 1), i = parseSpecifier(d, specifier, string += "", 0), week, day;
      if (i != string.length) return null;
      if ("Q" in d) return new Date(d.Q);
      if ("s" in d) return new Date(d.s * 1e3 + ("L" in d ? d.L : 0));
      if (Z && !("Z" in d)) d.Z = 0;
      if ("p" in d) d.H = d.H % 12 + d.p * 12;
      if (d.m === void 0) d.m = "q" in d ? d.q : 0;
      if ("V" in d) {
        if (d.V < 1 || d.V > 53) return null;
        if (!("w" in d)) d.w = 1;
        if ("Z" in d) {
          week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
          week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
          week = utcDay.offset(week, (d.V - 1) * 7);
          d.y = week.getUTCFullYear();
          d.m = week.getUTCMonth();
          d.d = week.getUTCDate() + (d.w + 6) % 7;
        } else {
          week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
          week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
          week = timeDay.offset(week, (d.V - 1) * 7);
          d.y = week.getFullYear();
          d.m = week.getMonth();
          d.d = week.getDate() + (d.w + 6) % 7;
        }
      } else if ("W" in d || "U" in d) {
        if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
        day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
        d.m = 0;
        d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
      }
      if ("Z" in d) {
        d.H += d.Z / 100 | 0;
        d.M += d.Z % 100;
        return utcDate(d);
      }
      return localDate(d);
    };
  }
  function parseSpecifier(d, specifier, string, j) {
    var i = 0, n = specifier.length, m = string.length, c, parse;
    while (i < n) {
      if (j >= m) return -1;
      c = specifier.charCodeAt(i++);
      if (c === 37) {
        c = specifier.charAt(i++);
        parse = parses[c in pads ? specifier.charAt(i++) : c];
        if (!parse || (j = parse(d, string, j)) < 0) return -1;
      } else if (c != string.charCodeAt(j++)) {
        return -1;
      }
    }
    return j;
  }
  function parsePeriod(d, string, i) {
    var n = periodRe.exec(string.slice(i));
    return n ? (d.p = periodLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseShortWeekday(d, string, i) {
    var n = shortWeekdayRe.exec(string.slice(i));
    return n ? (d.w = shortWeekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseWeekday(d, string, i) {
    var n = weekdayRe.exec(string.slice(i));
    return n ? (d.w = weekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseShortMonth(d, string, i) {
    var n = shortMonthRe.exec(string.slice(i));
    return n ? (d.m = shortMonthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseMonth(d, string, i) {
    var n = monthRe.exec(string.slice(i));
    return n ? (d.m = monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseLocaleDateTime(d, string, i) {
    return parseSpecifier(d, locale_dateTime, string, i);
  }
  function parseLocaleDate(d, string, i) {
    return parseSpecifier(d, locale_date, string, i);
  }
  function parseLocaleTime(d, string, i) {
    return parseSpecifier(d, locale_time, string, i);
  }
  function formatShortWeekday(d) {
    return locale_shortWeekdays[d.getDay()];
  }
  function formatWeekday(d) {
    return locale_weekdays[d.getDay()];
  }
  function formatShortMonth(d) {
    return locale_shortMonths[d.getMonth()];
  }
  function formatMonth(d) {
    return locale_months[d.getMonth()];
  }
  function formatPeriod(d) {
    return locale_periods[+(d.getHours() >= 12)];
  }
  function formatQuarter(d) {
    return 1 + ~~(d.getMonth() / 3);
  }
  function formatUTCShortWeekday(d) {
    return locale_shortWeekdays[d.getUTCDay()];
  }
  function formatUTCWeekday(d) {
    return locale_weekdays[d.getUTCDay()];
  }
  function formatUTCShortMonth(d) {
    return locale_shortMonths[d.getUTCMonth()];
  }
  function formatUTCMonth(d) {
    return locale_months[d.getUTCMonth()];
  }
  function formatUTCPeriod(d) {
    return locale_periods[+(d.getUTCHours() >= 12)];
  }
  function formatUTCQuarter(d) {
    return 1 + ~~(d.getUTCMonth() / 3);
  }
  return {
    format: function(specifier) {
      var f = newFormat(specifier += "", formats);
      f.toString = function() {
        return specifier;
      };
      return f;
    },
    parse: function(specifier) {
      var p = newParse(specifier += "", false);
      p.toString = function() {
        return specifier;
      };
      return p;
    },
    utcFormat: function(specifier) {
      var f = newFormat(specifier += "", utcFormats);
      f.toString = function() {
        return specifier;
      };
      return f;
    },
    utcParse: function(specifier) {
      var p = newParse(specifier += "", true);
      p.toString = function() {
        return specifier;
      };
      return p;
    }
  };
}
var pads = { "-": "", "_": " ", "0": "0" };
var numberRe = /^\s*\d+/;
var percentRe = /^%/;
var requoteRe = /[\\^$*+?|[\]().{}]/g;
function pad(value, fill, width) {
  var sign2 = value < 0 ? "-" : "", string = (sign2 ? -value : value) + "", length = string.length;
  return sign2 + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}
function requote(s) {
  return s.replace(requoteRe, "\\$&");
}
function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}
function formatLookup(names) {
  return new Map(names.map((name, i) => [name.toLowerCase(), i]));
}
function parseWeekdayNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.w = +n[0], i + n[0].length) : -1;
}
function parseWeekdayNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.u = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.U = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberISO(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.V = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.W = +n[0], i + n[0].length) : -1;
}
function parseFullYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 4));
  return n ? (d.y = +n[0], i + n[0].length) : -1;
}
function parseYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2e3), i + n[0].length) : -1;
}
function parseZone(d, string, i) {
  var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
  return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}
function parseQuarter(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
}
function parseMonthNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}
function parseDayOfMonth(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.d = +n[0], i + n[0].length) : -1;
}
function parseDayOfYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}
function parseHour24(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.H = +n[0], i + n[0].length) : -1;
}
function parseMinutes(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.M = +n[0], i + n[0].length) : -1;
}
function parseSeconds2(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.S = +n[0], i + n[0].length) : -1;
}
function parseMilliseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.L = +n[0], i + n[0].length) : -1;
}
function parseMicroseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 6));
  return n ? (d.L = Math.floor(n[0] / 1e3), i + n[0].length) : -1;
}
function parseLiteralPercent(d, string, i) {
  var n = percentRe.exec(string.slice(i, i + 1));
  return n ? i + n[0].length : -1;
}
function parseUnixTimestamp(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.Q = +n[0], i + n[0].length) : -1;
}
function parseUnixTimestampSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.s = +n[0], i + n[0].length) : -1;
}
function formatDayOfMonth(d, p) {
  return pad(d.getDate(), p, 2);
}
function formatHour24(d, p) {
  return pad(d.getHours(), p, 2);
}
function formatHour12(d, p) {
  return pad(d.getHours() % 12 || 12, p, 2);
}
function formatDayOfYear(d, p) {
  return pad(1 + timeDay.count(timeYear(d), d), p, 3);
}
function formatMilliseconds(d, p) {
  return pad(d.getMilliseconds(), p, 3);
}
function formatMicroseconds(d, p) {
  return formatMilliseconds(d, p) + "000";
}
function formatMonthNumber(d, p) {
  return pad(d.getMonth() + 1, p, 2);
}
function formatMinutes(d, p) {
  return pad(d.getMinutes(), p, 2);
}
function formatSeconds(d, p) {
  return pad(d.getSeconds(), p, 2);
}
function formatWeekdayNumberMonday(d) {
  var day = d.getDay();
  return day === 0 ? 7 : day;
}
function formatWeekNumberSunday(d, p) {
  return pad(timeSunday.count(timeYear(d) - 1, d), p, 2);
}
function dISO(d) {
  var day = d.getDay();
  return day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
}
function formatWeekNumberISO(d, p) {
  d = dISO(d);
  return pad(timeThursday.count(timeYear(d), d) + (timeYear(d).getDay() === 4), p, 2);
}
function formatWeekdayNumberSunday(d) {
  return d.getDay();
}
function formatWeekNumberMonday(d, p) {
  return pad(timeMonday.count(timeYear(d) - 1, d), p, 2);
}
function formatYear(d, p) {
  return pad(d.getFullYear() % 100, p, 2);
}
function formatYearISO(d, p) {
  d = dISO(d);
  return pad(d.getFullYear() % 100, p, 2);
}
function formatFullYear(d, p) {
  return pad(d.getFullYear() % 1e4, p, 4);
}
function formatFullYearISO(d, p) {
  var day = d.getDay();
  d = day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
  return pad(d.getFullYear() % 1e4, p, 4);
}
function formatZone(d) {
  var z = d.getTimezoneOffset();
  return (z > 0 ? "-" : (z *= -1, "+")) + pad(z / 60 | 0, "0", 2) + pad(z % 60, "0", 2);
}
function formatUTCDayOfMonth(d, p) {
  return pad(d.getUTCDate(), p, 2);
}
function formatUTCHour24(d, p) {
  return pad(d.getUTCHours(), p, 2);
}
function formatUTCHour12(d, p) {
  return pad(d.getUTCHours() % 12 || 12, p, 2);
}
function formatUTCDayOfYear(d, p) {
  return pad(1 + utcDay.count(utcYear(d), d), p, 3);
}
function formatUTCMilliseconds(d, p) {
  return pad(d.getUTCMilliseconds(), p, 3);
}
function formatUTCMicroseconds(d, p) {
  return formatUTCMilliseconds(d, p) + "000";
}
function formatUTCMonthNumber(d, p) {
  return pad(d.getUTCMonth() + 1, p, 2);
}
function formatUTCMinutes(d, p) {
  return pad(d.getUTCMinutes(), p, 2);
}
function formatUTCSeconds(d, p) {
  return pad(d.getUTCSeconds(), p, 2);
}
function formatUTCWeekdayNumberMonday(d) {
  var dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}
function formatUTCWeekNumberSunday(d, p) {
  return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
}
function UTCdISO(d) {
  var day = d.getUTCDay();
  return day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
}
function formatUTCWeekNumberISO(d, p) {
  d = UTCdISO(d);
  return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
}
function formatUTCWeekdayNumberSunday(d) {
  return d.getUTCDay();
}
function formatUTCWeekNumberMonday(d, p) {
  return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
}
function formatUTCYear(d, p) {
  return pad(d.getUTCFullYear() % 100, p, 2);
}
function formatUTCYearISO(d, p) {
  d = UTCdISO(d);
  return pad(d.getUTCFullYear() % 100, p, 2);
}
function formatUTCFullYear(d, p) {
  return pad(d.getUTCFullYear() % 1e4, p, 4);
}
function formatUTCFullYearISO(d, p) {
  var day = d.getUTCDay();
  d = day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
  return pad(d.getUTCFullYear() % 1e4, p, 4);
}
function formatUTCZone() {
  return "+0000";
}
function formatLiteralPercent() {
  return "%";
}
function formatUnixTimestamp(d) {
  return +d;
}
function formatUnixTimestampSeconds(d) {
  return Math.floor(+d / 1e3);
}

// node_modules/d3-time-format/src/defaultLocale.js
var locale;
var timeFormat;
var timeParse;
var utcFormat;
var utcParse;
defaultLocale({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});
function defaultLocale(definition) {
  locale = formatLocale(definition);
  timeFormat = locale.format;
  timeParse = locale.parse;
  utcFormat = locale.utcFormat;
  utcParse = locale.utcParse;
  return locale;
}

// src/utils/dates.ts
var MS_PER_DAY = 864e5;
var MS_PER_WEEK = 7 * MS_PER_DAY;
var shortFmt = utcFormat("%b %Y");
var longFmt = utcFormat("%b %-d, %Y");
var isoFmt = utcFormat("%Y-%m-%d");
function formatDate(time, format2) {
  const date2 = new Date(time);
  switch (format2) {
    case "short":
      return shortFmt(date2);
    case "long":
      return longFmt(date2);
    case "iso":
      return isoFmt(date2);
  }
}
function isoDate(time) {
  return isoFmt(new Date(time));
}
function weekStepsBetween(fromTime, toTime) {
  return Math.round((toTime - fromTime) / MS_PER_WEEK);
}
function utcWeekStart(time) {
  const days = Math.floor(time / MS_PER_DAY);
  const weekday = ((days + 4) % 7 + 7) % 7;
  return (days - weekday) * MS_PER_DAY;
}

// src/history/normalize.ts
var HistoryError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "HistoryError";
  }
};
function normalizeHistory(raw, options) {
  const warn = options.warn ?? (() => void 0);
  const validated = raw.map((week) => validateWeek(week, options.asOf));
  validated.sort((a, b) => a.time - b.time);
  const deduped = [];
  for (const week of validated) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.time === week.time) {
      if (previous.total !== week.total || !sameDays(previous.days, week.days)) {
        throw new HistoryError(
          `Conflicting duplicate week at ${week.timestamp}.`
        );
      }
      continue;
    }
    deduped.push(week);
  }
  if (deduped.length === 0) {
    return {
      weeks: [],
      cumulative: [],
      hasSyntheticWeeks: false,
      totalAdded: 0
    };
  }
  const filled = [];
  let hasSynthetic = false;
  const anchor = deduped[0];
  if (!anchor) {
    throw new HistoryError("Unexpected empty history after validation.");
  }
  for (let i = 0; i < deduped.length; i += 1) {
    const current = deduped[i];
    if (!current) {
      continue;
    }
    if (i > 0) {
      const previous = deduped[i - 1];
      if (previous) {
        const steps = weekStepsBetween(previous.time, current.time);
        if (steps <= 0) {
          throw new HistoryError(
            `Non-increasing week timestamps near ${current.timestamp}.`
          );
        }
        for (let gap = 1; gap < steps; gap += 1) {
          hasSynthetic = true;
          const syntheticTime = previous.time + gap * MS_PER_WEEK;
          filled.push({
            timestamp: new Date(syntheticTime).toISOString(),
            time: syntheticTime,
            added: 0,
            synthetic: true
          });
        }
      }
    }
    filled.push({
      timestamp: current.timestamp,
      time: current.time,
      added: current.total,
      synthetic: false
    });
  }
  if (hasSynthetic) {
    warn(
      "Star history has internal coverage gaps; missing weeks were filled with zero additions."
    );
  }
  const cumulative = [];
  let running = 0;
  for (const week of filled) {
    running += week.added;
    cumulative.push(running);
  }
  return {
    weeks: filled,
    cumulative,
    hasSyntheticWeeks: hasSynthetic,
    totalAdded: running
  };
}
function validateWeek(week, asOf) {
  const time = Date.parse(week.timestamp);
  if (!Number.isFinite(time)) {
    throw new HistoryError(`Invalid week timestamp: ${week.timestamp}`);
  }
  if (time > asOf + MS_PER_WEEK) {
    throw new HistoryError(
      `Week timestamp ${week.timestamp} is in the future.`
    );
  }
  if (!Number.isSafeInteger(week.total) || week.total < 0) {
    throw new HistoryError(
      `Invalid weekly total at ${week.timestamp}: ${String(week.total)}`
    );
  }
  if (week.days.length !== 7) {
    throw new HistoryError(
      `Week ${week.timestamp} must have exactly 7 daily values.`
    );
  }
  let daySum = 0;
  for (const day of week.days) {
    if (!Number.isSafeInteger(day) || day < 0) {
      throw new HistoryError(
        `Invalid daily value at ${week.timestamp}: ${String(day)}`
      );
    }
    daySum += day;
  }
  if (daySum !== week.total) {
    throw new HistoryError(
      `Week ${week.timestamp} daily sum (${daySum}) != total (${week.total}).`
    );
  }
  return {
    timestamp: week.timestamp,
    time,
    total: week.total,
    days: week.days
  };
}
function sameDays(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

// src/history/window.ts
function selectWindow(history, config) {
  const total = history.weeks.length;
  if (total === 0) {
    return {
      weeks: [],
      cumulative: [],
      baseline: 0,
      windowAdded: 0,
      hasSyntheticWeeks: history.hasSyntheticWeeks
    };
  }
  const count = Math.min(config.weeks, total);
  const startIndex = total - count;
  const baseline = startIndex > 0 ? history.cumulative[startIndex - 1] ?? 0 : 0;
  const weeks = history.weeks.slice(startIndex);
  const cumulative = history.cumulative.slice(startIndex);
  const windowAdded = weeks.reduce((sum, week) => sum + week.added, 0);
  return {
    weeks,
    cumulative,
    baseline,
    windowAdded,
    hasSyntheticWeeks: history.hasSyntheticWeeks
  };
}

// src/history/bucket.ts
function bucketWindow(window, columns, baseline) {
  if (columns < 1) {
    throw new Error("columns must be >= 1");
  }
  const weeks = window.weeks;
  const cumulative = window.cumulative;
  const n = weeks.length;
  if (n === 0) {
    return emptyBuckets(columns, baseline);
  }
  const buckets = [];
  let previousCumulative = baseline;
  const boundaryTime = (position) => {
    const index = Math.min(Math.floor(position), n - 1);
    const anchor = weeks[index];
    if (!anchor) throw new Error(`Missing weekly boundary at index ${index}.`);
    const start = anchor.time;
    const end = weeks[index + 1]?.time ?? start + MS_PER_WEEK;
    return Math.round(start + (end - start) * (position - index));
  };
  for (let j = 0; j < columns; j += 1) {
    const start = Math.floor(j * n / columns);
    const end = Math.floor((j + 1) * n / columns);
    const startTime = boundaryTime(j * n / columns);
    const endTime = boundaryTime((j + 1) * n / columns);
    if (end <= start) {
      buckets.push({
        startTime,
        endTime,
        observations: 0,
        added: 0,
        cumulative: previousCumulative
      });
      continue;
    }
    let added = 0;
    for (let i = start; i < end; i += 1) {
      const week = weeks[i];
      if (week) {
        added += week.added;
      }
    }
    const endCumulative = cumulative[end - 1] ?? previousCumulative;
    buckets.push({
      startTime,
      endTime,
      observations: end - start,
      added,
      cumulative: endCumulative
    });
    previousCumulative = endCumulative;
  }
  return buckets;
}
function emptyBuckets(columns, baseline) {
  const buckets = [];
  for (let j = 0; j < columns; j += 1) {
    buckets.push({
      startTime: 0,
      endTime: 0,
      observations: 0,
      added: 0,
      cumulative: baseline
    });
  }
  return buckets;
}

// src/history/model.ts
var PERIOD_LABELS = {
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year",
  "2y": "2 years",
  "5y": "5 years",
  all: "all time"
};
function buildChartModel(rawConfig, metadata, history, options) {
  const config = normalizeChartConfig(rawConfig);
  const window = selectWindow(history, config);
  const buckets = bucketWindow(window, config.columns, window.baseline);
  const windowMax = buckets.reduce(
    (max2, bucket) => Math.max(max2, bucket.cumulative),
    window.baseline
  );
  const firstWeek = window.weeks[0];
  const lastWeek = window.weeks[window.weeks.length - 1];
  const periodStart = firstWeek ? isoDate(firstWeek.time) : isoDate(Date.parse(metadata.createdAt));
  const periodEnd = lastWeek ? isoDate(lastWeek.time) : isoDate(options.asOf);
  const periodLabel = config.period ? PERIOD_LABELS[config.period] : `${config.weeks} weeks`;
  const isEmpty = history.totalAdded === 0;
  const peakGain = window.weeks.reduce(
    (max2, week) => Math.max(max2, week.added),
    0
  );
  return {
    config,
    metadata,
    buckets,
    selectedWeeks: window.weeks,
    baseline: window.baseline,
    windowMax,
    windowAdded: window.windowAdded,
    peakGain,
    currentStars: metadata.stargazersCount,
    periodStart,
    periodEnd,
    periodLabel,
    hasSyntheticWeeks: window.hasSyntheticWeeks,
    isEmpty
  };
}

// src/history/aggregate.ts
function aggregateHistories(histories) {
  if (histories.length === 0) {
    return {
      weeks: [],
      cumulative: [],
      hasSyntheticWeeks: false,
      totalAdded: 0
    };
  }
  const single = histories[0];
  if (histories.length === 1 && single) {
    return single;
  }
  const slots = /* @__PURE__ */ new Map();
  let hasSynthetic = false;
  for (const history of histories) {
    if (history.hasSyntheticWeeks) {
      hasSynthetic = true;
    }
    for (const week of history.weeks) {
      const key = utcWeekStart(week.time);
      const existing = slots.get(key);
      if (!existing) {
        slots.set(key, {
          key,
          time: week.time,
          timestamp: week.timestamp,
          added: week.added,
          synthetic: week.synthetic
        });
        continue;
      }
      existing.added += week.added;
      existing.synthetic = existing.synthetic && week.synthetic;
      if (week.time < existing.time || week.time === existing.time && week.timestamp < existing.timestamp) {
        existing.time = week.time;
        existing.timestamp = week.timestamp;
      }
    }
  }
  const ordered = [...slots.values()].sort((a, b) => a.key - b.key);
  const weeks = [];
  let previousKey = null;
  for (const slot of ordered) {
    if (previousKey !== null) {
      for (let gap = previousKey + MS_PER_WEEK; gap < slot.key; gap += MS_PER_WEEK) {
        hasSynthetic = true;
        weeks.push({
          timestamp: new Date(gap).toISOString(),
          time: gap,
          added: 0,
          synthetic: true
        });
      }
    }
    if (slot.synthetic) {
      hasSynthetic = true;
    }
    weeks.push({
      timestamp: slot.timestamp,
      time: slot.time,
      added: slot.added,
      synthetic: slot.synthetic
    });
    previousKey = slot.key;
  }
  const cumulative = [];
  let running = 0;
  for (const week of weeks) {
    running += week.added;
    cumulative.push(running);
  }
  return {
    weeks,
    cumulative,
    hasSyntheticWeeks: hasSynthetic,
    totalAdded: running
  };
}
function aggregateMetadata(entries) {
  const first = entries[0];
  if (!first) {
    throw new Error("At least one repository is required to aggregate.");
  }
  if (entries.length === 1) {
    return first;
  }
  let stargazersCount = 0;
  let createdAt = first.createdAt;
  let createdAtTime = Date.parse(first.createdAt);
  for (const entry of entries) {
    stargazersCount += entry.stargazersCount;
    const time = Date.parse(entry.createdAt);
    if (Number.isFinite(time) && (!Number.isFinite(createdAtTime) || time < createdAtTime)) {
      createdAtTime = time;
      createdAt = entry.createdAt;
    }
  }
  return {
    owner: first.owner,
    repo: first.repo,
    fullName: aggregateDisplayName(entries),
    createdAt,
    stargazersCount
  };
}
function aggregateDisplayName(entries) {
  const first = entries[0];
  if (!first) {
    return "";
  }
  if (entries.length === 1) {
    return first.fullName;
  }
  if (entries.length === 2) {
    const second2 = entries[1];
    return `${first.fullName} + ${second2 ? second2.fullName : ""}`;
  }
  return `${first.fullName} + ${entries.length - 1} more repositories`;
}

// src/history/multi.ts
function buildMultiRepositoryChartModel(config, sources, options) {
  const metadata = aggregateMetadata(sources.map((source) => source.metadata));
  const history = aggregateHistories(sources.map((source) => source.history));
  const model = buildChartModel(config, metadata, history, options);
  const series = sources.map((source) => {
    if (sources.length === 1) return repositorySeries(model);
    const byWeek = /* @__PURE__ */ new Map();
    for (const week of source.history.weeks) {
      const key = utcWeekStart(week.time);
      const previous = byWeek.get(key);
      byWeek.set(key, {
        added: (previous?.added ?? 0) + week.added,
        synthetic: previous ? previous.synthetic && week.synthetic : week.synthetic
      });
    }
    const keys = [...byWeek.keys()];
    const first = Math.min(...keys);
    const last = Math.max(...keys);
    let running = 0;
    const cumulative = [];
    const weeks = history.weeks.map((slot) => {
      const key = utcWeekStart(slot.time);
      const observation = byWeek.get(key);
      const added = observation?.added ?? 0;
      running += added;
      cumulative.push(running);
      return {
        time: slot.time,
        timestamp: slot.timestamp,
        added,
        synthetic: observation?.synthetic ?? (key > first && key < last && key >= utcWeekStart(Date.parse(source.metadata.createdAt)))
      };
    });
    const aligned = buildChartModel(
      model.config,
      source.metadata,
      {
        weeks,
        cumulative,
        totalAdded: running,
        hasSyntheticWeeks: source.history.hasSyntheticWeeks || weeks.some((w) => w.synthetic)
      },
      options
    );
    return repositorySeries(aligned);
  });
  return { ...model, series };
}
function repositorySeries(model) {
  return {
    metadata: model.metadata,
    buckets: model.buckets,
    selectedWeeks: model.selectedWeeks,
    baseline: model.baseline,
    windowMax: model.windowMax,
    hasSyntheticWeeks: model.hasSyntheticWeeks
  };
}

// src/utils/numbers.ts
function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot round non-finite value: ${String(value)}`);
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function coord(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite geometry value: ${String(value)}`);
  }
  const rounded = round(value, 3);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return String(normalized);
}
function compactNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const abs = Math.abs(value);
  if (abs < 1e3) {
    return String(Math.round(value));
  }
  if (abs < 1e6) {
    return `${trimUnit(value / 1e3)}k`;
  }
  if (abs < 1e9) {
    return `${trimUnit(value / 1e6)}M`;
  }
  return `${trimUnit(value / 1e9)}B`;
}
function trimUnit(value) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
function withCommas(value) {
  const rounded = Math.round(value);
  return rounded.toLocaleString("en-US");
}

// src/utils/svg.ts
var INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
function stripControls(value) {
  return value.replace(INVALID_XML_CHARS, "");
}
function escapeText(value) {
  return stripControls(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(value) {
  return stripControls(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function idFactory(prefix) {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  return (name) => `${safePrefix}-${name.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

// src/renderers/animation.ts
var EASINGS = {
  linear: (f) => f,
  "ease-in": (f) => f * f,
  "ease-out": (f) => 1 - (1 - f) * (1 - f),
  "ease-in-out": (f) => f * f * (3 - 2 * f)
};
function inverseEasing(easing, y2) {
  const clamped = Math.min(1, Math.max(0, y2));
  if (clamped === 0 || clamped === 1) return clamped;
  switch (easing) {
    case "linear":
      return clamped;
    case "ease-in":
      return Math.sqrt(clamped);
    case "ease-out":
      return 1 - Math.sqrt(1 - clamped);
    case "ease-in-out": {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        if (EASINGS["ease-in-out"](mid) < clamped) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return (lo + hi) / 2;
    }
  }
}
function resolveTimeline(anim) {
  const build = anim.durationSeconds;
  const local = anim.direction === "simultaneous" ? build : Math.max(0.35, build * 0.15);
  const cycle = anim.mode === "loop" ? build + anim.pauseSeconds : build;
  return {
    cycleSeconds: cycle,
    buildSeconds: build,
    localSeconds: Math.min(local, build),
    iteration: anim.mode === "loop" ? "infinite" : "1",
    delaySeconds: anim.delaySeconds,
    enabled: anim.mode !== "none"
  };
}
function columnWindow(index, columns, anim, timeline) {
  if (anim.direction === "simultaneous" || columns <= 1) {
    return {
      startFrac: 0,
      endFrac: timeline.buildSeconds / timeline.cycleSeconds
    };
  }
  const local = Math.max(
    timeline.localSeconds,
    timeline.buildSeconds / (1 + (columns - 1) * 0.75)
  );
  const span = timeline.buildSeconds - local;
  const frac = index / (columns - 1);
  const start = frac * span;
  const end = start + local;
  return {
    startFrac: start / timeline.cycleSeconds,
    endFrac: end / timeline.cycleSeconds
  };
}
function progressKeyframes(name, property, from, to, window) {
  return `@keyframes ${name}{0%{${property}:${from};}` + (window.startFrac > 0 ? `${keyframePercent(window.startFrac)}%{${property}:${from};}` : "") + `${keyframePercent(window.endFrac)}%{${property}:${to};}` + (window.endFrac < 1 ? `100%{${property}:${to};}` : "") + "}";
}
function keyframePercent(fraction) {
  return Math.floor(fraction * 1e8) / 1e6;
}
function columnSchedule(params) {
  const { style, easing, height, window } = params;
  const startPct = keyframePercent(window.startFrac);
  const endPct = keyframePercent(window.endFrac);
  const steps = [{ pct: 0, exposed: 0 }];
  if (startPct > 0) {
    steps.push({ pct: startPct, exposed: 0 });
  }
  if (height <= 0) {
    steps.push({ pct: 100, exposed: 0 });
    return steps;
  }
  if (style === "reveal") {
    steps.push({ pct: endPct, exposed: height });
    steps.push({ pct: 100, exposed: height });
    return dedupe(steps);
  }
  if (style === "cascade") {
    const span2 = Math.max(1e-4, endPct - startPct);
    for (let k = 1; k <= height; k += 1) {
      const local = inverseEasing(easing, k / params.rows);
      const pct = keyframePercent((startPct + local * span2) / 100);
      steps.push({ pct, exposed: k });
    }
    steps.push({ pct: 100, exposed: height });
    return dedupe(steps);
  }
  const span = Math.max(1e-4, endPct - startPct);
  for (let k = 1; k <= height; k += 1) {
    const t = inverseEasing(easing, k / height);
    const pct = keyframePercent((startPct + t * span) / 100);
    steps.push({ pct, exposed: k });
  }
  steps.push({ pct: 100, exposed: height });
  return dedupe(steps);
}
function dedupe(steps) {
  const out = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (last && last.pct === step.pct) {
      out[out.length - 1] = step;
      continue;
    }
    if (last && last.exposed === step.exposed && step.pct !== 100) {
      continue;
    }
    out.push(step);
  }
  return out;
}
function keyframesForColumn(name, steps, rows, pitch) {
  const frames = steps.map((step) => {
    const ty = (rows - step.exposed) * pitch;
    return `${step.pct}%{transform:translateY(${ty}px);animation-timing-function:steps(1,end);}`;
  }).join("");
  return `@keyframes ${name}{${frames}}`;
}

// src/renderers/freeze.ts
var currentFreeze = null;
function freezeProgress() {
  return currentFreeze;
}
function isFrozen() {
  return currentFreeze !== null;
}
function withFreeze(cycleFraction, fn) {
  const previous = currentFreeze;
  currentFreeze = clamp01(cycleFraction);
  try {
    return fn();
  } finally {
    currentFreeze = previous;
  }
}
function buildFraction(timeline) {
  if (timeline.cycleSeconds <= 0) {
    return 1;
  }
  return timeline.buildSeconds / timeline.cycleSeconds;
}
function wipeScaleAt(anim, timeline, pointCount, cycleFraction) {
  const bf = buildFraction(timeline);
  if (bf <= 0) {
    return 1;
  }
  const local = clamp01(cycleFraction / bf);
  const simultaneous = anim.direction === "simultaneous";
  if (anim.style === "cascade") {
    const count = Math.max(1, pointCount);
    let scale = 0;
    for (let i = 0; i <= count; i += 1) {
      if (inverseEasing(anim.easing, i / count) <= local) {
        scale = i / count;
      }
    }
    return scale;
  }
  if (simultaneous && anim.style === "reveal") {
    return local >= 1 ? 1 : 0;
  }
  return EASINGS[anim.easing](local);
}
function strokeDrawFractionAt(anim, timeline, cycleFraction) {
  const bf = buildFraction(timeline);
  if (bf <= 0) {
    return 1;
  }
  return EASINGS[anim.easing](clamp01(cycleFraction / bf));
}
function barGrowScaleAt(anim, window, cycleFraction) {
  const span = window.endFrac - window.startFrac;
  if (span <= 0) {
    return cycleFraction >= window.endFrac ? 1 : 0;
  }
  const local = clamp01((cycleFraction - window.startFrac) / span);
  return EASINGS[anim.easing](local);
}
function totalRevealOpacityAt(timeline, cycleFraction) {
  const endFrac = buildFraction(timeline);
  const startFrac = endFrac * 0.9;
  const span = endFrac - startFrac;
  if (span <= 0) {
    return cycleFraction >= endFrac ? 1 : 0;
  }
  return clamp01((cycleFraction - startFrac) / span);
}
function svgPathLength(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) {
    return 0;
  }
  let i = 0;
  let command = "";
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let length = 0;
  const next = () => Number(tokens[i++] ?? "0");
  while (i < tokens.length) {
    const token = tokens[i] ?? "";
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      i += 1;
    }
    switch (command) {
      case "M": {
        cx = next();
        cy = next();
        startX = cx;
        startY = cy;
        command = "L";
        break;
      }
      case "L": {
        const x2 = next();
        const y2 = next();
        length += Math.hypot(x2 - cx, y2 - cy);
        cx = x2;
        cy = y2;
        break;
      }
      case "H": {
        const x2 = next();
        length += Math.abs(x2 - cx);
        cx = x2;
        break;
      }
      case "V": {
        const y2 = next();
        length += Math.abs(y2 - cy);
        cy = y2;
        break;
      }
      case "C": {
        const x1 = next();
        const y1 = next();
        const x2 = next();
        const y2 = next();
        const x3 = next();
        const y3 = next();
        length += cubicLength(cx, cy, x1, y1, x2, y2, x3, y3);
        cx = x3;
        cy = y3;
        break;
      }
      case "Z":
      case "z": {
        length += Math.hypot(startX - cx, startY - cy);
        cx = startX;
        cy = startY;
        break;
      }
      default: {
        i += 1;
      }
    }
  }
  return length;
}
function cubicLength(x0, y0, x1, y1, x2, y2, x3, y3) {
  const steps = 24;
  let length = 0;
  let px = x0;
  let py = y0;
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const dd = t * t * t;
    const x4 = a * x0 + b * x1 + c * x2 + dd * x3;
    const y4 = a * y0 + b * y1 + c * y2 + dd * y3;
    length += Math.hypot(x4 - px, y4 - py);
    px = x4;
    py = y4;
  }
  return length;
}
function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

// src/renderers/shared.ts
var RenderError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RenderError";
  }
};
var CSS_VARS = {
  empty: "--sc-empty",
  l1: "--sc-l1",
  l2: "--sc-l2",
  l3: "--sc-l3",
  l4: "--sc-l4",
  text: "--sc-text",
  muted: "--sc-muted",
  border: "--sc-border",
  accent: "--sc-accent",
  stroke: "--sc-stroke",
  fill: "--sc-fill",
  axis: "--sc-axis"
};
function baseCss(fontFamily) {
  return [
    `.sc-root{font-family:${fontFamily};}`,
    `.sc-t{fill:var(${CSS_VARS.text});}`,
    `.sc-m{fill:var(${CSS_VARS.muted});}`,
    `.sc-a{fill:var(${CSS_VARS.accent});}`,
    `.sc-empty{fill:var(${CSS_VARS.empty});}`,
    `.sc-l1{fill:var(${CSS_VARS.l1});}`,
    `.sc-l2{fill:var(${CSS_VARS.l2});}`,
    `.sc-l3{fill:var(${CSS_VARS.l3});}`,
    `.sc-l4{fill:var(${CSS_VARS.l4});}`,
    `.sc-stroke{fill:none;stroke:var(${CSS_VARS.stroke});}`,
    `.sc-area{fill:var(${CSS_VARS.fill});}`,
    `.sc-bar{fill:var(${CSS_VARS.stroke});}`,
    `.sc-axis{stroke:var(${CSS_VARS.axis});}`,
    `.sc-dot{fill:var(${CSS_VARS.stroke});}`
  ].join("");
}
function axisScale(model) {
  return model.config.axisFontSize / DEFAULT_AXIS_FONT_SIZE;
}
function datesHeight(model) {
  return model.config.showXAxis && model.config.showDates ? Math.round(24 * axisScale(model)) : 8;
}
function axisGutter(model) {
  return model.config.showYAxis ? Math.round(40 * axisScale(model)) : 0;
}
function legendEntries(model) {
  const name = configRepositories(model.config).length > 1 ? "Combined recorded stars" : "Recorded stars";
  const style = model.config.style;
  if (style === "clustered-bar") {
    const id = makeId(model);
    return (model.series?.length ? model.series.map((s) => s.metadata) : [model.metadata]).map((metadata, i) => ({
      label: metadata.fullName,
      className: id(`series-${i}`)
    }));
  }
  if (style === "contributions")
    return [
      { label: name, className: "sc-l4" },
      { label: "Column tip", className: "sc-l4" },
      { label: "1 below tip", className: "sc-l3" },
      { label: "2 below tip", className: "sc-l2" },
      { label: "Below tip (3+)", className: "sc-l1" },
      { label: "Unoccupied", className: "sc-empty" }
    ];
  if (style === "grid") {
    const min2 = model.config.scale === "visible" ? model.baseline : 0;
    const max2 = Math.max(min2 + 1, model.windowMax);
    const boundary = (i) => String(min2 + (max2 - min2) * i / 4);
    return [
      { label: name, className: "sc-l4" },
      ...Array.from({ length: 4 }, (_, i) => ({
        label: `(${boundary(i)}, ${boundary(i + 1)}]`,
        className: `sc-l${i + 1}`
      })),
      { label: "Unoccupied", className: "sc-empty" }
    ];
  }
  return [
    {
      label: name,
      className: ["line", "area", "sparkline"].includes(style) ? "sc-stroke" : style === "bar" ? "sc-bar" : "sc-l4"
    }
  ];
}
function legendLayout(model) {
  if (!model.config.showLegend) return { height: 0, entries: [] };
  const size = model.config.axisFontSize;
  const available = model.config.width - 32;
  const swatch = size;
  const gap = size * 0.6;
  const rowHeight = size * 1.8;
  let x2 = 0;
  let row = 0;
  const entries = legendEntries(model).map((entry) => {
    const maxChars = Math.max(
      1,
      Math.floor((available - swatch - gap) / (size * 0.62))
    );
    const chars = Array.from(entry.label);
    const label = chars.length > maxChars ? chars.slice(0, maxChars - 1).join("") + "\u2026" : entry.label;
    const textWidth = Array.from(label).length * size * 0.62;
    const width = swatch + gap + textWidth;
    if (x2 > 0 && x2 + width > available) {
      row += 1;
      x2 = 0;
    }
    const placed = {
      ...entry,
      label,
      title: entry.label,
      x: 16 + x2,
      y: row * rowHeight,
      textWidth
    };
    x2 += width + size * 1.6;
    return placed;
  });
  return { height: (row + 1) * rowHeight + size * 0.8, entries };
}
function legendHeight(model) {
  return legendLayout(model).height;
}
function renderLegend(model) {
  const { entries } = legendLayout(model);
  if (!entries.length) return "";
  const size = model.config.axisFontSize;
  const top = 12 + headerHeight(model) + size;
  return `<g class="sc-legend">${entries.map(
    (entry) => `<g><title>${escapeText(entry.title)}</title>` + (entry.className === "sc-stroke" ? `<line class="sc-stroke" x1="${entry.x}" x2="${entry.x + size}" y1="${top + entry.y - size * 0.3}" y2="${top + entry.y - size * 0.3}" stroke-width="2"/>` : `<rect class="${entry.className}" x="${entry.x}" y="${top + entry.y - size * 0.8}" width="${size}" height="${size}"/>`) + `<text class="sc-m" x="${entry.x + size * 1.6}" y="${top + entry.y}" font-size="${size}" textLength="${entry.textWidth}" lengthAdjust="spacingAndGlyphs">${escapeText(entry.label)}</text></g>`
  ).join("")}</g>`;
}
function themeVarValues(theme, model) {
  const palette = applyOverrides(
    basePalette(theme),
    model.config.paletteOverrides
  );
  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  return {
    [CSS_VARS.empty]: palette.empty,
    [CSS_VARS.l1]: palette.level1,
    [CSS_VARS.l2]: palette.level2,
    [CSS_VARS.l3]: palette.level3,
    [CSS_VARS.l4]: palette.level4,
    [CSS_VARS.text]: colors.text,
    [CSS_VARS.muted]: colors.muted,
    [CSS_VARS.border]: colors.border,
    [CSS_VARS.accent]: colors.accent,
    [CSS_VARS.stroke]: colors.stroke,
    [CSS_VARS.fill]: colors.fill,
    [CSS_VARS.axis]: colors.axis
  };
}
function varsBlock(values) {
  return Object.entries(values).map(([name, value]) => `${name}:${value};`).join("");
}
function buildThemeCss(model) {
  const theme = model.config.theme;
  if (theme === "light" || theme === "dark") {
    return `:root{${varsBlock(themeVarValues(theme, model))}}`;
  }
  const light = themeVarValues("light", model);
  const dark = themeVarValues("dark", model);
  return `:root{${varsBlock(light)}}@media (prefers-color-scheme:dark){:root{${varsBlock(dark)}}}`;
}
function makeId(model) {
  return idFactory(`sc-${model.config.style}`);
}
function flattenThemeVars(svg, model, theme) {
  const values = themeVarValues(theme, model);
  return svg.replace(
    /var\((--sc-[a-z0-9]+)\)/g,
    (_match, name) => values[name] ?? "none"
  );
}
function chartTitle(model) {
  return model.config.title ?? model.metadata.fullName;
}
function chartDescription(model) {
  const parts = [];
  parts.push(
    `Star history for ${model.metadata.fullName} over ${model.periodLabel}.`
  );
  parts.push(`${withCommas(model.currentStars)} current stars.`);
  parts.push(`${withCommas(model.windowAdded)} recorded additions in range.`);
  parts.push(
    `${model.periodStart} to ${model.periodEnd}. Scale: ${model.config.scale}.`
  );
  parts.push(
    "Display intervals subdivide nominal API weeks; the final week may still be partial."
  );
  if (model.config.style === "contributions") {
    parts.push(
      "Column height approximates cumulative recorded stars in whole tiles; shading marks distance below each column tip, not value ranges."
    );
  }
  if (model.config.style === "grid") {
    parts.push(
      "Column height rounds up to whole tiles. Legend ranges exclude the lower bound and include the upper bound; unoccupied tiles are above the column height."
    );
  }
  if (model.hasSyntheticWeeks) {
    parts.push("Some weeks had no recorded data and were treated as zero.");
  }
  if (model.isEmpty) {
    parts.push("No recorded additions in the available history.");
  }
  return parts.join(" ");
}
function headerLines(model) {
  const cfg = model.config;
  const available = cfg.width - 32;
  const lines = [];
  const length = (text, size) => Math.min(available, Array.from(text).length * size * 0.62);
  const total = cfg.showTotal ? `\u2605 ${withCommas(model.currentStars)}` : "";
  const change = cfg.showChange && !model.isEmpty ? `+${compactNumber(model.windowAdded)}` : "";
  const totalWidth = length(total, 13);
  const changeWidth = length(change, 13);
  const statsWidth = totalWidth + changeWidth + (total && change ? 10 : 0);
  let statsY = 26;
  if (cfg.showTitle) {
    const fullTitle = Array.from(chartTitle(model));
    const maxChars = Math.floor(available / (14 * 0.62));
    const title = fullTitle.length > maxChars ? `${fullTitle.slice(0, maxChars - 1).join("")}\u2026` : fullTitle.join("");
    const titleWidth = length(title, 14);
    lines.push({
      text: title,
      width: titleWidth,
      y: 26,
      className: "sc-t sc-title",
      size: 14,
      right: false
    });
    lines.push({
      text: model.periodLabel,
      width: length(model.periodLabel, 11),
      y: 42,
      className: "sc-m",
      size: 11,
      right: false
    });
    if (statsWidth + titleWidth + 16 > available) statsY = 64;
  }
  if (total) {
    lines.push({
      text: total,
      width: totalWidth,
      y: statsY,
      className: "sc-t sc-total",
      size: 13,
      right: true
    });
  }
  if (change) {
    const separate = statsWidth > available;
    lines.push({
      text: change,
      width: changeWidth,
      y: statsY + (separate && total ? 20 : 0),
      className: "sc-m sc-change",
      size: 13,
      right: true
    });
  }
  return lines;
}
function headerHeight(model) {
  return Math.max(8, ...headerLines(model).map((line2) => line2.y + 10 - 12));
}
function renderHeader(model, layout) {
  const lines = headerLines(model);
  if (lines.length === 0) return "";
  const change = lines.find((line2) => line2.className.includes("sc-change"));
  return `<g class="sc-header">${lines.map((line2) => {
    const isTotal = line2.className.includes("sc-total");
    const shift = isTotal && change?.y === line2.y ? change.width + 10 : 0;
    const x2 = line2.right ? layout.width - layout.padX - shift : layout.padX;
    const revealEligible = isTotal && model.config.animation.animateTotal && model.config.animation.mode !== "none";
    const frozen = freezeProgress();
    const reveal = revealEligible && frozen === null ? ` ${makeId(model)("total")}` : "";
    const frozenOpacity = revealEligible && frozen !== null ? ` opacity="${totalRevealOpacityAt(resolveTimeline(model.config.animation), frozen).toFixed(3)}"` : "";
    const text = isTotal ? `<tspan class="sc-a">\u2605</tspan>${escapeText(line2.text.slice(1))}` : escapeText(line2.text);
    return `<text x="${x2}" y="${line2.y}" class="${line2.className}${reveal}" font-size="${line2.size}" textLength="${line2.width}" lengthAdjust="spacingAndGlyphs"` + frozenOpacity + (line2.right ? ' text-anchor="end"' : "") + (line2.className.includes("sc-title") ? ' font-weight="600"' : "") + `>${text}</text>`;
  }).join("")}</g>`;
}
function totalRevealCss(model) {
  const anim = model.config.animation;
  if (!model.config.showTotal || !anim.animateTotal || anim.mode === "none")
    return "";
  if (freezeProgress() !== null) return "";
  const id = makeId(model);
  const timeline = resolveTimeline(anim);
  const endFrac = timeline.buildSeconds / timeline.cycleSeconds;
  return progressKeyframes(id("totalkf"), "opacity", "0", "1", {
    startFrac: endFrac * 0.9,
    endFrac
  }) + `@media (prefers-reduced-motion:no-preference){.${id("total")}{animation:${id("totalkf")} ${timeline.cycleSeconds}s linear ${timeline.delaySeconds}s ${timeline.iteration} both;}}`;
}
function renderDates(model, layout, xForColumn, timeForColumn = (index) => model.buckets[index]?.startTime ?? 0) {
  if (!model.config.showXAxis || !model.config.showDates || model.buckets.length === 0) {
    return "";
  }
  const size = model.config.axisFontSize;
  const scale = axisScale(model);
  const y2 = layout.plotTop + layout.plotHeight + Math.round(16 * scale);
  const labels = [];
  const desired = Math.min(5, model.buckets.length);
  const step = Math.max(
    1,
    Math.floor((model.buckets.length - 1) / (desired - 1 || 1))
  );
  const minGap = 64 * scale;
  let lastX = -Infinity;
  for (let i = 0; i < model.buckets.length; i += step) {
    const bucket = model.buckets[i];
    if (!bucket || bucket.startTime === 0) {
      continue;
    }
    const text2 = formatDate(timeForColumn(i), model.config.dateFormat);
    const width = Math.min(
      text2.length * size * 0.62,
      layout.width - layout.padX * 2
    );
    const px = Math.min(
      layout.width - layout.padX - width / 2,
      Math.max(layout.padX + width / 2, xForColumn(i))
    );
    if (px - lastX < Math.max(minGap, width + 8)) {
      continue;
    }
    labels.push({
      x: px,
      text: text2,
      width
    });
    lastX = px;
  }
  if (labels.length === 0) {
    return "";
  }
  const text = labels.map(
    (label) => `<text x="${label.x}" y="${y2}" class="sc-m" font-size="${size}" text-anchor="middle" textLength="${label.width}" lengthAdjust="spacingAndGlyphs">${escapeText(label.text)}</text>`
  ).join("");
  return `<g class="sc-dates">${text}</g>`;
}
function renderLogo(model, layout) {
  if (!model.config.logo) {
    return "";
  }
  const x2 = layout.width - layout.padX;
  const y2 = layout.height - 8;
  return `<text x="${x2}" y="${y2}" text-anchor="end" class="sc-m" font-size="9" opacity="0.8">\u2605 Star Chart</text>`;
}
function wrapDocument(params) {
  const { model, layout, style, defs, body, titleId, descId } = params;
  const bg = model.config.background === "transparent" ? "" : `<rect width="100%" height="100%" fill="${escapeAttr(
    model.config.background
  )}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" class="sc-root" role="img" aria-labelledby="${titleId} ${descId}"><title id="${titleId}">${escapeText(chartTitle(model))}</title><desc id="${descId}">${escapeText(chartDescription(model))}</desc><style>${style}</style>` + (defs ? `<defs>${defs}</defs>` : "") + bg + body + `</svg>`;
}

// node_modules/d3-scale/src/init.js
function initRange(domain, range) {
  switch (arguments.length) {
    case 0:
      break;
    case 1:
      this.range(domain);
      break;
    default:
      this.range(range).domain(domain);
      break;
  }
  return this;
}

// node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

// node_modules/d3-color/src/color.js
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define_default(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format2) {
  var m, l;
  format2 = (format2 + "").trim().toLowerCase();
  return (m = reHex.exec(format2)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format2)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format2)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format2)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format2)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format2) ? rgbn(named[format2]) : format2 === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
  return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}
function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb();
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}
function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}
function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl();
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255, g = o.g / 255, b = o.b / 255, min2 = Math.min(r, g, b), max2 = Math.max(r, g, b), h = NaN, s = max2 - min2, l = (max2 + min2) / 2;
  if (s) {
    if (r === max2) h = (g - b) / s + (g < b) * 6;
    else if (g === max2) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max2 + min2 : 2 - max2 - min2;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}
function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

// node_modules/d3-interpolate/src/basis.js
function basis(t12, v0, v1, v2, v3) {
  var t2 = t12 * t12, t3 = t2 * t12;
  return ((1 - 3 * t12 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t12 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
}
function basis_default(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default(values) {
  var n = values.length;
  return function(t) {
    var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/constant.js
var constant_default = (x2) => () => x2;

// node_modules/d3-interpolate/src/color.js
function linear(a, d) {
  return function(t) {
    return a + t * d;
  };
}
function exponential(a, b, y2) {
  return a = Math.pow(a, y2), b = Math.pow(b, y2) - a, y2 = 1 / y2, function(t) {
    return Math.pow(a + t * b, y2);
  };
}
function gamma(y2) {
  return (y2 = +y2) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y2) : constant_default(isNaN(a) ? b : a);
  };
}
function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : constant_default(isNaN(a) ? b : a);
}

// node_modules/d3-interpolate/src/rgb.js
var rgb_default = (function rgbGamma(y2) {
  var color2 = gamma(y2);
  function rgb2(start, end) {
    var r = color2((start = rgb(start)).r, (end = rgb(end)).r), g = color2(start.g, end.g), b = color2(start.b, end.b), opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }
  rgb2.gamma = rgbGamma;
  return rgb2;
})(1);
function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
    for (i = 0; i < n; ++i) {
      color2 = rgb(colors[i]);
      r[i] = color2.r || 0;
      g[i] = color2.g || 0;
      b[i] = color2.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color2.opacity = 1;
    return function(t) {
      color2.r = r(t);
      color2.g = g(t);
      color2.b = b(t);
      return color2 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis_default);
var rgbBasisClosed = rgbSpline(basisClosed_default);

// node_modules/d3-interpolate/src/numberArray.js
function numberArray_default(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0, c = b.slice(), i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}
function isNumberArray(x2) {
  return ArrayBuffer.isView(x2) && !(x2 instanceof DataView);
}

// node_modules/d3-interpolate/src/array.js
function genericArray(a, b) {
  var nb = b ? b.length : 0, na = a ? Math.min(nb, a.length) : 0, x2 = new Array(na), c = new Array(nb), i;
  for (i = 0; i < na; ++i) x2[i] = value_default(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];
  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x2[i](t);
    return c;
  };
}

// node_modules/d3-interpolate/src/date.js
function date_default(a, b) {
  var d = /* @__PURE__ */ new Date();
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

// node_modules/d3-interpolate/src/number.js
function number_default(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

// node_modules/d3-interpolate/src/object.js
function object_default(a, b) {
  var i = {}, c = {}, k;
  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};
  for (k in b) {
    if (k in a) {
      i[k] = value_default(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }
  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

// node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero2(b) {
  return function() {
    return b;
  };
}
function one(b) {
  return function(t) {
    return b(t) + "";
  };
}
function string_default(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
  a = a + "", b = b + "";
  while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) {
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s[i]) s[i] += bm;
      else s[++i] = bm;
    } else {
      s[++i] = null;
      q.push({ i, x: number_default(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs;
    else s[++i] = bs;
  }
  return s.length < 2 ? q[0] ? one(q[0].x) : zero2(b) : (b = q.length, function(t) {
    for (var i2 = 0, o; i2 < b; ++i2) s[(o = q[i2]).i] = o.x(t);
    return s.join("");
  });
}

// node_modules/d3-interpolate/src/value.js
function value_default(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant_default(b) : (t === "number" ? number_default : t === "string" ? (c = color(b)) ? (b = c, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a, b);
}

// node_modules/d3-interpolate/src/round.js
function round_default(a, b) {
  return a = +a, b = +b, function(t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

// node_modules/d3-scale/src/constant.js
function constants(x2) {
  return function() {
    return x2;
  };
}

// node_modules/d3-scale/src/number.js
function number2(x2) {
  return +x2;
}

// node_modules/d3-scale/src/continuous.js
var unit = [0, 1];
function identity(x2) {
  return x2;
}
function normalize(a, b) {
  return (b -= a = +a) ? function(x2) {
    return (x2 - a) / b;
  } : constants(isNaN(b) ? NaN : 0.5);
}
function clamper(a, b) {
  var t;
  if (a > b) t = a, a = b, b = t;
  return function(x2) {
    return Math.max(a, Math.min(b, x2));
  };
}
function bimap(domain, range, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x2) {
    return r0(d0(x2));
  };
}
function polymap(domain, range, interpolate) {
  var j = Math.min(domain.length, range.length) - 1, d = new Array(j), r = new Array(j), i = -1;
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }
  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range[i], range[i + 1]);
  }
  return function(x2) {
    var i2 = bisect_default(domain, x2, 1, j) - 1;
    return r[i2](d[i2](x2));
  };
}
function copy(source, target) {
  return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp()).unknown(source.unknown());
}
function transformer() {
  var domain = unit, range = unit, interpolate = value_default, transform, untransform, unknown, clamp = identity, piecewise, output, input;
  function rescale() {
    var n = Math.min(domain.length, range.length);
    if (clamp !== identity) clamp = clamper(domain[0], domain[n - 1]);
    piecewise = n > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }
  function scale(x2) {
    return x2 == null || isNaN(x2 = +x2) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate)))(transform(clamp(x2)));
  }
  scale.invert = function(y2) {
    return clamp(untransform((input || (input = piecewise(range, domain.map(transform), number_default)))(y2)));
  };
  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number2), rescale()) : domain.slice();
  };
  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
  };
  scale.rangeRound = function(_) {
    return range = Array.from(_), interpolate = round_default, rescale();
  };
  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity, rescale()) : clamp !== identity;
  };
  scale.interpolate = function(_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };
  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };
  return function(t, u) {
    transform = t, untransform = u;
    return rescale();
  };
}
function continuous() {
  return transformer()(identity, identity);
}

// node_modules/d3-format/src/formatDecimal.js
function formatDecimal_default(x2) {
  return Math.abs(x2 = Math.round(x2)) >= 1e21 ? x2.toLocaleString("en").replace(/,/g, "") : x2.toString(10);
}
function formatDecimalParts(x2, p) {
  if (!isFinite(x2) || x2 === 0) return null;
  var i = (x2 = p ? x2.toExponential(p - 1) : x2.toExponential()).indexOf("e"), coefficient = x2.slice(0, i);
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x2.slice(i + 1)
  ];
}

// node_modules/d3-format/src/exponent.js
function exponent_default(x2) {
  return x2 = formatDecimalParts(Math.abs(x2)), x2 ? x2[1] : NaN;
}

// node_modules/d3-format/src/formatGroup.js
function formatGroup_default(grouping, thousands) {
  return function(value, width) {
    var i = value.length, t = [], j = 0, g = grouping[0], length = 0;
    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }
    return t.reverse().join(thousands);
  };
}

// node_modules/d3-format/src/formatNumerals.js
function formatNumerals_default(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// node_modules/d3-format/src/formatSpecifier.js
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}
formatSpecifier.prototype = FormatSpecifier.prototype;
function FormatSpecifier(specifier) {
  this.fill = specifier.fill === void 0 ? " " : specifier.fill + "";
  this.align = specifier.align === void 0 ? ">" : specifier.align + "";
  this.sign = specifier.sign === void 0 ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === void 0 ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === void 0 ? void 0 : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === void 0 ? void 0 : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === void 0 ? "" : specifier.type + "";
}
FormatSpecifier.prototype.toString = function() {
  return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};

// node_modules/d3-format/src/formatTrim.js
function formatTrim_default(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".":
        i0 = i1 = i;
        break;
      case "0":
        if (i0 === 0) i0 = i;
        i1 = i;
        break;
      default:
        if (!+s[i]) break out;
        if (i0 > 0) i0 = 0;
        break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

// node_modules/d3-format/src/formatPrefixAuto.js
var prefixExponent;
function formatPrefixAuto_default(x2, p) {
  var d = formatDecimalParts(x2, p);
  if (!d) return prefixExponent = void 0, x2.toPrecision(p);
  var coefficient = d[0], exponent = d[1], i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1, n = coefficient.length;
  return i === n ? coefficient : i > n ? coefficient + new Array(i - n + 1).join("0") : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i) : "0." + new Array(1 - i).join("0") + formatDecimalParts(x2, Math.max(0, p + i - 1))[0];
}

// node_modules/d3-format/src/formatRounded.js
function formatRounded_default(x2, p) {
  var d = formatDecimalParts(x2, p);
  if (!d) return x2 + "";
  var coefficient = d[0], exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1) : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

// node_modules/d3-format/src/formatTypes.js
var formatTypes_default = {
  "%": (x2, p) => (x2 * 100).toFixed(p),
  "b": (x2) => Math.round(x2).toString(2),
  "c": (x2) => x2 + "",
  "d": formatDecimal_default,
  "e": (x2, p) => x2.toExponential(p),
  "f": (x2, p) => x2.toFixed(p),
  "g": (x2, p) => x2.toPrecision(p),
  "o": (x2) => Math.round(x2).toString(8),
  "p": (x2, p) => formatRounded_default(x2 * 100, p),
  "r": formatRounded_default,
  "s": formatPrefixAuto_default,
  "X": (x2) => Math.round(x2).toString(16).toUpperCase(),
  "x": (x2) => Math.round(x2).toString(16)
};

// node_modules/d3-format/src/identity.js
function identity_default(x2) {
  return x2;
}

// node_modules/d3-format/src/locale.js
var map = Array.prototype.map;
var prefixes = ["y", "z", "a", "f", "p", "n", "\xB5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];
function locale_default(locale3) {
  var group = locale3.grouping === void 0 || locale3.thousands === void 0 ? identity_default : formatGroup_default(map.call(locale3.grouping, Number), locale3.thousands + ""), currencyPrefix = locale3.currency === void 0 ? "" : locale3.currency[0] + "", currencySuffix = locale3.currency === void 0 ? "" : locale3.currency[1] + "", decimal = locale3.decimal === void 0 ? "." : locale3.decimal + "", numerals = locale3.numerals === void 0 ? identity_default : formatNumerals_default(map.call(locale3.numerals, String)), percent = locale3.percent === void 0 ? "%" : locale3.percent + "", minus = locale3.minus === void 0 ? "\u2212" : locale3.minus + "", nan = locale3.nan === void 0 ? "NaN" : locale3.nan + "";
  function newFormat(specifier, options) {
    specifier = formatSpecifier(specifier);
    var fill = specifier.fill, align = specifier.align, sign2 = specifier.sign, symbol = specifier.symbol, zero3 = specifier.zero, width = specifier.width, comma = specifier.comma, precision = specifier.precision, trim = specifier.trim, type = specifier.type;
    if (type === "n") comma = true, type = "g";
    else if (!formatTypes_default[type]) precision === void 0 && (precision = 12), trim = true, type = "g";
    if (zero3 || fill === "0" && align === "=") zero3 = true, fill = "0", align = "=";
    var prefix = (options && options.prefix !== void 0 ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : ""), suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "") + (options && options.suffix !== void 0 ? options.suffix : "");
    var formatType = formatTypes_default[type], maybeSuffix = /[defgprs%]/.test(type);
    precision = precision === void 0 ? 6 : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision)) : Math.max(0, Math.min(20, precision));
    function format2(value) {
      var valuePrefix = prefix, valueSuffix = suffix, i, n, c;
      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;
        var valueNegative = value < 0 || 1 / value < 0;
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);
        if (trim) value = formatTrim_default(value);
        if (valueNegative && +value === 0 && sign2 !== "+") valueNegative = false;
        valuePrefix = (valueNegative ? sign2 === "(" ? sign2 : minus : sign2 === "-" || sign2 === "(" ? "" : sign2) + valuePrefix;
        valueSuffix = (type === "s" && !isNaN(value) && prefixExponent !== void 0 ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign2 === "(" ? ")" : "");
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }
      if (comma && !zero3) value = group(value, Infinity);
      var length = valuePrefix.length + value.length + valueSuffix.length, padding = length < width ? new Array(width - length + 1).join(fill) : "";
      if (comma && zero3) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";
      switch (align) {
        case "<":
          value = valuePrefix + value + valueSuffix + padding;
          break;
        case "=":
          value = valuePrefix + padding + value + valueSuffix;
          break;
        case "^":
          value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
          break;
        default:
          value = padding + valuePrefix + value + valueSuffix;
          break;
      }
      return numerals(value);
    }
    format2.toString = function() {
      return specifier + "";
    };
    return format2;
  }
  function formatPrefix2(specifier, value) {
    var e = Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3, k = Math.pow(10, -e), f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), { suffix: prefixes[8 + e / 3] });
    return function(value2) {
      return f(k * value2);
    };
  }
  return {
    format: newFormat,
    formatPrefix: formatPrefix2
  };
}

// node_modules/d3-format/src/defaultLocale.js
var locale2;
var format;
var formatPrefix;
defaultLocale2({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});
function defaultLocale2(definition) {
  locale2 = locale_default(definition);
  format = locale2.format;
  formatPrefix = locale2.formatPrefix;
  return locale2;
}

// node_modules/d3-format/src/precisionFixed.js
function precisionFixed_default(step) {
  return Math.max(0, -exponent_default(Math.abs(step)));
}

// node_modules/d3-format/src/precisionPrefix.js
function precisionPrefix_default(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3 - exponent_default(Math.abs(step)));
}

// node_modules/d3-format/src/precisionRound.js
function precisionRound_default(step, max2) {
  step = Math.abs(step), max2 = Math.abs(max2) - step;
  return Math.max(0, exponent_default(max2) - exponent_default(step)) + 1;
}

// node_modules/d3-scale/src/tickFormat.js
function tickFormat(start, stop, count, specifier) {
  var step = tickStep(start, stop, count), precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix_default(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound_default(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed_default(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

// node_modules/d3-scale/src/linear.js
function linearish(scale) {
  var domain = scale.domain;
  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };
  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };
  scale.nice = function(count) {
    if (count == null) count = 10;
    var d = domain();
    var i0 = 0;
    var i1 = d.length - 1;
    var start = d[i0];
    var stop = d[i1];
    var prestep;
    var step;
    var maxIter = 10;
    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }
    while (maxIter-- > 0) {
      step = tickIncrement(start, stop, count);
      if (step === prestep) {
        d[i0] = start;
        d[i1] = stop;
        return domain(d);
      } else if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }
    return scale;
  };
  return scale;
}
function linear2() {
  var scale = continuous();
  scale.copy = function() {
    return copy(scale, linear2());
  };
  initRange.apply(scale, arguments);
  return linearish(scale);
}

// node_modules/d3-scale/src/nice.js
function nice(domain, interval) {
  domain = domain.slice();
  var i0 = 0, i1 = domain.length - 1, x0 = domain[i0], x1 = domain[i1], t;
  if (x1 < x0) {
    t = i0, i0 = i1, i1 = t;
    t = x0, x0 = x1, x1 = t;
  }
  domain[i0] = interval.floor(x0);
  domain[i1] = interval.ceil(x1);
  return domain;
}

// node_modules/d3-scale/src/time.js
function date(t) {
  return new Date(t);
}
function number3(t) {
  return t instanceof Date ? +t : +/* @__PURE__ */ new Date(+t);
}
function calendar(ticks2, tickInterval, year, month, week, day, hour, minute, second2, format2) {
  var scale = continuous(), invert = scale.invert, domain = scale.domain;
  var formatMillisecond = format2(".%L"), formatSecond = format2(":%S"), formatMinute = format2("%I:%M"), formatHour = format2("%I %p"), formatDay = format2("%a %d"), formatWeek = format2("%b %d"), formatMonth = format2("%B"), formatYear2 = format2("%Y");
  function tickFormat2(date2) {
    return (second2(date2) < date2 ? formatMillisecond : minute(date2) < date2 ? formatSecond : hour(date2) < date2 ? formatMinute : day(date2) < date2 ? formatHour : month(date2) < date2 ? week(date2) < date2 ? formatDay : formatWeek : year(date2) < date2 ? formatMonth : formatYear2)(date2);
  }
  scale.invert = function(y2) {
    return new Date(invert(y2));
  };
  scale.domain = function(_) {
    return arguments.length ? domain(Array.from(_, number3)) : domain().map(date);
  };
  scale.ticks = function(interval) {
    var d = domain();
    return ticks2(d[0], d[d.length - 1], interval == null ? 10 : interval);
  };
  scale.tickFormat = function(count, specifier) {
    return specifier == null ? tickFormat2 : format2(specifier);
  };
  scale.nice = function(interval) {
    var d = domain();
    if (!interval || typeof interval.range !== "function") interval = tickInterval(d[0], d[d.length - 1], interval == null ? 10 : interval);
    return interval ? domain(nice(d, interval)) : scale;
  };
  scale.copy = function() {
    return copy(scale, calendar(ticks2, tickInterval, year, month, week, day, hour, minute, second2, format2));
  };
  return scale;
}

// node_modules/d3-scale/src/utcTime.js
function utcTime() {
  return initRange.apply(calendar(utcTicks, utcTickInterval, utcYear, utcMonth, utcSunday, utcDay, utcHour, utcMinute, second, utcFormat).domain([Date.UTC(2e3, 0, 1), Date.UTC(2e3, 0, 2)]), arguments);
}

// src/renderers/conventional.ts
function buildFrame(model, options) {
  const cfg = model.config;
  const padX = 16;
  const padTop = 12;
  const headerHeight2 = headerHeight(model) + (options.legendHeight ?? legendHeight(model));
  const datesHeight2 = datesHeight(model);
  const footerHeight = cfg.logo ? 16 : 8;
  const plotLeft = padX + axisGutter(model);
  const inset = options.inset ?? 0;
  const plotTop = padTop + headerHeight2 + inset;
  const width = cfg.width;
  const naturalPlotHeight = options.compact ? Math.max(40, Math.round(width * 0.18)) : Math.max(160, Math.round(width * 0.42));
  const height = cfg.height ?? plotTop + naturalPlotHeight + datesHeight2 + footerHeight;
  const plotHeight = height - plotTop - datesHeight2 - footerHeight - inset;
  const plotWidth = width - plotLeft - padX - inset;
  if (plotHeight < 24 || plotWidth < 24) {
    throw new RenderError(
      `Cannot fit the header, plot and footer in width ${width}, height ${height}. Increase width/height or use auto height, or hide header/date/logo elements.`
    );
  }
  const n = model.buckets.length;
  const bars = cfg.style === "bar" || options.centered === true;
  const times = model.buckets.map(
    (b) => bars ? (b.startTime + b.endTime) / 2 : b.endTime
  );
  const hasTimes = times.every((t) => t > 0) && (n > 1 || options.observationDomain === true && n === 1);
  const slot = plotWidth / Math.max(1, n);
  const xScale = hasTimes ? utcTime().domain(
    bars || options.observationDomain ? [
      model.buckets[0]?.startTime ?? 0,
      model.buckets[n - 1]?.endTime ?? 1
    ] : [times[0] ?? 0, times[n - 1] ?? 1]
  ).range([plotLeft, plotLeft + plotWidth]) : null;
  const xForIndex = (index) => {
    if (xScale && hasTimes) {
      return xScale(times[index] ?? 0);
    }
    if (n <= 1) {
      return plotLeft + plotWidth / 2;
    }
    return plotLeft + (bars ? (index + 0.5) / n : index / (n - 1)) * plotWidth;
  };
  const values = options.series?.length ? options.series.flatMap(
    (series) => series.buckets.map((b) => b.cumulative)
  ) : model.buckets.map((b) => b.cumulative);
  const dataMax = max(values) ?? 0;
  const dataMin = min(values) ?? 0;
  const baseline = options.series?.length ? Math.min(...options.series.map((series) => series.baseline)) : model.baseline;
  const windowMax = options.series?.length ? Math.max(...options.series.map((series) => series.windowMax)) : model.windowMax;
  const yMin = cfg.scale === "visible" ? Math.min(baseline, dataMin) : 0;
  let yMax = cfg.scale === "visible" ? Math.max(windowMax, dataMax) : dataMax;
  if (yMax <= yMin) {
    yMax = yMin + 1;
  }
  const yScale = linear2().domain([yMin, yMax]).range([plotTop + plotHeight, plotTop]);
  const points = model.buckets.map((bucket, index) => ({
    index,
    x: xForIndex(index),
    y: yScale(bucket.cumulative),
    time: times[index] ?? 0,
    cumulative: bucket.cumulative,
    added: bucket.added
  }));
  const tickCount = cfg.showYAxis ? Math.max(1, Math.min(4, Math.floor(plotHeight / (cfg.axisFontSize * 2)))) : 0;
  const candidateTicks = tickCount > 0 ? yScale.ticks(tickCount).map((value) => ({ value, y: yScale(value) })) : [];
  const yTicks = candidateTicks.filter(
    (tick, i) => i === 0 || Math.abs(tick.y - (candidateTicks[0]?.y ?? tick.y)) >= cfg.axisFontSize * 1.5
  );
  return {
    width,
    height,
    padX,
    padTop,
    headerHeight: headerHeight2,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    datesHeight: datesHeight2,
    footerHeight,
    points,
    yTicks,
    yMin,
    yMax,
    xForIndex,
    xForTime: (time) => xScale ? xScale(time) : plotLeft + plotWidth / 2,
    yForValue: (value) => yScale(value),
    baselineY: plotTop + plotHeight,
    axisFontSize: cfg.axisFontSize,
    showXAxis: cfg.showXAxis,
    sketchAxes: cfg.style === "hand-drawn",
    barWidth: bars && xScale ? Math.min(
      ...model.buckets.map(
        (b) => xScale(b.endTime) - xScale(b.startTime)
      )
    ) * 0.7 : slot * 0.7
  };
}
function renderXAxis(frame) {
  return frame.showXAxis ? `<g class="sc-x-axis">${frame.sketchAxes ? `<path class="sc-axis" fill="none" stroke-width="1.2" d="M${coord(frame.plotLeft)},${coord(frame.baselineY)}L${coord(frame.plotLeft + frame.plotWidth / 2)},${coord(frame.baselineY - 0.7)}L${coord(frame.plotLeft + frame.plotWidth)},${coord(frame.baselineY)}"/>` : `<line class="sc-axis" x1="${coord(frame.plotLeft)}" x2="${coord(frame.plotLeft + frame.plotWidth)}" y1="${coord(frame.baselineY)}" y2="${coord(frame.baselineY)}"/>`}</g>` : "";
}
function renderYAxis(frame) {
  if (frame.yTicks.length === 0) {
    return "";
  }
  const parts = ['<g class="sc-y-axis">'];
  parts.push(
    frame.sketchAxes ? `<path class="sc-axis" fill="none" stroke-width="1.2" d="M${coord(frame.plotLeft)},${coord(frame.plotTop)}L${coord(frame.plotLeft + 0.8)},${coord((frame.plotTop + frame.baselineY) / 2)}L${coord(frame.plotLeft)},${coord(frame.baselineY)}"/>` : `<line class="sc-axis" x1="${coord(frame.plotLeft)}" x2="${coord(frame.plotLeft)}" y1="${coord(frame.plotTop)}" y2="${coord(frame.baselineY)}"/>`
  );
  const size = frame.axisFontSize;
  const labels = frame.yTicks.map(
    (tick) => tick.value < 1e3 && !Number.isInteger(tick.value) ? String(Math.round(tick.value * 100) / 100) : compactNumber(tick.value)
  );
  const needPrecision = new Set(labels).size < labels.length;
  for (const [index, tick] of frame.yTicks.entries()) {
    const label = needPrecision ? tick.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : labels[index] ?? "";
    const labelWidth = Math.min(
      label.length * size * 0.62,
      frame.plotLeft - frame.padX - 6
    );
    parts.push(
      `<line class="sc-axis" x1="${frame.plotLeft}" y1="${coord(tick.y)}" x2="${coord(frame.plotLeft + frame.plotWidth)}" y2="${coord(tick.y)}" stroke-width="1" opacity="0.35"/>`
    );
    parts.push(
      `<text class="sc-m" x="${frame.plotLeft - 6}" y="${coord(tick.y + size * 0.3)}" font-size="${size}" text-anchor="end" textLength="${labelWidth}" lengthAdjust="spacingAndGlyphs" aria-label="${tick.value} recorded stars">${label}</text>`
    );
  }
  parts.push("</g>");
  return parts.join("");
}

// src/renderers/contributions.ts
var GITHUB_GAP_RATIO = 3 / 10;
var GITHUB_RADIUS_RATIO = 2 / 10;
function contribGeometry(input) {
  const model = normalizeChartModel(input);
  const cfg = model.config;
  const cols = model.buckets.length;
  const rows = cfg.rows;
  const padX = 16;
  const innerWidth = cfg.width - padX * 2 - axisGutter(model);
  const innerHeight = cfg.height === null ? Infinity : cfg.height - 12 - headerHeight(model) - legendHeight(model) - datesHeight(model) - (cfg.logo ? 16 : 8);
  const maxCell = cfg.cellSize ?? Math.floor(Math.min(innerWidth / Math.max(1, cols), innerHeight / rows));
  const minCell = cfg.cellSize ?? Math.max(3, (cfg.cellRadius ?? 0) * 2);
  for (let cell = maxCell; cell >= Math.max(3, minCell); cell -= 1) {
    const desiredGap = cfg.cellGap ?? clampInt(cell * GITHUB_GAP_RATIO, 1, cfg.cellSize === null ? 4 : 6);
    const minimumGap = cfg.cellGap ?? desiredGap;
    for (let gap = desiredGap; gap >= minimumGap; gap -= 1) {
      const pitch = cell + gap;
      const gridWidth = cols * pitch - gap;
      const gridHeight = rows * pitch - gap;
      const radius = cfg.cellRadius ?? Math.min(
        Math.floor(cell / 2),
        clampInt(cell * GITHUB_RADIUS_RATIO, 1, 3)
      );
      if (gridWidth <= innerWidth && gridHeight <= innerHeight && radius <= cell / 2) {
        return { cols, rows, pitch, cell, gap, radius, gridWidth, gridHeight };
      }
    }
  }
  throw new RenderError(
    `Cannot fit ${cols} columns \xD7 ${rows} rows in width ${cfg.width}${cfg.height === null ? "" : ` and height ${cfg.height}`} with legible square cells (minimum 3px) and the requested cell_size/gap/radius. Increase width/height, reduce columns/rows or explicit cell settings, or use auto sizing.`
  );
}
function columnHeight(input, cumulative) {
  const model = normalizeChartModel(input);
  const { rows, scale } = model.config;
  const max2 = model.windowMax;
  const baseline = model.baseline;
  if (scale === "visible") {
    const denom = max2 - baseline;
    if (denom <= 0) {
      return 0;
    }
    const num = cumulative - baseline;
    if (num <= 0) {
      return 0;
    }
    const h2 = Math.round(num / denom * rows);
    return clampInt(Math.max(h2, 1), 0, rows);
  }
  if (max2 <= 0 || cumulative <= 0) {
    return 0;
  }
  const h = Math.round(cumulative / max2 * rows);
  return clampInt(Math.max(h, 1), 0, rows);
}
function tipClassFromTop(kFromTop) {
  if (kFromTop === 0) {
    return "sc-l4";
  }
  if (kFromTop === 1) {
    return "sc-l3";
  }
  if (kFromTop === 2) {
    return "sc-l2";
  }
  return "sc-l1";
}
function renderContributions(model, frame) {
  const geo = contribGeometry(model);
  const id = makeId(model);
  const padX = 16;
  const padTop = 12;
  const headerHeight2 = headerHeight(model) + legendHeight(model);
  const datesHeight2 = datesHeight(model);
  const footerHeight = model.config.logo ? 16 : 8;
  const plotTop = padTop + headerHeight2;
  const width = model.config.width;
  const gridX = axisGutter(model) + (width - axisGutter(model) - geo.gridWidth) / 2;
  const naturalHeight = plotTop + geo.gridHeight + datesHeight2 + footerHeight;
  const height = model.config.height ?? naturalHeight;
  const layout = {
    width,
    height,
    padX,
    padTop,
    headerHeight: headerHeight2,
    plotTop,
    plotHeight: geo.gridHeight,
    plotWidth: geo.gridWidth,
    datesHeight: datesHeight2,
    footerHeight
  };
  const xForColumn = (index) => gridX + index * geo.pitch + geo.cell / 2;
  const heights = model.buckets.map(
    (bucket) => columnHeight(model, bucket.cumulative)
  );
  const clipId = id("plotclip");
  const emptyPatId = id("empty");
  const l1PatId = id("l1");
  const defs = buildDefs(geo, clipId, emptyPatId, l1PatId, gridX, plotTop);
  const anim = model.config.animation;
  const framing = frame !== void 0;
  const animEnabled = !framing && anim.mode !== "none";
  const timeline = resolveTimeline(anim);
  const columnsSvg = [];
  const keyframes = [];
  const animRules = [];
  for (let j = 0; j < geo.cols; j += 1) {
    const h = heights[j] ?? 0;
    const colX = gridX + j * geo.pitch;
    const exposed = framing ? Math.max(0, Math.min(h, frame.exposed[j] ?? 0)) : h;
    const finalTy = (geo.rows - exposed) * geo.pitch;
    const colClass = id(`col${j}`);
    const bucket = model.buckets[j];
    const title = bucket ? columnTitle(model, bucket) : "";
    const stack = buildColumnStack(
      geo,
      h,
      colX,
      plotTop,
      l1PatId,
      colClass,
      finalTy,
      framing
    );
    columnsSvg.push(`<g>${title}${stack}</g>`);
    if (animEnabled && h > 0) {
      const window = columnWindow(j, geo.cols, anim, timeline);
      const schedule = columnSchedule({
        style: anim.style,
        easing: anim.easing,
        height: h,
        index: j,
        columns: geo.cols,
        rows: geo.rows,
        window,
        cascadeColumnFrac: 0,
        cascadeRowFrac: 0
      });
      keyframes.push(
        keyframesForColumn(colClass, schedule, geo.rows, geo.pitch)
      );
      animRules.push(
        `.${colClass}{animation:${colClass} ${timeline.cycleSeconds}s linear ${timeline.delaySeconds}s ${timeline.iteration} both;}`
      );
    }
  }
  const plot = `<g clip-path="url(#${clipId})" aria-hidden="true"><rect x="${gridX}" y="${plotTop}" width="${coord(geo.gridWidth)}" height="${coord(geo.gridHeight)}" fill="url(#${emptyPatId})"/>` + columnsSvg.join("") + `</g>`;
  const emptyNote = model.isEmpty ? `<text x="${width / 2}" y="${plotTop + geo.gridHeight / 2}" class="sc-m" font-size="12" text-anchor="middle">No recorded additions yet</text>` : "";
  const style = baseCss(model.config.fontFamily) + buildThemeCss(model) + animationCss(keyframes, animRules) + (framing ? "" : totalRevealCss(model));
  const min2 = model.config.scale === "visible" ? model.baseline : 0;
  const range = model.windowMax - min2;
  const tickCount = Math.max(
    1,
    Math.min(
      4,
      geo.rows,
      Math.floor(geo.gridHeight / (model.config.axisFontSize * 2))
    )
  );
  const levels = [
    ...new Set(
      Array.from(
        { length: tickCount + 1 },
        (_, i) => Math.round(i * geo.rows / tickCount)
      )
    )
  ];
  const axisFrame = {
    plotLeft: gridX,
    plotTop,
    plotWidth: geo.gridWidth,
    baselineY: plotTop + geo.gridHeight,
    padX: gridX - axisGutter(model),
    axisFontSize: model.config.axisFontSize,
    showXAxis: model.config.showXAxis,
    yTicks: !model.config.showYAxis ? [] : range <= 0 || geo.gridHeight < model.config.axisFontSize * 1.5 ? [{ value: min2, y: plotTop + geo.gridHeight }] : levels.map((row) => ({
      value: min2 + range * row / geo.rows,
      y: row === 0 ? plotTop + geo.gridHeight : plotTop + (geo.rows - row) * geo.pitch
    }))
  };
  const body = renderHeader(model, layout) + renderLegend(model) + renderYAxis(axisFrame) + renderXAxis(axisFrame) + plot + emptyNote + renderDates(model, layout, xForColumn) + renderLogo(model, layout);
  return wrapDocument({
    model,
    layout,
    style,
    defs,
    body,
    titleId: id("title"),
    descId: id("desc")
  });
}
function buildDefs(geo, clipId, emptyPatId, l1PatId, gridX, plotTop) {
  const square = (cls) => `<rect x="0" y="0" width="${geo.cell}" height="${geo.cell}" rx="${geo.radius}" ry="${geo.radius}" class="${cls}"/>`;
  const pattern = (patId, cls) => `<pattern id="${patId}" x="${gridX}" y="${plotTop}" width="${geo.pitch}" height="${geo.pitch}" patternUnits="userSpaceOnUse">${square(cls)}</pattern>`;
  const clip = `<clipPath id="${clipId}"><rect x="${gridX}" y="${plotTop}" width="${coord(geo.gridWidth)}" height="${coord(geo.gridHeight)}"/></clipPath>`;
  return pattern(emptyPatId, "sc-empty") + pattern(l1PatId, "sc-l1") + clip;
}
function buildColumnStack(geo, height, colX, plotTop, l1PatId, colClass, finalTy, attrTransform) {
  if (height <= 0) {
    return "";
  }
  const cellRect = (yOffset, cls) => `<rect x="${colX}" y="${plotTop + yOffset}" width="${geo.cell}" height="${geo.cell}" rx="${geo.radius}" ry="${geo.radius}" class="${cls}"/>`;
  const tips = [cellRect(0, "sc-l4")];
  if (height >= 2) {
    tips.push(cellRect(geo.pitch, "sc-l3"));
  }
  if (height >= 3) {
    tips.push(cellRect(geo.pitch * 2, "sc-l2"));
  }
  const l1 = height >= 4 ? `<rect x="${colX}" y="${plotTop + geo.pitch * 3}" width="${geo.cell}" height="${coord(geo.rows * geo.pitch)}" fill="url(#${l1PatId})"/>` : "";
  const placement = attrTransform ? `transform="translate(0 ${coord(finalTy)})"` : `style="transform:translateY(${coord(finalTy)}px)"`;
  return `<g class="${colClass}" ${placement}>` + tips.join("") + l1 + `</g>`;
}
function columnTitle(model, bucket) {
  if (bucket.startTime === 0) {
    return "";
  }
  const date2 = `${formatDate(bucket.startTime, model.config.dateFormat)}\u2013${formatDate(bucket.endTime, model.config.dateFormat)}`;
  const text = `${date2}: ${withCommas(bucket.cumulative)} stars at bucket end (+${withCommas(
    bucket.added
  )}; current week may be partial)`;
  return `<title>${escapeText(text)}</title>`;
}
function animationCss(keyframes, rules) {
  if (keyframes.length === 0) {
    return "";
  }
  return keyframes.join("") + `@media (prefers-reduced-motion:no-preference){${rules.join("")}}`;
}
function clampInt(value, min2, max2) {
  return Math.min(max2, Math.max(min2, Math.round(value)));
}

// node_modules/d3-shape/src/constant.js
function constant_default2(x2) {
  return function constant() {
    return x2;
  };
}

// node_modules/d3-path/src/path.js
var pi = Math.PI;
var tau = 2 * pi;
var epsilon = 1e-6;
var tauEpsilon = tau - epsilon;
function append(strings) {
  this._ += strings[0];
  for (let i = 1, n = strings.length; i < n; ++i) {
    this._ += arguments[i] + strings[i];
  }
}
function appendRound(digits) {
  let d = Math.floor(digits);
  if (!(d >= 0)) throw new Error(`invalid digits: ${digits}`);
  if (d > 15) return append;
  const k = 10 ** d;
  return function(strings) {
    this._ += strings[0];
    for (let i = 1, n = strings.length; i < n; ++i) {
      this._ += Math.round(arguments[i] * k) / k + strings[i];
    }
  };
}
var Path = class {
  constructor(digits) {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null;
    this._ = "";
    this._append = digits == null ? append : appendRound(digits);
  }
  moveTo(x2, y2) {
    this._append`M${this._x0 = this._x1 = +x2},${this._y0 = this._y1 = +y2}`;
  }
  closePath() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._append`Z`;
    }
  }
  lineTo(x2, y2) {
    this._append`L${this._x1 = +x2},${this._y1 = +y2}`;
  }
  quadraticCurveTo(x1, y1, x2, y2) {
    this._append`Q${+x1},${+y1},${this._x1 = +x2},${this._y1 = +y2}`;
  }
  bezierCurveTo(x1, y1, x2, y2, x3, y3) {
    this._append`C${+x1},${+y1},${+x2},${+y2},${this._x1 = +x3},${this._y1 = +y3}`;
  }
  arcTo(x1, y1, x2, y2, r) {
    x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
    if (r < 0) throw new Error(`negative radius: ${r}`);
    let x0 = this._x1, y0 = this._y1, x21 = x2 - x1, y21 = y2 - y1, x01 = x0 - x1, y01 = y0 - y1, l01_2 = x01 * x01 + y01 * y01;
    if (this._x1 === null) {
      this._append`M${this._x1 = x1},${this._y1 = y1}`;
    } else if (!(l01_2 > epsilon)) ;
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
      this._append`L${this._x1 = x1},${this._y1 = y1}`;
    } else {
      let x20 = x2 - x0, y20 = y2 - y0, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l / l01, t21 = l / l21;
      if (Math.abs(t01 - 1) > epsilon) {
        this._append`L${x1 + t01 * x01},${y1 + t01 * y01}`;
      }
      this._append`A${r},${r},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1 + t21 * x21},${this._y1 = y1 + t21 * y21}`;
    }
  }
  arc(x2, y2, r, a0, a1, ccw) {
    x2 = +x2, y2 = +y2, r = +r, ccw = !!ccw;
    if (r < 0) throw new Error(`negative radius: ${r}`);
    let dx = r * Math.cos(a0), dy = r * Math.sin(a0), x0 = x2 + dx, y0 = y2 + dy, cw = 1 ^ ccw, da = ccw ? a0 - a1 : a1 - a0;
    if (this._x1 === null) {
      this._append`M${x0},${y0}`;
    } else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
      this._append`L${x0},${y0}`;
    }
    if (!r) return;
    if (da < 0) da = da % tau + tau;
    if (da > tauEpsilon) {
      this._append`A${r},${r},0,1,${cw},${x2 - dx},${y2 - dy}A${r},${r},0,1,${cw},${this._x1 = x0},${this._y1 = y0}`;
    } else if (da > epsilon) {
      this._append`A${r},${r},0,${+(da >= pi)},${cw},${this._x1 = x2 + r * Math.cos(a1)},${this._y1 = y2 + r * Math.sin(a1)}`;
    }
  }
  rect(x2, y2, w, h) {
    this._append`M${this._x0 = this._x1 = +x2},${this._y0 = this._y1 = +y2}h${w = +w}v${+h}h${-w}Z`;
  }
  toString() {
    return this._;
  }
};
function path2() {
  return new Path();
}
path2.prototype = Path.prototype;

// node_modules/d3-shape/src/path.js
function withPath(shape) {
  let digits = 3;
  shape.digits = function(_) {
    if (!arguments.length) return digits;
    if (_ == null) {
      digits = null;
    } else {
      const d = Math.floor(_);
      if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
      digits = d;
    }
    return shape;
  };
  return () => new Path(digits);
}

// node_modules/d3-shape/src/array.js
var slice = Array.prototype.slice;
function array_default(x2) {
  return typeof x2 === "object" && "length" in x2 ? x2 : Array.from(x2);
}

// node_modules/d3-shape/src/curve/linear.js
function Linear(context) {
  this._context = context;
}
Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x2, y2) {
    x2 = +x2, y2 = +y2;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
        break;
      case 1:
        this._point = 2;
      // falls through
      default:
        this._context.lineTo(x2, y2);
        break;
    }
  }
};
function linear_default(context) {
  return new Linear(context);
}

// node_modules/d3-shape/src/point.js
function x(p) {
  return p[0];
}
function y(p) {
  return p[1];
}

// node_modules/d3-shape/src/line.js
function line_default(x2, y2) {
  var defined = constant_default2(true), context = null, curve = linear_default, output = null, path4 = withPath(line2);
  x2 = typeof x2 === "function" ? x2 : x2 === void 0 ? x : constant_default2(x2);
  y2 = typeof y2 === "function" ? y2 : y2 === void 0 ? y : constant_default2(y2);
  function line2(data) {
    var i, n = (data = array_default(data)).length, d, defined0 = false, buffer;
    if (context == null) output = curve(buffer = path4());
    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) output.lineStart();
        else output.lineEnd();
      }
      if (defined0) output.point(+x2(d, i, data), +y2(d, i, data));
    }
    if (buffer) return output = null, buffer + "" || null;
  }
  line2.x = function(_) {
    return arguments.length ? (x2 = typeof _ === "function" ? _ : constant_default2(+_), line2) : x2;
  };
  line2.y = function(_) {
    return arguments.length ? (y2 = typeof _ === "function" ? _ : constant_default2(+_), line2) : y2;
  };
  line2.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant_default2(!!_), line2) : defined;
  };
  line2.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), line2) : curve;
  };
  line2.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line2) : context;
  };
  return line2;
}

// node_modules/d3-shape/src/area.js
function area_default(x0, y0, y1) {
  var x1 = null, defined = constant_default2(true), context = null, curve = linear_default, output = null, path4 = withPath(area2);
  x0 = typeof x0 === "function" ? x0 : x0 === void 0 ? x : constant_default2(+x0);
  y0 = typeof y0 === "function" ? y0 : y0 === void 0 ? constant_default2(0) : constant_default2(+y0);
  y1 = typeof y1 === "function" ? y1 : y1 === void 0 ? y : constant_default2(+y1);
  function area2(data) {
    var i, j, k, n = (data = array_default(data)).length, d, defined0 = false, buffer, x0z = new Array(n), y0z = new Array(n);
    if (context == null) output = curve(buffer = path4());
    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) {
          j = i;
          output.areaStart();
          output.lineStart();
        } else {
          output.lineEnd();
          output.lineStart();
          for (k = i - 1; k >= j; --k) {
            output.point(x0z[k], y0z[k]);
          }
          output.lineEnd();
          output.areaEnd();
        }
      }
      if (defined0) {
        x0z[i] = +x0(d, i, data), y0z[i] = +y0(d, i, data);
        output.point(x1 ? +x1(d, i, data) : x0z[i], y1 ? +y1(d, i, data) : y0z[i]);
      }
    }
    if (buffer) return output = null, buffer + "" || null;
  }
  function arealine() {
    return line_default().defined(defined).curve(curve).context(context);
  }
  area2.x = function(_) {
    return arguments.length ? (x0 = typeof _ === "function" ? _ : constant_default2(+_), x1 = null, area2) : x0;
  };
  area2.x0 = function(_) {
    return arguments.length ? (x0 = typeof _ === "function" ? _ : constant_default2(+_), area2) : x0;
  };
  area2.x1 = function(_) {
    return arguments.length ? (x1 = _ == null ? null : typeof _ === "function" ? _ : constant_default2(+_), area2) : x1;
  };
  area2.y = function(_) {
    return arguments.length ? (y0 = typeof _ === "function" ? _ : constant_default2(+_), y1 = null, area2) : y0;
  };
  area2.y0 = function(_) {
    return arguments.length ? (y0 = typeof _ === "function" ? _ : constant_default2(+_), area2) : y0;
  };
  area2.y1 = function(_) {
    return arguments.length ? (y1 = _ == null ? null : typeof _ === "function" ? _ : constant_default2(+_), area2) : y1;
  };
  area2.lineX0 = area2.lineY0 = function() {
    return arealine().x(x0).y(y0);
  };
  area2.lineY1 = function() {
    return arealine().x(x0).y(y1);
  };
  area2.lineX1 = function() {
    return arealine().x(x1).y(y0);
  };
  area2.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant_default2(!!_), area2) : defined;
  };
  area2.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), area2) : curve;
  };
  area2.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), area2) : context;
  };
  return area2;
}

// node_modules/d3-shape/src/curve/monotone.js
function sign(x2) {
  return x2 < 0 ? -1 : 1;
}
function slope3(that, x2, y2) {
  var h0 = that._x1 - that._x0, h1 = x2 - that._x1, s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0), s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0), p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}
function slope2(that, t) {
  var h = that._x1 - that._x0;
  return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
}
function point(that, t02, t12) {
  var x0 = that._x0, y0 = that._y0, x1 = that._x1, y1 = that._y1, dx = (x1 - x0) / 3;
  that._context.bezierCurveTo(x0 + dx, y0 + dx * t02, x1 - dx, y1 - dx * t12, x1, y1);
}
function MonotoneX(context) {
  this._context = context;
}
MonotoneX.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x1, this._y1);
        break;
      case 3:
        point(this, this._t0, slope2(this, this._t0));
        break;
    }
    if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x2, y2) {
    var t12 = NaN;
    x2 = +x2, y2 = +y2;
    if (x2 === this._x1 && y2 === this._y1) return;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        point(this, slope2(this, t12 = slope3(this, x2, y2)), t12);
        break;
      default:
        point(this, this._t0, t12 = slope3(this, x2, y2));
        break;
    }
    this._x0 = this._x1, this._x1 = x2;
    this._y0 = this._y1, this._y1 = y2;
    this._t0 = t12;
  }
};
function MonotoneY(context) {
  this._context = new ReflectContext(context);
}
(MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x2, y2) {
  MonotoneX.prototype.point.call(this, y2, x2);
};
function ReflectContext(context) {
  this._context = context;
}
ReflectContext.prototype = {
  moveTo: function(x2, y2) {
    this._context.moveTo(y2, x2);
  },
  closePath: function() {
    this._context.closePath();
  },
  lineTo: function(x2, y2) {
    this._context.lineTo(y2, x2);
  },
  bezierCurveTo: function(x1, y1, x2, y2, x3, y3) {
    this._context.bezierCurveTo(y1, x1, y2, x2, y3, x3);
  }
};
function monotoneX(context) {
  return new MonotoneX(context);
}

// node_modules/d3-shape/src/curve/step.js
function Step(context, t) {
  this._context = context;
  this._t = t;
}
Step.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x = this._y = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (0 < this._t && this._t < 1 && this._point === 2) this._context.lineTo(this._x, this._y);
    if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
    if (this._line >= 0) this._t = 1 - this._t, this._line = 1 - this._line;
  },
  point: function(x2, y2) {
    x2 = +x2, y2 = +y2;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
        break;
      case 1:
        this._point = 2;
      // falls through
      default: {
        if (this._t <= 0) {
          this._context.lineTo(this._x, y2);
          this._context.lineTo(x2, y2);
        } else {
          var x1 = this._x * (1 - this._t) + x2 * this._t;
          this._context.lineTo(x1, this._y);
          this._context.lineTo(x1, y2);
        }
        break;
      }
    }
    this._x = x2, this._y = y2;
  }
};
function stepAfter(context) {
  return new Step(context, 1);
}

// src/renderers/charts.ts
function chartCurve(model) {
  const sparse = model.buckets.some((b) => b.observations === 0);
  return sparse ? stepAfter : monotoneX;
}
function toLayout(frame) {
  return {
    width: frame.width,
    height: frame.height,
    padX: frame.padX,
    padTop: frame.padTop,
    headerHeight: frame.headerHeight,
    plotTop: frame.plotTop,
    plotHeight: frame.plotHeight,
    plotWidth: frame.plotWidth,
    datesHeight: frame.datesHeight,
    footerHeight: frame.footerHeight
  };
}
function pointTitles(model, frame) {
  const titles = model.buckets.map((bucket, index) => {
    if (bucket.startTime === 0) {
      return "";
    }
    const point2 = frame.points[index];
    if (!point2) {
      return "";
    }
    const date2 = `${formatDate(bucket.startTime, model.config.dateFormat)}\u2013${formatDate(bucket.endTime, model.config.dateFormat)}`;
    const text = `${date2}: ${withCommas(bucket.cumulative)} recorded stars at bucket end (+${withCommas(bucket.added)}; current week may be partial)`;
    return `<circle cx="${coord(point2.x)}" cy="${coord(point2.y)}" r="6" fill="transparent"><title>${escapeText(text)}</title></circle>`;
  }).join("");
  return titles;
}
function wipeClip(frame, id, anim, timeline, padding = 0) {
  const clipId = id("wipe");
  const wipeCls = id("wipefill");
  const rectX = frame.plotLeft - padding;
  const rectY = frame.plotTop - Math.max(3, padding);
  const rectW = frame.plotWidth + padding * 2;
  const rectH = frame.plotHeight + Math.max(3, padding) * 2;
  const simultaneous = anim.direction === "simultaneous";
  const frozen = freezeProgress();
  if (frozen !== null) {
    const scale = wipeScaleAt(anim, timeline, frame.points.length, frozen);
    const x2 = rectX;
    const w = simultaneous ? rectW : rectW * scale;
    const h = simultaneous ? rectH * scale : rectH;
    const y2 = simultaneous ? rectY + rectH - h : rectY;
    const defs2 = `<clipPath id="${clipId}"><rect x="${coord(x2)}" y="${coord(y2)}" width="${coord(w)}" height="${coord(h)}"/></clipPath>`;
    return { clipId, defs: defs2, css: "" };
  }
  const defs = `<clipPath id="${clipId}"><rect class="${wipeCls}" x="${coord(rectX)}" y="${coord(rectY)}" width="${coord(rectW)}" height="${coord(rectH)}"/></clipPath>`;
  const timing = anim.style === "cascade" ? `steps(${Math.max(1, frame.points.length)},end)` : simultaneous && anim.style === "reveal" ? "steps(1,end)" : anim.easing;
  const axis = simultaneous ? "Y" : "X";
  const kf = id("wipekf");
  let frames = progressKeyframes(
    kf,
    "transform",
    `scale${axis}(0)`,
    `scale${axis}(1)`,
    {
      startFrac: 0,
      endFrac: timeline.buildSeconds / timeline.cycleSeconds
    }
  );
  if (anim.style === "cascade") {
    const count = Math.max(1, frame.points.length);
    const stops = Array.from({ length: count + 1 }, (_, i) => {
      const pct = keyframePercent(
        inverseEasing(anim.easing, i / count) * timeline.buildSeconds / timeline.cycleSeconds
      );
      return `${pct}%{transform:scale${axis}(${i / count});animation-timing-function:steps(1,end);}`;
    });
    frames = `@keyframes ${kf}{${stops.join("")}100%{transform:scale${axis}(1);}}`;
  }
  const css = frames + `@media (prefers-reduced-motion:no-preference){.${wipeCls}{transform-box:fill-box;transform-origin:${simultaneous ? "center bottom" : "left center"};animation:${kf} ${timeline.cycleSeconds}s ${timing} ${timeline.delaySeconds}s ${timeline.iteration} both;}}`;
  return { clipId, defs, css };
}
function commonBody(model, frame, plot, xAxis = renderXAxis(frame)) {
  const layout = toLayout(frame);
  return renderHeader(model, layout) + renderLegend(model) + xAxis + plot + renderDates(
    model,
    layout,
    frame.xForIndex,
    (index) => frame.points[index]?.time ?? 0
  ) + renderLogo(model, layout);
}
function renderLine(model) {
  return renderLineLike(model, { axis: true, compact: false });
}
function renderSparkline(model) {
  return renderLineLike(model, { axis: false, compact: true });
}
function renderLineLike(model, opts) {
  const frame = buildFrame(model, opts);
  const id = makeId(model);
  const anim = model.config.animation;
  const timeline = resolveTimeline(anim);
  const animEnabled = anim.mode !== "none";
  const generator = line_default().x((d) => d.x).y((d) => d.y).curve(chartCurve(model));
  const path4 = generator(frame.points.map((p) => ({ x: p.x, y: p.y }))) ?? "";
  const single = frame.points.length === 1 ? frame.points[0] : null;
  let animCss = "";
  let pathAttrs = "";
  let wipeDefs = "";
  let clipWrapOpen = "";
  let clipWrapClose = "";
  if (animEnabled && path4) {
    if (anim.style === "grow" && anim.direction === "chronological" && !single) {
      if (isFrozen()) {
        const eased = strokeDrawFractionAt(
          anim,
          timeline,
          freezeProgress() ?? 1
        );
        const total = svgPathLength(path4);
        const drawn = total * eased;
        pathAttrs = ` class="sc-stroke" stroke-dasharray="${coord(drawn)} ${coord(total)}"`;
      } else {
        const kf = id("draw");
        const drawCls = id("drawline");
        pathAttrs = ` pathLength="1" class="sc-stroke ${drawCls}"`;
        animCss = progressKeyframes(kf, "stroke-dashoffset", "1", "0", {
          startFrac: 0,
          endFrac: timeline.buildSeconds / timeline.cycleSeconds
        }) + `@media (prefers-reduced-motion:no-preference){.${drawCls}{stroke-dasharray:1;stroke-dashoffset:0;animation:${kf} ${timeline.cycleSeconds}s ${anim.easing} ${timeline.delaySeconds}s ${timeline.iteration} both;}}`;
      }
    } else {
      const wipe = wipeClip(frame, id, anim, timeline);
      wipeDefs = wipe.defs;
      animCss = wipe.css;
      clipWrapOpen = `<g clip-path="url(#${wipe.clipId})">`;
      clipWrapClose = "</g>";
    }
  }
  const strokeWidth = opts.compact ? 1.75 : 2;
  const pathClass = pathAttrs || ' class="sc-stroke"';
  const pathEl = path4 ? `<path d="${path4}"${pathClass} stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>` : "";
  const dot = single ? `<circle class="sc-dot" cx="${coord(single.x)}" cy="${coord(single.y)}" r="3"/>` : "";
  const axis = renderYAxis(frame);
  const plot = axis + `<g aria-hidden="true">${clipWrapOpen}${pathEl}${dot}${clipWrapClose}</g>` + pointTitles(model, frame);
  const style = baseCss(model.config.fontFamily) + buildThemeCss(model) + animCss + totalRevealCss(model);
  const body = commonBody(model, frame, plot);
  return wrapDocument({
    model,
    layout: toLayout(frame),
    style,
    defs: wipeDefs || void 0,
    body,
    titleId: id("title"),
    descId: id("desc")
  });
}
function renderArea(model) {
  const frame = buildFrame(model, { axis: true, compact: false });
  const id = makeId(model);
  const anim = model.config.animation;
  const timeline = resolveTimeline(anim);
  const animEnabled = anim.mode !== "none";
  const areaGen = area_default().x((d) => d.x).y0(frame.baselineY).y1((d) => d.y).curve(chartCurve(model));
  const lineGen = line_default().x((d) => d.x).y((d) => d.y).curve(chartCurve(model));
  const pts = frame.points.map((p) => ({ x: p.x, y: p.y }));
  const areaPath = areaGen(pts) ?? "";
  const linePath = lineGen(pts) ?? "";
  let wipeDefs = "";
  let animCss = "";
  let open = "";
  let close = "";
  if (animEnabled && areaPath) {
    const wipe = wipeClip(frame, id, anim, timeline);
    wipeDefs = wipe.defs;
    animCss = wipe.css;
    open = `<g clip-path="url(#${wipe.clipId})">`;
    close = "</g>";
  }
  const axis = renderYAxis(frame);
  const plot = axis + `<g aria-hidden="true">${open}` + (areaPath ? `<path d="${areaPath}" class="sc-area" opacity="0.22"/>` : "") + (linePath ? `<path d="${linePath}" class="sc-stroke" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : "") + `${close}</g>` + pointTitles(model, frame);
  const style = baseCss(model.config.fontFamily) + buildThemeCss(model) + animCss + totalRevealCss(model);
  const body = commonBody(model, frame, plot);
  return wrapDocument({
    model,
    layout: toLayout(frame),
    style,
    defs: wipeDefs || void 0,
    body,
    titleId: id("title"),
    descId: id("desc")
  });
}
function renderBar(model) {
  const frame = buildFrame(model, { axis: true, compact: false });
  const id = makeId(model);
  const anim = model.config.animation;
  const timeline = resolveTimeline(anim);
  const animEnabled = anim.mode !== "none";
  const n = frame.points.length;
  const barW = frame.barWidth;
  const growMode = animEnabled && anim.style === "grow";
  const wipeMode = animEnabled && anim.style !== "grow";
  const frozenGrow = growMode && isFrozen();
  let wipeDefs = "";
  let animCss = "";
  let open = "";
  let close = "";
  const growCls = id("bargrow");
  if (wipeMode) {
    const wipe = wipeClip(frame, id, anim, timeline);
    wipeDefs = wipe.defs;
    animCss = wipe.css;
    open = `<g clip-path="url(#${wipe.clipId})">`;
    close = "</g>";
  } else if (growMode && !frozenGrow) {
    animCss = `@media (prefers-reduced-motion:no-preference){.${growCls}{transform-box:fill-box;transform-origin:center bottom;}}`;
  }
  const bars = [];
  const growRules = [];
  for (let i = 0; i < n; i += 1) {
    const point2 = frame.points[i];
    if (!point2) {
      continue;
    }
    const barH = Math.max(0, frame.baselineY - point2.y);
    const x2 = point2.x - barW / 2;
    if (frozenGrow) {
      const scale = barGrowScaleAt(
        anim,
        columnWindow(i, n, anim, timeline),
        freezeProgress() ?? 1
      );
      const h = barH * scale;
      const y2 = frame.baselineY - h;
      bars.push(
        `<rect class="sc-bar" x="${coord(x2)}" y="${coord(y2)}" width="${coord(barW)}" height="${coord(h)}" rx="1"/>`
      );
      continue;
    }
    const barId = growMode ? `${growCls}-${i}` : "";
    const cls = growMode ? `sc-bar ${growCls} ${barId}` : "sc-bar";
    bars.push(
      `<rect class="${cls}" x="${coord(x2)}" y="${coord(point2.y)}" width="${coord(barW)}" height="${coord(barH)}" rx="1"/>`
    );
    if (growMode && barH > 0) {
      animCss += progressKeyframes(
        barId,
        "transform",
        "scaleY(0)",
        "scaleY(1)",
        columnWindow(i, n, anim, timeline)
      );
      growRules.push(
        `.${barId}{animation:${barId} ${timeline.cycleSeconds}s ${anim.easing} ${timeline.delaySeconds}s ${timeline.iteration} both;}`
      );
    }
  }
  if (growMode && !frozenGrow && growRules.length > 0) {
    animCss += `@media (prefers-reduced-motion:no-preference){${growRules.join("")}}`;
  }
  const axis = renderYAxis(frame);
  const plot = axis + `<g aria-hidden="true">${open}${bars.join("")}${close}</g>` + pointTitles(model, frame);
  const style = baseCss(model.config.fontFamily) + buildThemeCss(model) + animCss + totalRevealCss(model);
  const body = commonBody(model, frame, plot);
  return wrapDocument({
    model,
    layout: toLayout(frame),
    style,
    defs: wipeDefs || void 0,
    body,
    titleId: id("title"),
    descId: id("desc")
  });
}

// src/renderers/styled.ts
function document(model, frame, composition) {
  const id = makeId(model);
  const anim = model.config.animation;
  const wipe = anim.mode === "none" ? null : wipeClip(frame, id, anim, resolveTimeline(anim), 12);
  const plot = (composition.yAxis ?? renderYAxis(frame)) + (wipe ? `<g clip-path="url(#${wipe.clipId})">` : "<g>") + composition.plot + "</g>" + (composition.titles ?? pointTitles(model, frame));
  return wrapDocument({
    model,
    layout: toLayout(frame),
    titleId: id("title"),
    descId: id("desc"),
    defs: (composition.defs ?? "") + (wipe?.defs ?? ""),
    style: baseCss(model.config.fontFamily) + buildThemeCss(model) + ".sc-ink{fill:none;stroke:var(--sc-l4);}.sc-ink-fill{fill:var(--sc-l4);}" + (composition.css ?? "") + (wipe?.css ?? "") + totalRevealCss(model),
    body: commonBody(model, frame, plot, composition.xAxis)
  });
}
function line(points, curve) {
  return line_default().x((p) => p.x).y((p) => p.y).curve(curve)(points) ?? "";
}
function area(points, frame, curve) {
  return area_default().x((p) => p.x).y0(frame.baselineY).y1((p) => p.y).curve(curve)(points) ?? "";
}
function stroke(path4, name, width = 2) {
  return `<path data-chart="${name}" d="${path4}" class="sc-ink" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function singleDot(points) {
  const point2 = points.length === 1 ? points[0] : void 0;
  return point2 ? `<circle class="sc-ink-fill" cx="${coord(point2.x)}" cy="${coord(point2.y)}" r="3"/>` : "";
}
function renderStepLine(model) {
  const frame = buildFrame(model, { axis: true, compact: false, inset: 4 });
  return document(model, frame, {
    plot: stroke(line(frame.points, stepAfter), "step-line") + singleDot(frame.points)
  });
}
function renderGrid(model) {
  const geometry = contribGeometry(model);
  const initial = buildFrame(model, {
    axis: true,
    compact: false,
    centered: true
  });
  const height = model.config.height ?? initial.plotTop + geometry.gridHeight + initial.datesHeight + initial.footerHeight;
  const base = buildFrame(
    { ...model, config: { ...model.config, height } },
    { axis: true, compact: false, centered: true }
  );
  const bottom = base.plotTop + geometry.gridHeight;
  const yForValue = (value) => bottom - (value - base.yMin) / (base.yMax - base.yMin) * geometry.gridHeight;
  const xForIndex = (index) => base.plotLeft + index * geometry.pitch + geometry.cell / 2;
  const frame = {
    ...base,
    plotHeight: geometry.gridHeight,
    plotWidth: geometry.gridWidth,
    baselineY: bottom,
    xForIndex,
    yForValue,
    points: base.points.map((p) => ({
      ...p,
      x: xForIndex(p.index),
      y: yForValue(p.cumulative)
    })),
    yTicks: base.yTicks.map((t) => ({ value: t.value, y: yForValue(t.value) }))
  };
  const tiles = frame.points.map((point2) => {
    const ratio = Math.max(
      0,
      Math.min(
        1,
        (point2.cumulative - frame.yMin) / (frame.yMax - frame.yMin)
      )
    );
    const filled = Math.ceil(ratio * geometry.rows);
    const intensity = Math.max(1, Math.ceil(ratio * 4));
    const cells = Array.from(
      { length: geometry.rows },
      (_, row) => `<rect class="sc-${row < filled ? `l${intensity}` : "empty"}" x="${coord(point2.x - geometry.cell / 2)}" y="${coord(bottom - (row + 1) * geometry.pitch + geometry.gap)}" width="${geometry.cell}" height="${geometry.cell}" rx="${geometry.radius}"/>`
    ).join("");
    return `<g data-column="${point2.index}"><title>${escapeText(
      `${withCommas(point2.cumulative)} recorded stars` + (point2.time > 0 ? ` at bucket end ${formatDate(model.buckets[point2.index]?.endTime ?? point2.time, model.config.dateFormat)}` : "") + "; tile height rounded up"
    )}</title>${cells}</g>`;
  }).join("");
  return document(model, frame, {
    plot: `<g data-chart="grid">${tiles}</g>`,
    titles: ""
  });
}
function observationPoints(model, frame) {
  if (model.selectedWeeks.length === 0)
    return frame.points.filter((p) => p.time > 0);
  let cumulative = model.baseline;
  return model.selectedWeeks.map((week, index) => {
    cumulative += week.added;
    const time = model.selectedWeeks[index + 1]?.time ?? week.time + MS_PER_WEEK;
    return {
      index,
      time,
      cumulative,
      added: week.added,
      x: frame.xForTime(time),
      y: frame.yForValue(cumulative)
    };
  });
}
function milestoneStep(range) {
  const target = Math.max(1, range / 6);
  const power = 10 ** Math.floor(Math.log10(target));
  return (target / power <= 1 ? 1 : target / power <= 2 ? 2 : target / power <= 5 ? 5 : 10) * power;
}
function renderMilestones(model, filled) {
  const frame = buildFrame(model, {
    axis: true,
    compact: false,
    observationDomain: true,
    inset: 8
  });
  const points = observationPoints(model, frame);
  const step = milestoneStep(model.windowMax - model.baseline);
  let threshold = (Math.floor(model.baseline / step) + 1) * step;
  const events = [];
  for (const point2 of points) {
    const thresholds = [];
    while (threshold <= point2.cumulative) {
      thresholds.push(threshold);
      threshold += step;
    }
    if (thresholds.length) events.push({ point: point2, thresholds });
  }
  const last = points[points.length - 1];
  if (events.length === 0 && last) events.push({ point: last, thresholds: [] });
  const occupied = [];
  const markers = events.map(({ point: point2, thresholds }) => {
    const crossed = thresholds.length ? thresholds.map(compactNumber).join(", ") : "";
    const text = thresholds.length > 1 ? `${compactNumber(thresholds[0] ?? 0)}\u2013${compactNumber(thresholds[thresholds.length - 1] ?? 0)}` : compactNumber(thresholds[0] ?? point2.cumulative);
    const tooltip = `${formatDate(point2.time, model.config.dateFormat)}: ${withCommas(point2.cumulative)} recorded stars` + (crossed ? `; crossed ${crossed}` : "; latest observation");
    const width = text.length * 6.2 + 8;
    const x2 = Math.max(
      frame.plotLeft + width / 2,
      Math.min(frame.plotLeft + frame.plotWidth - width / 2, point2.x)
    );
    const y2 = point2.y - 12 < frame.plotTop ? point2.y + 20 : point2.y - 12;
    const collision = occupied.some(
      (b) => Math.abs(b.x - x2) < (b.width + width) / 2 && Math.abs(b.y - y2) < 16
    );
    if (!collision) occupied.push({ x: x2, y: y2, width });
    return `<g data-observed="${point2.cumulative}" data-time="${point2.time}"><title>${escapeText(tooltip)}</title><circle class="sc-ink-fill" cx="${coord(point2.x)}" cy="${coord(point2.y)}" r="4"/>` + (!collision ? `<text class="sc-t" x="${coord(x2)}" y="${coord(Math.min(frame.baselineY - 4, y2))}" text-anchor="middle" font-size="10">${escapeText(text)}</text>` : "") + "</g>";
  }).join("");
  const start = model.selectedWeeks[0];
  const areaPoints = start ? [
    {
      x: frame.xForTime(start.time),
      y: frame.yForValue(model.baseline)
    },
    ...points
  ] : points;
  const scatter = points.map(
    (p) => `<circle class="sc-ink-fill" cx="${coord(p.x)}" cy="${coord(p.y)}" r="1.8" opacity="0.6"/>`
  ).join("");
  const plot = filled ? `<path data-chart="milestone-area-fill" class="sc-ink-fill" opacity="0.18" d="${area(areaPoints, frame, stepAfter)}"/>` + stroke(line(areaPoints, stepAfter), "milestone-area") + markers : `<g data-chart="milestone-scatter">${scatter}${markers}</g>`;
  return document(model, frame, { plot, titles: "" });
}
function renderMilestoneScatter(model) {
  return renderMilestones(model, false);
}
function renderMilestoneArea(model) {
  return renderMilestones(model, true);
}
function comparisonSeries(model) {
  if (!model.series?.length) {
    if (configRepositories(model.config).length > 1) {
      throw new RenderError(
        "clustered-bar needs independent repository histories. Use buildMultiRepositoryChartModel; aggregate data cannot reconstruct series."
      );
    }
    return [
      {
        metadata: model.metadata,
        buckets: model.buckets,
        selectedWeeks: model.selectedWeeks,
        baseline: model.baseline,
        windowMax: model.windowMax,
        hasSyntheticWeeks: model.hasSyntheticWeeks
      }
    ];
  }
  if (configRepositories(model.config).length > 1 && model.series.length !== configRepositories(model.config).length) {
    throw new RenderError(
      "clustered-bar needs one aligned series per configured repository."
    );
  }
  for (const series of model.series) {
    if (!Number.isFinite(series.baseline) || !Number.isFinite(series.windowMax) || series.baseline < 0 || series.windowMax < series.baseline || series.buckets.length !== model.buckets.length || series.buckets.some(
      (b, i) => b.startTime !== model.buckets[i]?.startTime || b.endTime !== model.buckets[i]?.endTime || !Number.isFinite(b.cumulative) || b.cumulative < series.baseline
    )) {
      throw new RenderError(
        "clustered-bar series must share the aggregate bucket boundaries and finite cumulative values."
      );
    }
  }
  return model.series;
}
function renderClusteredBar(model) {
  const series = comparisonSeries(model);
  const frame = buildFrame(model, {
    axis: true,
    compact: false,
    centered: true,
    series
  });
  const groupWidth = frame.barWidth / 0.7 * 0.8;
  const slot = groupWidth / series.length;
  if (slot < 2) {
    throw new RenderError(
      "Cannot fit clustered-bar columns and repositories. Reduce columns or increase width (at least 2px per repository)."
    );
  }
  const id = makeId(model);
  const colors = (theme) => series.map((_, index) => {
    const override = index < 4 ? model.config.paletteOverrides[`level${index + 1}`] : void 0;
    return `.${id(`series-${index}`)}{fill:${override ?? seriesColor(index, theme)};}`;
  }).join("");
  const css = model.config.theme === "auto" ? colors("light") + `@media (prefers-color-scheme:dark){${colors("dark")}}` : colors(model.config.theme);
  const bars = model.buckets.map(
    (_, index) => series.map((s, seriesIndex) => {
      const bucket = s.buckets[index];
      if (!bucket)
        throw new RenderError("Missing aligned repository bucket.");
      const y2 = frame.yForValue(bucket.cumulative);
      const x2 = frame.xForIndex(index) - groupWidth / 2 + seriesIndex * slot;
      const tooltip = `${s.metadata.fullName}: ${withCommas(bucket.cumulative)} recorded stars` + (bucket.endTime > 0 ? ` at ${formatDate(bucket.endTime, model.config.dateFormat)}` : "") + ` (+${withCommas(bucket.added)})`;
      return `<rect data-repository="${escapeAttr(s.metadata.fullName)}" class="${id(`series-${seriesIndex}`)}" x="${coord(x2)}" y="${coord(y2)}" width="${coord(slot * 0.85)}" height="${coord(frame.baselineY - y2)}"><title>${escapeText(tooltip)}</title></rect>`;
    }).join("")
  ).join("");
  return document(model, frame, {
    plot: `<g data-chart="clustered-bar">${bars}</g>`,
    css,
    titles: ""
  });
}
function renderNeon(model, stream) {
  const frame = buildFrame(model, { axis: true, compact: false, inset: 12 });
  const id = makeId(model);
  const path4 = line(frame.points, chartCurve(model));
  const halo = id("halo");
  const gradient = id("stream");
  const defs = `<filter id="${halo}" filterUnits="userSpaceOnUse" x="${coord(frame.plotLeft - 12)}" y="${coord(frame.plotTop - 12)}" width="${coord(frame.plotWidth + 24)}" height="${coord(frame.plotHeight + 24)}"><feGaussianBlur stdDeviation="3"/></filter>` + (stream ? `<linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sc-stream-stop" stop-opacity="0.55"/><stop offset="0.6" class="sc-stream-stop" stop-opacity="0.18"/><stop offset="1" class="sc-stream-stop" stop-opacity="0.02"/></linearGradient>` : "");
  const plot = (stream ? `<path data-chart="neon-glow-stream-fill" d="${area(frame.points, frame, chartCurve(model))}" fill="url(#${gradient})"/>` : "") + `<g filter="url(#${halo})" opacity="0.55">${stroke(path4, "neon-halo", 8)}${singleDot(frame.points)}</g><g opacity="0.2">${stroke(path4, "neon-aura", 6)}</g>` + stroke(path4, stream ? "neon-glow-stream" : "neon-glow", 2) + singleDot(frame.points);
  return document(model, frame, {
    plot,
    defs,
    css: ".sc-stream-stop{stop-color:var(--sc-l4);}"
  });
}
function renderNeonGlow(model) {
  return renderNeon(model, false);
}
function renderNeonGlowStream(model) {
  return renderNeon(model, true);
}
function renderAsciiTerminal(model) {
  const frame = buildFrame(model, {
    axis: true,
    compact: false,
    centered: true
  });
  const rows = model.config.rows;
  const columns = model.buckets.length;
  const borderColumns = model.config.showYAxis ? 2 : 0;
  const cellWidth = frame.plotWidth / (columns + borderColumns);
  const rowHeight = frame.plotHeight / (rows + (model.config.showXAxis ? 1 : 0));
  const fontSize = Math.min(16, rowHeight * 0.9, cellWidth / 0.62);
  if (fontSize < 5) {
    throw new RenderError(
      "Cannot fit ascii-terminal resolution. Reduce rows/columns or increase width/height."
    );
  }
  const heights = model.buckets.map(
    (bucket) => Math.ceil(
      rows * Math.max(
        0,
        Math.min(
          1,
          (bucket.cumulative - frame.yMin) / (frame.yMax - frame.yMin)
        )
      )
    )
  );
  const lines = Array.from({ length: rows }, (_, row) => {
    const level = rows - row;
    return (model.config.showYAxis ? "|" : "") + heights.map((height) => height === level ? "*" : height > level ? "#" : " ").join("") + (model.config.showYAxis ? "|" : "");
  });
  const textAttributes = `class="sc-ink-fill" xml:space="preserve" font-family="monospace" font-size="${coord(fontSize)}"`;
  const text = `<text data-chart="ascii-terminal" ${textAttributes}>` + lines.map(
    (row, index) => `<tspan x="${frame.plotLeft}" y="${coord(frame.plotTop + (index + 0.8) * rowHeight)}" textLength="${coord(frame.plotWidth)}" lengthAdjust="spacingAndGlyphs">${row}</tspan>`
  ).join("") + "</text>";
  const dataHeight = rows * rowHeight;
  const terminalFrame = {
    ...frame,
    baselineY: frame.plotTop + dataHeight,
    xForIndex: (index) => frame.plotLeft + (index + 0.5 + borderColumns / 2) * cellWidth,
    yTicks: frame.yTicks.map((tick) => ({
      value: tick.value,
      y: frame.plotTop + dataHeight * (frame.yMax - tick.value) / (frame.yMax - frame.yMin)
    }))
  };
  const border = (model.config.showYAxis ? "+" : "") + "-".repeat(columns) + (model.config.showYAxis ? "+" : "");
  const xAxis = model.config.showXAxis ? `<g class="sc-x-axis"><text ${textAttributes}><tspan x="${frame.plotLeft}" y="${coord(terminalFrame.baselineY)}" dominant-baseline="middle" textLength="${coord(frame.plotWidth)}" lengthAdjust="spacingAndGlyphs">${border}</tspan></text></g>` : "";
  return document(model, terminalFrame, {
    plot: text,
    xAxis,
    titles: ""
  });
}
function sketchPath(points, frame, phase, sparse) {
  const expanded = [];
  for (const [index, point2] of points.entries()) {
    const previous = points[index - 1];
    if (previous) {
      if (sparse) {
        expanded.push({
          x: (previous.x + point2.x) / 2,
          y: Math.max(
            frame.plotTop,
            Math.min(
              frame.baselineY,
              previous.y + Math.sin(index * 2.399 + phase) * 0.7
            )
          )
        });
        expanded.push({ x: point2.x, y: previous.y });
      } else
        expanded.push({
          x: (previous.x + point2.x) / 2,
          y: Math.max(
            frame.plotTop,
            Math.min(
              frame.baselineY,
              (previous.y + point2.y) / 2 + Math.sin(index * 2.399 + phase) * 1.4
            )
          )
        });
    }
    expanded.push(point2);
  }
  return line(expanded, linear_default);
}
function renderHandDrawn(model) {
  const frame = buildFrame(model, { axis: true, compact: false, inset: 4 });
  const id = makeId(model);
  const hatch = id("hatch");
  const sparse = model.buckets.some((b) => b.observations === 0);
  const defs = `<pattern id="${hatch}" patternUnits="userSpaceOnUse" width="8" height="8"><path class="sc-ink" d="M-2,8L8,-2M6,10L10,6" stroke-width="0.8" opacity="0.45"/></pattern>`;
  return document(model, frame, {
    defs,
    plot: `<path data-chart="sketch-fill" d="${area(frame.points, frame, sparse ? stepAfter : linear_default)}" fill="url(#${hatch})"/>` + stroke(
      sketchPath(frame.points, frame, 0, sparse),
      "sketch-primary",
      1.8
    ) + `<g opacity="0.5">${stroke(sketchPath(frame.points, frame, 2, sparse), "sketch-secondary", 0.9)}</g>` + singleDot(frame.points)
  });
}

// src/renderers/index.ts
var REGISTRY = {
  contributions: renderContributions,
  line: renderLine,
  area: renderArea,
  bar: renderBar,
  sparkline: renderSparkline,
  grid: renderGrid,
  "step-line": renderStepLine,
  "milestone-scatter": renderMilestoneScatter,
  "milestone-area": renderMilestoneArea,
  "clustered-bar": renderClusteredBar,
  "neon-glow": renderNeonGlow,
  "neon-glow-stream": renderNeonGlowStream,
  "ascii-terminal": renderAsciiTerminal,
  "hand-drawn": renderHandDrawn
};
function getRenderer(style) {
  return REGISTRY[style];
}
var SIZE_LIMITS = {
  staticWarn: 100 * 1024,
  animatedWarn: 500 * 1024,
  hardMax: 3 * 1024 * 1024
};
function renderChart(input) {
  const model = normalizeChartModel(input);
  const renderer = getRenderer(model.config.style);
  const svg = renderer(model);
  const bytes = Buffer.byteLength(svg, "utf8");
  if (bytes > SIZE_LIMITS.hardMax) {
    throw new Error(
      `Rendered SVG is ${bytes} bytes, exceeding the ${SIZE_LIMITS.hardMax}-byte ceiling. Reduce columns/rows or disable animation.`
    );
  }
  return { svg, bytes };
}

// src/renderers/frames.ts
var DEFAULT_FPS = 20;
var MIN_FPS = 1;
var MAX_FPS = 50;
var STATIC_DELAY_MS = 2e3;
function frameTheme(model) {
  return model.config.theme === "dark" ? "dark" : "light";
}
function buildFrameSequence(input, options = {}) {
  const model = normalizeChartModel(input);
  const theme = frameTheme(model);
  const anim = model.config.animation;
  if (model.config.style !== "contributions") {
    return buildGenericSequence(model, theme, options);
  }
  const geo = contribGeometry(model);
  const heights = [];
  for (let j = 0; j < geo.cols; j += 1) {
    const bucket = model.buckets[j];
    heights.push(bucket ? columnHeight(model, bucket.cumulative) : 0);
  }
  if (anim.mode === "none") {
    const svg = renderContributions(model, { exposed: heights });
    return { frames: [{ svg, delayMs: STATIC_DELAY_MS }], loop: false, theme };
  }
  const fps = clampFps(options.fps ?? DEFAULT_FPS);
  const timeline = resolveTimeline(anim);
  const schedules = [];
  for (let j = 0; j < geo.cols; j += 1) {
    const h = heights[j] ?? 0;
    if (h <= 0) {
      schedules.push([{ pct: 0, exposed: 0 }]);
      continue;
    }
    const window = columnWindow(j, geo.cols, anim, timeline);
    schedules.push(
      columnSchedule({
        style: anim.style,
        easing: anim.easing,
        height: h,
        index: j,
        columns: geo.cols,
        rows: geo.rows,
        window,
        cascadeColumnFrac: 0,
        cascadeRowFrac: 0
      })
    );
  }
  const loop = anim.mode === "loop";
  const delayMs = Math.max(20, Math.round(1e3 / fps));
  const frame = (pct, holdMs = delayMs) => ({
    // `pct` is a position on the cycle (0–100); the freeze context expresses it
    // as a fraction so `renderHeader` bakes the `animate_total` reveal opacity at
    // the same cycle position the CSS keyframes would (contributions frames use
    // their own exposed-cell path and never enter the generic freeze branch).
    svg: withFreeze(
      pct / 100,
      () => renderContributions(model, {
        exposed: schedules.map((schedule) => exposedAt(schedule, pct))
      })
    ),
    delayMs: holdMs
  });
  const frames = [];
  if (loop) {
    const span2 = timeline.cycleSeconds;
    const frameCount = Math.max(2, Math.round(span2 * fps));
    for (let i = 0; i < frameCount; i += 1) {
      const seconds2 = i / frameCount * span2;
      frames.push(frame(seconds2 / timeline.cycleSeconds * 100));
    }
    return { frames, loop, theme };
  }
  const span = anim.delaySeconds + timeline.cycleSeconds;
  const buildFrames = Math.max(1, Math.round(span * fps));
  for (let i = 0; i < buildFrames; i += 1) {
    const seconds2 = i / buildFrames * span;
    frames.push(frame(cyclePercentOnce(seconds2, anim.delaySeconds, timeline)));
  }
  frames.push({
    svg: withFreeze(1, () => renderContributions(model, { exposed: heights })),
    delayMs: STATIC_DELAY_MS
  });
  return { frames, loop, theme };
}
function buildGenericSequence(model, theme, options) {
  const anim = model.config.animation;
  const renderer = getRenderer(model.config.style);
  const still = staticModel(model);
  if (anim.mode === "none") {
    return {
      frames: [{ svg: renderer(still), delayMs: STATIC_DELAY_MS }],
      loop: false,
      theme
    };
  }
  const fps = clampFps(options.fps ?? DEFAULT_FPS);
  const timeline = resolveTimeline(anim);
  const delayMs = Math.max(20, Math.round(1e3 / fps));
  const loop = anim.mode === "loop";
  const frozen = (cycleFrac) => ({
    svg: withFreeze(cycleFrac, () => renderer(model)),
    delayMs
  });
  const frames = [];
  if (loop) {
    const span2 = timeline.cycleSeconds;
    const frameCount = Math.max(2, Math.round(span2 * fps));
    for (let i = 0; i < frameCount; i += 1) {
      const seconds2 = i / frameCount * span2;
      frames.push(frozen(seconds2 / timeline.cycleSeconds));
    }
    return { frames, loop, theme };
  }
  const span = anim.delaySeconds + timeline.cycleSeconds;
  const buildFrames = Math.max(1, Math.round(span * fps));
  for (let i = 0; i < buildFrames; i += 1) {
    const seconds2 = i / buildFrames * span;
    const effective = seconds2 - anim.delaySeconds;
    const cycleFrac = effective <= 0 ? 0 : Math.min(1, effective / timeline.cycleSeconds);
    frames.push(frozen(cycleFrac));
  }
  frames.push({ svg: renderer(still), delayMs: STATIC_DELAY_MS });
  return { frames, loop, theme };
}
function staticModel(model) {
  return {
    ...model,
    config: {
      ...model.config,
      animation: { ...model.config.animation, mode: "none" }
    }
  };
}
function cyclePercentOnce(seconds2, delaySeconds, timeline) {
  const effective = seconds2 - delaySeconds;
  if (effective <= 0) {
    return 0;
  }
  const fraction = Math.min(1, effective / timeline.cycleSeconds);
  return fraction * 100;
}
function exposedAt(schedule, pct) {
  let exposed = 0;
  for (const step of schedule) {
    if (step.pct <= pct) {
      exposed = step.exposed;
    } else {
      break;
    }
  }
  return exposed;
}
function clampFps(fps) {
  if (!Number.isFinite(fps)) {
    return DEFAULT_FPS;
  }
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)));
}

// src/renderers/gif.ts
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path3 from "node:path";

// node_modules/@resvg/resvg-wasm/index.mjs
var wasm;
var heap = new Array(128).fill(void 0);
heap.push(void 0, null, true, false);
var heap_next = heap.length;
function addHeapObject(obj) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
function getObject(idx) {
  return heap[idx];
}
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
var WASM_VECTOR_LEN = 0;
var cachedUint8Memory0 = null;
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
var cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: () => {
  throw Error("TextEncoder not available");
} };
var encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
  return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
  const buf = cachedTextEncoder.encode(arg);
  view.set(buf);
  return {
    read: arg.length,
    written: buf.length
  };
};
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function isLikeNone(x2) {
  return x2 === void 0 || x2 === null;
}
var cachedInt32Memory0 = null;
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
var cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: () => {
  throw Error("TextDecoder not available");
} };
if (typeof TextDecoder !== "undefined") {
  cachedTextDecoder.decode();
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
  return instance.ptr;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
var BBoxFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_bbox_free(ptr >>> 0));
var BBox = class _BBox {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_BBox.prototype);
    obj.__wbg_ptr = ptr;
    BBoxFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    BBoxFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_bbox_free(ptr);
  }
  /**
  * @returns {number}
  */
  get x() {
    const ret = wasm.__wbg_get_bbox_x(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set x(arg0) {
    wasm.__wbg_set_bbox_x(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get y() {
    const ret = wasm.__wbg_get_bbox_y(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set y(arg0) {
    wasm.__wbg_set_bbox_y(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get width() {
    const ret = wasm.__wbg_get_bbox_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set width(arg0) {
    wasm.__wbg_set_bbox_width(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get height() {
    const ret = wasm.__wbg_get_bbox_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set height(arg0) {
    wasm.__wbg_set_bbox_height(this.__wbg_ptr, arg0);
  }
};
var RenderedImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_renderedimage_free(ptr >>> 0));
var RenderedImage = class _RenderedImage {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_RenderedImage.prototype);
    obj.__wbg_ptr = ptr;
    RenderedImageFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RenderedImageFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_renderedimage_free(ptr);
  }
  /**
  * Get the PNG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.renderedimage_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Get the PNG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.renderedimage_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Write the image data to Uint8Array
  * @returns {Uint8Array}
  */
  asPng() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.renderedimage_asPng(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the RGBA pixels of the image
  * @returns {Uint8Array}
  */
  get pixels() {
    const ret = wasm.renderedimage_pixels(this.__wbg_ptr);
    return takeObject(ret);
  }
};
var ResvgFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_resvg_free(ptr >>> 0));
var Resvg = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ResvgFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_resvg_free(ptr);
  }
  /**
  * @param {Uint8Array | string} svg
  * @param {string | undefined} [options]
  * @param {Array<any> | undefined} [custom_font_buffers]
  */
  constructor(svg, options, custom_font_buffers) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      var ptr0 = isLikeNone(options) ? 0 : passStringToWasm0(options, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len0 = WASM_VECTOR_LEN;
      wasm.resvg_new(retptr, addHeapObject(svg), ptr0, len0, isLikeNone(custom_font_buffers) ? 0 : addHeapObject(custom_font_buffers));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      this.__wbg_ptr = r0 >>> 0;
      return this;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the SVG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.resvg_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * Get the SVG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.resvg_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * Renders an SVG in Wasm
  * @returns {RenderedImage}
  */
  render() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_render(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return RenderedImage.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Output usvg-simplified SVG string
  * @returns {string}
  */
  toString() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_toString(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  *
  * Note: path bounding box are approx values.
  * @returns {BBox | undefined}
  */
  innerBBox() {
    const ret = wasm.resvg_innerBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  * This will first apply transform.
  * Similar to `SVGGraphicsElement.getBBox()` DOM API.
  * @returns {BBox | undefined}
  */
  getBBox() {
    const ret = wasm.resvg_getBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Use a given `BBox` to crop the svg. Currently this method simply changes
  * the viewbox/size of the svg and do not move the elements for simplicity
  * @param {BBox} bbox
  */
  cropByBBox(bbox) {
    _assertClass(bbox, BBox);
    wasm.resvg_cropByBBox(this.__wbg_ptr, bbox.__wbg_ptr);
  }
  /**
  * @returns {Array<any>}
  */
  imagesToResolve() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_imagesToResolve(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * @param {string} href
  * @param {Uint8Array} buffer
  */
  resolveImage(href, buffer) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(href, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.resvg_resolveImage(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(buffer));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      if (r1) {
        throw takeObject(r0);
      }
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
};
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get("Content-Type") != "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_new_28c511d9baebfa89 = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_values_839f3396d5aac002 = function(arg0) {
    const ret = getObject(arg0).values();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_196c84450b364254 = function() {
    return handleError(function(arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof obj === "string" ? obj : void 0;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
    const ret = new Array();
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
    const ret = getObject(arg0).push(getObject(arg1));
    return ret;
  };
  imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
function __wbg_init_memory(imports, maybe_memory) {
}
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
async function __wbg_init(input) {
  if (wasm !== void 0)
    return wasm;
  if (typeof input === "undefined") {
    input = new URL("index_bg.wasm", void 0);
  }
  const imports = __wbg_get_imports();
  if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) {
    input = fetch(input);
  }
  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module);
}
var dist_default = __wbg_init;
var initialized = false;
var initWasm = async (module_or_path) => {
  if (initialized) {
    throw new Error("Already initialized. The `initWasm()` function can be used only once.");
  }
  await dist_default(await module_or_path);
  initialized = true;
};
var Resvg2 = class extends Resvg {
  /**
   * @param {Uint8Array | string} svg
   * @param {ResvgRenderOptions | undefined} options
   */
  constructor(svg, options) {
    if (!initialized)
      throw new Error("Wasm has not been initialized. Call `initWasm()` function.");
    const font = options?.font;
    if (!!font && isCustomFontsOptions(font)) {
      const serializableOptions = {
        ...options,
        font: {
          ...font,
          fontBuffers: void 0
        }
      };
      super(svg, JSON.stringify(serializableOptions), font.fontBuffers);
    } else {
      super(svg, JSON.stringify(options));
    }
  }
};
function isCustomFontsOptions(value) {
  return Object.prototype.hasOwnProperty.call(value, "fontBuffers");
}

// src/renderers/gif.ts
var import_gifenc = __toESM(require_gifenc(), 1);
var THEME_BACKGROUND = {
  light: "#ffffff",
  dark: "#0d1117"
};
var FALLBACK_FONT_FAMILY = "Roboto";
var MIN_WIDTH = 100;
var MAX_WIDTH = 2400;
var wasmReady = null;
var fontBuffer = null;
var symbolFontBuffer = null;
async function renderChartGif(input, options = {}) {
  const model = normalizeChartModel(input);
  await ensureRuntime();
  const sequence = buildFrameSequence(model, options);
  const background = resolveBackground2(model, sequence.theme);
  const targetWidth = clampWidth(options.width ?? model.config.width);
  const fontBuffers = [fontBuffer, symbolFontBuffer].filter(
    (buffer2) => buffer2 !== null
  );
  const rendered = sequence.frames.map((frame) => {
    const flattened = flattenThemeVars(frame.svg, model, sequence.theme);
    const resvg = new Resvg2(flattened, {
      background,
      fitTo: { mode: "width", value: targetWidth },
      font: fontBuffers.length > 0 ? {
        fontBuffers,
        defaultFontFamily: FALLBACK_FONT_FAMILY,
        loadSystemFonts: false
      } : { loadSystemFonts: false }
    });
    const image = resvg.render();
    const pixels = new Uint8Array(image.pixels);
    const result = {
      pixels,
      width: image.width,
      height: image.height,
      delayMs: frame.delayMs
    };
    image.free();
    resvg.free();
    return result;
  });
  const first = rendered[0];
  if (!first) {
    throw new Error("GIF rendering produced no frames.");
  }
  const { width, height } = first;
  const paletteSource = rendered[rendered.length - 1] ?? first;
  const palette = (0, import_gifenc.quantize)(paletteSource.pixels, 256, { format: "rgb565" });
  const encoder = (0, import_gifenc.GIFEncoder)();
  rendered.forEach((frame, index) => {
    const indexed = (0, import_gifenc.applyPalette)(frame.pixels, palette, "rgb565");
    encoder.writeFrame(indexed, frame.width, frame.height, {
      ...index === 0 ? { palette, repeat: sequence.loop ? 0 : -1, first: true } : {},
      delay: frame.delayMs
    });
  });
  encoder.finish();
  const buffer = encoder.bytes();
  return {
    buffer,
    width,
    height,
    frameCount: rendered.length,
    loop: sequence.loop,
    bytes: buffer.byteLength
  };
}
function resolveBackground2(model, theme) {
  return model.config.background === "transparent" ? THEME_BACKGROUND[theme] : model.config.background;
}
function clampWidth(width) {
  if (!Number.isFinite(width)) {
    return MIN_WIDTH;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
async function ensureRuntime() {
  if (!wasmReady) {
    wasmReady = loadWasm();
  }
  await wasmReady;
}
async function loadWasm() {
  const wasm2 = await loadAsset(
    ["resvg.wasm"],
    () => resolveFromNodeModules("@resvg/resvg-wasm", "index_bg.wasm")
  );
  await initWasm(wasm2);
  fontBuffer = await loadAsset(
    [
      "roboto.ttf",
      "../assets/fonts/Roboto-Regular.ttf",
      "../../assets/fonts/Roboto-Regular.ttf"
    ],
    () => void 0
  ).catch(() => null);
  symbolFontBuffer = await loadAsset(
    [
      "symbols.ttf",
      "../assets/fonts/StarChartSymbols-Regular.ttf",
      "../../assets/fonts/StarChartSymbols-Regular.ttf"
    ],
    () => void 0
  ).catch(() => null);
}
async function loadAsset(relativePaths, fallback) {
  const here = path3.dirname(fileURLToPath(import.meta.url));
  const candidates = relativePaths.map((rel) => path3.resolve(here, rel));
  const extra = fallback();
  if (extra) {
    candidates.push(extra);
  }
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
    }
  }
  throw new Error(
    `Could not locate a required GIF asset (tried: ${candidates.join(", ")}).`
  );
}
function resolveFromNodeModules(pkg, file) {
  try {
    const require2 = createRequire(import.meta.url);
    return require2.resolve(pkg + "/" + file);
  } catch {
    return void 0;
  }
}

// src/outputs.ts
var INFINITE_GROWTH = "\u221E";
function formatGrowthPercentage(baseline, added) {
  if (baseline > 0) {
    return `${(added / baseline * 100).toFixed(2)}%`;
  }
  return added > 0 ? INFINITE_GROWTH : "0.00%";
}
function buildPictureSnippet(options) {
  const width = typeof options.width === "number" && Number.isFinite(options.width) ? ` width="${Math.round(options.width)}"` : "";
  return [
    "<picture>",
    `  <source media="(prefers-color-scheme: dark)" srcset="${escapeAttr(options.darkPath)}">`,
    `  <img alt="${escapeAttr(options.alt)}" src="${escapeAttr(options.lightPath)}"${width}>`,
    "</picture>"
  ].join("\n");
}
function chartAltText(model) {
  const subject = model.config.title ?? model.metadata.fullName;
  return stripControls(`Star history for ${subject}`);
}
function buildOutputs(model, options) {
  const light = options.chartPathLight ?? "";
  const dark = options.chartPathDark ?? "";
  const dual = light !== "" && dark !== "";
  return {
    chartPath: options.chartPath,
    chartPathLight: light,
    chartPathDark: dark,
    stars: model.currentStars,
    starsAdded: model.windowAdded,
    growthPercentage: formatGrowthPercentage(model.baseline, model.windowAdded),
    peakGain: model.peakGain,
    periodStart: model.periodStart,
    periodEnd: model.periodEnd,
    pictureSnippet: dual ? buildPictureSnippet({
      lightPath: light,
      darkPath: dark,
      alt: chartAltText(model),
      width: model.config.width
    }) : ""
  };
}
var OUTPUT_NAMES = [
  "chart_path",
  "chart_path_light",
  "chart_path_dark",
  "stars",
  "stars_added",
  "growth_percentage",
  "peak_gain",
  "period_start",
  "period_end",
  "picture_snippet"
];
function outputEntries(outputs) {
  return [
    ["chart_path", outputs.chartPath],
    ["chart_path_light", outputs.chartPathLight],
    ["chart_path_dark", outputs.chartPathDark],
    ["stars", String(outputs.stars)],
    ["stars_added", String(outputs.starsAdded)],
    ["growth_percentage", outputs.growthPercentage],
    ["peak_gain", String(outputs.peakGain)],
    ["period_start", outputs.periodStart],
    ["period_end", outputs.periodEnd],
    ["picture_snippet", outputs.pictureSnippet]
  ];
}

// src/api/errors.ts
var ApiError = class extends Error {
  status;
  operation;
  constructor(message, operation, status) {
    super(message);
    this.name = "ApiError";
    this.operation = operation;
    this.status = status;
  }
};

// src/lib.ts
function renderStarChart(config, metadata, history, asOf) {
  const model = buildChartModel(config, metadata, history, { asOf });
  return renderChart(model).svg;
}
function renderMultiRepositoryStarChart(config, sources, asOf) {
  return renderChart(buildMultiRepositoryChartModel(config, sources, { asOf })).svg;
}
export {
  ApiError,
  ConfigError,
  DARK_PALETTE,
  DEFAULT_AXIS_FONT_SIZE,
  DEFAULT_COLUMNS,
  DEFAULT_DUAL_THEME,
  DEFAULT_ROWS,
  HistoryError,
  INFINITE_GROWTH,
  LIGHT_PALETTE,
  MAX_REPOSITORIES,
  OUTPUT_NAMES,
  PERIOD_WEEKS,
  PathValidationError,
  RenderError,
  SIZE_LIMITS,
  aggregateDisplayName,
  aggregateHistories,
  aggregateMetadata,
  applyOverrides,
  basePalette,
  bucketWindow,
  buildChartModel,
  buildFrameSequence,
  buildMultiRepositoryChartModel,
  buildOutputs,
  buildPictureSnippet,
  chartAltText,
  columnHeight,
  configDualTheme,
  configRepositories,
  contribGeometry,
  deriveDualPaths,
  formatGrowthPercentage,
  frameTheme,
  getRenderer,
  normalizeChartConfig,
  normalizeChartModel,
  normalizeHistory,
  outputEntries,
  outputFormat,
  parseInputs,
  parseRepositories,
  renderChart,
  renderChartGif,
  renderMultiRepositoryStarChart,
  renderStarChart,
  selectWindow,
  tipClassFromTop,
  utcWeekStart,
  validateOutputPath
};
