#pragma once

#include <cmath>
#include <concepts>

namespace aether {

/**
 * @brief High-precision 2D Vector structure with constexpr operations (C++20).
 */
struct Vector2D {
    double x{0.0};
    double y{0.0};

    constexpr Vector2D() noexcept = default;
    constexpr Vector2D(double xVal, double yVal) noexcept : x(xVal), y(yVal) {}

    constexpr Vector2D operator+(const Vector2D& rhs) const noexcept {
        return {x + rhs.x, y + rhs.y};
    }

    constexpr Vector2D operator-(const Vector2D& rhs) const noexcept {
        return {x - rhs.x, y - rhs.y};
    }

    constexpr Vector2D operator*(double scalar) const noexcept {
        return {x * scalar, y * scalar};
    }

    constexpr Vector2D operator/(double scalar) const noexcept {
        if (scalar == 0.0) return {0.0, 0.0};
        return {x / scalar, y / scalar};
    }

    constexpr Vector2D& operator+=(const Vector2D& rhs) noexcept {
        x += rhs.x;
        y += rhs.y;
        return *this;
    }

    constexpr Vector2D& operator-=(const Vector2D& rhs) noexcept {
        x -= rhs.x;
        y -= rhs.y;
        return *this;
    }

    constexpr Vector2D& operator*=(double scalar) noexcept {
        x *= scalar;
        y *= scalar;
        return *this;
    }

    [[nodiscard]] constexpr double magSq() const noexcept {
        return x * x + y * y;
    }

    [[nodiscard]] double mag() const noexcept {
        return std::sqrt(magSq());
    }

    [[nodiscard]] constexpr double dot(const Vector2D& rhs) const noexcept {
        return x * rhs.x + y * rhs.y;
    }

    [[nodiscard]] Vector2D normalized() const noexcept {
        double m = mag();
        if (m == 0.0) return {0.0, 0.0};
        return *this / m;
    }

    [[nodiscard]] double dist(const Vector2D& rhs) const noexcept {
        return (*this - rhs).mag();
    }

    [[nodiscard]] constexpr double distSq(const Vector2D& rhs) const noexcept {
        return (*this - rhs).magSq();
    }
};

} // namespace aether
