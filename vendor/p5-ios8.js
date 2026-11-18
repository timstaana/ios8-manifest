/* Speed patches for p5 1.x on iOS 8 Safari, loaded right after p5.js. ES5 only. Measured on the iPad minis.
 *
 * image(): Safari 8 draws an <img> or <video> far faster than a <canvas> (a sprite demo ran at 36 fps from a canvas,
 * 60 fps from an <img>), but p5 keeps every p5.Image in a canvas and copies video frames into one. So:
 *  - each p5.Image gets an <img> copy, made once in the background, used until the image changes (updatePixels,
 *    resize, copy, mask, filter, blend); images changed again and again (pixel effects) just keep using the canvas;
 *  - video is drawn straight from the <video> element.
 * Tinted images, erasing and p5.Graphics take p5's normal path. Set window.p5ios8 = false to turn this off.
 *
 * MediaElement.remove() (and so removeElements()) throws on iOS 8 for <video>/<audio>: it expects srcObject.
 * Typing: iOS autocorrect makes the iPad mini's keyboard slow (measured with real typing: 75 ms from key to screen
 * with it on, 43 ms with it off, and no keys over 100 ms). Text boxes made with createInput() or
 * createElement('textarea'/'input') start with autocorrect, auto-capitals and spellcheck off; turn one back on with
 * input.attribute('autocorrect', 'on'). (Hand-written <input>s in index.html: add autocorrect="off" yourself.)
 *
 * Graphics.remove() throws on iOS 8 (this._pInst._elements is undefined): the canvas is taken out of the page anyway.
 *
 * Colour strings: fill('#2196f3') parsed the string with regexes on every call (~200 us on the A5). A string always
 * means the same colour (whatever colorMode), so each one is parsed once and remembered.
 */
(function () {
  if (!window.p5 || !p5.Renderer2D || !p5.Image) return;
  var R = p5.Renderer2D.prototype, I = p5.Image.prototype, image = R.image, setModified = I.setModified;

  I.setModified = function (v) {
    if (v) { this._fastVer = (this._fastVer || 0) + 1; this._fastImg = null; }
    return setModified.apply(this, arguments);
  };

  function fastImage(img) {
    if (img._fastSkip || img.gifProperties || !img.canvas) return null;
    var ver = img._fastVer || 0;
    if (img._fastImg && img._fastImgVer === ver) return img._fastImg;
    if (img._fastPending === ver) return null;
    if ((img._fastMade = (img._fastMade || 0) + 1) > 3) { img._fastSkip = true; return null; } // keeps changing: leave it
    img._fastPending = ver;
    var el = new Image();
    el.onload = function () { if ((img._fastVer || 0) === ver) { img._fastImg = el; img._fastImgVer = ver; } img._fastPending = -1; };
    try { el.src = img.canvas.toDataURL(); } catch (e) { img._fastSkip = true; } // e.g. an image from another site
    return null;
  }

  if (p5.Color && p5.Color._parseInputs) {
    var parse = p5.Color._parseInputs, parsed = {};
    p5.Color._parseInputs = function (a) {
      if (arguments.length === 1 && typeof a === 'string') { var hit = parsed[a] || (parsed[a] = parse.apply(this, arguments)); return hit.slice(); }
      return parse.apply(this, arguments);
    };
  }

  if (p5.MediaElement) {
    var remove = p5.MediaElement.prototype.remove;
    p5.MediaElement.prototype.remove = function () {
      if (this.elt && this.elt.srcObject === undefined) this.elt.srcObject = null; // iOS 8 has no srcObject
      return remove.apply(this, arguments);
    };
  }

  function quiet(el) {
    var tag = el && el.tagName; if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
    var set = { autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', autocomplete: 'off' };
    for (var k in set) if (!el.hasAttribute(k)) el.setAttribute(k, set[k]);
  }
  var P = p5.prototype, createInput = P.createInput, createElement = P.createElement;
  if (createInput) P.createInput = function () { var r = createInput.apply(this, arguments); if (r) quiet(r.elt); return r; };
  if (createElement) P.createElement = function () { var r = createElement.apply(this, arguments); if (r) quiet(r.elt); return r; };

  if (p5.Graphics) {
    var gRemove = p5.Graphics.prototype.remove;
    p5.Graphics.prototype.remove = function () {
      try { return gRemove.apply(this, arguments); } catch (e) {
        var el = this.elt || this.canvas; if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }

  R.image = function (img, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (img && window.p5ios8 !== false && !this._tint && !this._isErasing) {
      var src = null, scale = 1;
      if (img instanceof p5.Image) { src = fastImage(img); if (src) scale = src.width / img.width; }
      else if (p5.MediaElement && img instanceof p5.MediaElement && img.elt && img.elt.tagName === 'VIDEO' && img.elt.readyState >= 2 && img.width) {
        src = img.elt; scale = src.videoWidth / img.width;
      }
      if (src) {
        try { this.drawingContext.drawImage(src, sx * scale, sy * scale, sw * scale, sh * scale, dx, dy, dw, dh); return; } catch (e) { /* fall back */ }
      }
    }
    return image.apply(this, arguments);
  };
})();
