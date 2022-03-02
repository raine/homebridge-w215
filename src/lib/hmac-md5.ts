export class HMACMD5 {

  public static hex_hmac_md5(k, d) {
    return HMACMD5.rstr2hex(HMACMD5.rstr_hmac_md5(HMACMD5.str2rstr_utf8(k), HMACMD5.str2rstr_utf8(d)));
  }

  /*
  * Calculate the HMAC-MD5, of a key and some data (raw strings)
  */
  private static rstr_hmac_md5(key, data) {
    let bkey = HMACMD5.rstr2binl(key);
    if (bkey.length > 16) {
      bkey = HMACMD5.binl_md5(bkey, key.length * 8);
    }

    const ipad = Array(16), opad = Array(16);
    for (let i = 0; i < 16; i++) {
      ipad[i] = bkey[i] ^ 0x36363636;
      opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }

    const hash = HMACMD5.binl_md5(ipad.concat(HMACMD5.rstr2binl(data)), 512 + data.length * 8);
    return HMACMD5.binl2rstr(HMACMD5.binl_md5(opad.concat(hash), 512 + 128));
  }

  /*
   * Convert a raw string to a hex string
   */
  private static rstr2hex(input) {
    let hexcase = 0;
    try {
      hexcase
    } catch (e) {
      hexcase = 0;
    }
    const hex_tab = hexcase ? '0123456789ABCDEF' : '0123456789abcdef';
    let output = '';
    let x;
    for (let i = 0; i < input.length; i++) {
      x = input.charCodeAt(i);
      output += hex_tab.charAt((x >>> 4) & 0x0F)
        + hex_tab.charAt(x & 0x0F);
    }
    return output;
  }

  /*
   * Encode a string as utf-8.
   * For efficiency, this assumes the input is valid utf-16.
   */
  private static str2rstr_utf8(input) {
    let output = '';
    let i = -1;
    let x, y;

    while (++i < input.length) {
      /* Decode utf-16 surrogate pairs */
      x = input.charCodeAt(i);
      y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
      if (0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF) {
        x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
        i++;
      }

      /* Encode output as utf-8 */
      if (x <= 0x7F) {
        output += String.fromCharCode(x);
      } else if (x <= 0x7FF) {
        output += String.fromCharCode(0xC0 | ((x >>> 6) & 0x1F),
          0x80 | (x & 0x3F));
      } else if (x <= 0xFFFF) {
        output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
          0x80 | ((x >>> 6) & 0x3F),
          0x80 | (x & 0x3F));
      } else if (x <= 0x1FFFFF) {
        output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
          0x80 | ((x >>> 12) & 0x3F),
          0x80 | ((x >>> 6) & 0x3F),
          0x80 | (x & 0x3F));
      }
    }
    return output;
  }

  /*
   * Convert a raw string to an array of little-endian words
   * Characters >255 have their high-byte silently ignored.
   */
  private static rstr2binl(input) {
    let i;
    const output = Array(input.length >> 2);
    for (i = 0; i < output.length; i++) {
      output[i] = 0;
    }
    for (i = 0; i < input.length * 8; i += 8) {
      output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
    }
    return output;
  }

  /*
   * Convert an array of little-endian words to a string
   */
  private static binl2rstr(input) {
    let output = '';
    for (let i = 0; i < input.length * 32; i += 8) {
      output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
    }
    return output;
  }

  /*
   * Calculate the MD5 of an array of little-endian words, and a bit length.
   */
  private static binl_md5(x, len) {
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;

    for (let i = 0; i < x.length; i += 16) {
      const olda = a;
      const oldb = b;
      const oldc = c;
      const oldd = d;

      a = HMACMD5.md5_ff(a, b, c, d, x[i], 7, -680876936);
      d = HMACMD5.md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = HMACMD5.md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = HMACMD5.md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = HMACMD5.md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = HMACMD5.md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = HMACMD5.md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = HMACMD5.md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = HMACMD5.md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = HMACMD5.md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = HMACMD5.md5_ff(c, d, a, b, x[i + 10], 17, -42063);
      b = HMACMD5.md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = HMACMD5.md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = HMACMD5.md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = HMACMD5.md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = HMACMD5.md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

      a = HMACMD5.md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = HMACMD5.md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = HMACMD5.md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = HMACMD5.md5_gg(b, c, d, a, x[i], 20, -373897302);
      a = HMACMD5.md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = HMACMD5.md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = HMACMD5.md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = HMACMD5.md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = HMACMD5.md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = HMACMD5.md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = HMACMD5.md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = HMACMD5.md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = HMACMD5.md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = HMACMD5.md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = HMACMD5.md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = HMACMD5.md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

      a = HMACMD5.md5_hh(a, b, c, d, x[i + 5], 4, -378558);
      d = HMACMD5.md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = HMACMD5.md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = HMACMD5.md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = HMACMD5.md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = HMACMD5.md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = HMACMD5.md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = HMACMD5.md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = HMACMD5.md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = HMACMD5.md5_hh(d, a, b, c, x[i], 11, -358537222);
      c = HMACMD5.md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = HMACMD5.md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = HMACMD5.md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = HMACMD5.md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = HMACMD5.md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = HMACMD5.md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

      a = HMACMD5.md5_ii(a, b, c, d, x[i], 6, -198630844);
      d = HMACMD5.md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = HMACMD5.md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = HMACMD5.md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = HMACMD5.md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = HMACMD5.md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = HMACMD5.md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = HMACMD5.md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = HMACMD5.md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = HMACMD5.md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = HMACMD5.md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = HMACMD5.md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = HMACMD5.md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = HMACMD5.md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = HMACMD5.md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = HMACMD5.md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

      a = HMACMD5.safe_add(a, olda);
      b = HMACMD5.safe_add(b, oldb);
      c = HMACMD5.safe_add(c, oldc);
      d = HMACMD5.safe_add(d, oldd);
    }
    return Array(a, b, c, d);
  }

  /*
   * These functions implement the four basic operations the algorithm uses.
   */
  private static md5_cmn(q, a, b, x, s, t) {
    return HMACMD5.safe_add(HMACMD5.bit_rol(HMACMD5.safe_add(HMACMD5.safe_add(a, q), HMACMD5.safe_add(x, t)), s), b);
  }

  private static md5_ff(a, b, c, d, x, s, t) {
    return HMACMD5.md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  private static md5_gg(a, b, c, d, x, s, t) {
    return HMACMD5.md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  private static md5_hh(a, b, c, d, x, s, t) {
    return HMACMD5.md5_cmn(b ^ c ^ d, a, b, x, s, t);
  }

  private static md5_ii(a, b, c, d, x, s, t) {
    return HMACMD5.md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   */
  private static safe_add(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  private static bit_rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }

}
