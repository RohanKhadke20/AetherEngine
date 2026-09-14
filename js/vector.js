/**
 * Native 2D Vector mathematics library for physics sandbox simulation.
 * Implements standard vector calculations for velocity, acceleration, and distance.
 */
export class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    copy() {
        return new Vector2D(this.x, this.y);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    div(n) {
        if (n !== 0) {
            this.x /= n;
            this.y /= n;
        }
        return this;
    }

    magSq() {
        return this.x * this.x + this.y * this.y;
    }

    mag() {
        return Math.sqrt(this.magSq());
    }

    normalize() {
        const m = this.mag();
        if (m !== 0) {
            this.div(m);
        }
        return this;
    }

    limit(max) {
        const mSq = this.magSq();
        if (mSq > max * max) {
            this.normalize().mult(max);
        }
        return this;
    }

    setMag(n) {
        return this.normalize().mult(n);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distSq(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }

    heading() {
        return Math.atan2(this.y, this.x);
    }

    // Zero-allocation in-place mutation methods for high-frequency physics loops
    copyFrom(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    addInPlace(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    subInPlace(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    multInPlace(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    // Static operations for non-mutating calculations
    static add(v1, v2) {
        return new Vector2D(v1.x + v2.x, v1.y + v2.y);
    }

    static sub(v1, v2) {
        return new Vector2D(v1.x - v2.x, v1.y - v2.y);
    }

    static mult(v, n) {
        return new Vector2D(v.x * n, v.y * n);
    }

    static div(v, n) {
        if (n === 0) return new Vector2D(0, 0);
        return new Vector2D(v.x / n, v.y / n);
    }

    static dist(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static distSq(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        return dx * dx + dy * dy;
    }

    static random2D() {
        const angle = Math.random() * Math.PI * 2;
        return new Vector2D(Math.cos(angle), Math.sin(angle));
    }
}
