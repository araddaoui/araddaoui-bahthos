// Ensures browser/DOM globals that pdfjs-dist relies on are present in the
// Node serverless runtime (Vercel). Without these, parsing a PDF throws
// "ReferenceError: DOMMatrix is not defined" and the request dies.
//
// pdfjs-dist's documented Node usage requires DOMMatrix to exist globally.
// Rendering APIs (Path2D / OffscreenCanvas / ImageData) are only needed for
// drawing; we still stub them so accessing them lazily never throws.

interface DOMPointInit {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && isFinite(v);

class DOMMatrixPolyfill {
  private m = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  constructor(init?: string | number[] | DOMPointInit | undefined) {
    if (typeof init === "string") {
      this.parseString(init);
    } else if (Array.isArray(init)) {
      this.setMatrixValues(init);
    } else if (init && typeof init === "object") {
      this.applyPointLike(init);
    }
  }

  private parseString(s: string) {
    const m = s.match(/matrix\(([^)]+)\)/);
    if (!m) return;
    const parts = m[1].split(/[\s,]+/).map(Number);
    if (parts.length >= 6) {
      this.m[0] = parts[0];
      this.m[1] = parts[1];
      this.m[4] = parts[2];
      this.m[5] = parts[3];
      this.m[12] = parts[4] || 0;
      this.m[13] = parts[5] || 0;
    }
  }

  private applyPointLike(p: DOMPointInit) {
    this.m[0] = p.x ?? this.m[0];
    this.m[1] = p.y ?? this.m[1];
    this.m[4] = p.z ?? this.m[4];
    this.m[5] = p.w ?? this.m[5];
  }

  private setMatrixValues(values: number[]) {
    for (let i = 0; i < Math.min(16, values.length); i++) {
      this.m[i] = values[i] || 0;
    }
  }

  get a() { return this.m[0]; }
  get b() { return this.m[1]; }
  get c() { return this.m[2]; }
  get d() { return this.m[3]; }
  get e() { return this.m[4]; }
  get f() { return this.m[5]; }
  get m11() { return this.m[0]; }
  get m12() { return this.m[1]; }
  get m21() { return this.m[2]; }
  get m22() { return this.m[3]; }
  get m41() { return this.m[4]; }
  get m42() { return this.m[5]; }

  set a(v) { this.m[0] = isFiniteNumber(v) ? v : this.m[0]; }
  set b(v) { this.m[1] = isFiniteNumber(v) ? v : this.m[1]; }
  set c(v) { this.m[2] = isFiniteNumber(v) ? v : this.m[2]; }
  set d(v) { this.m[3] = isFiniteNumber(v) ? v : this.m[3]; }
  set e(v) { this.m[4] = isFiniteNumber(v) ? v : this.m[4]; }
  set f(v) { this.m[5] = isFiniteNumber(v) ? v : this.m[5]; }

  multiplySelf(other: DOMMatrixPolyfill) {
    const a = this.m;
    const b = other.m;
    const out = new Float64Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] =
          a[i * 4 + 0] * b[0 + j] +
          a[i * 4 + 1] * b[4 + j] +
          a[i * 4 + 2] * b[8 + j] +
          a[i * 4 + 3] * b[12 + j];
      }
    }
    this.m.set(out);
    return this;
  }

  translate(tx = 0, ty = 0, tz = 0): DOMMatrixPolyfill {
    const out = new DOMMatrixPolyfill();
    out.m.set(this.m);
    out.m[12] = this.m[12] + tx;
    out.m[13] = this.m[13] + ty;
    out.m[14] = this.m[14] + tz;
    return out;
  }

  scale(scaleX = 1, scaleY = scaleX, scaleZ = 1): DOMMatrixPolyfill {
    const out = new DOMMatrixPolyfill();
    out.m[0] = this.m[0] * scaleX;
    out.m[1] = this.m[1] * scaleX;
    out.m[4] = this.m[4] * scaleY;
    out.m[5] = this.m[5] * scaleY;
    out.m[6] = this.m[6] * scaleY;
    out.m[8] = this.m[8] * scaleZ;
    out.m[10] = this.m[10] * scaleZ;
    out.m[12] = this.m[12];
    out.m[13] = this.m[13];
    return out;
  }

  multiply(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
    const out = new DOMMatrixPolyfill();
    out.m.set(this.m);
    return out.multiplySelf(other);
  }

  identity(): DOMMatrixPolyfill {
    this.m.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return this;
  }

  is2D = true;
  isIdentity = true;

  toJSON() {
    return {
      a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f,
    };
  }

  toString() {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

class Path2DPolyfill {
  constructor(path?: unknown) {
    void path;
  }
  addPath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  closePath() {}
  rect() {}
  roundRect() {}
  rectToPoints() { return []; }
}

function defineGlobal(key: string, value: unknown) {
  const g = globalThis as Record<string, unknown>;
  if (!g[key]) {
    try {
      Object.defineProperty(g, key, {
        value,
        configurable: true,
        writable: true,
      });
    } catch {
      g[key] = value;
    }
  }
}

export function ensurePdfDomGlobals() {
  defineGlobal("DOMMatrix", DOMMatrixPolyfill);
  defineGlobal("DOMMatrixReadOnly", DOMMatrixPolyfill);
  defineGlobal("Path2D", Path2DPolyfill);
  defineGlobal("ImageData", class ImageDataPolyfill { data; width; height; constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); } });
  defineGlobal("OffscreenCanvas", class OffscreenCanvasPolyfill { width; height; constructor(width: number, height: number) { this.width = width; this.height = height; } getContext() { return { canvas: this, setTransform() {}, transform() {}, translate() {}, rotate() {}, scale() {}, save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {}, clearRect() {}, getImageData() { return undefined; } }; } convertToBlob() { return Promise.resolve(undefined); } });
}