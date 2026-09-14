#pragma once

#include "vector2d.hpp"
#include "arena.hpp"
#include <vector>
#include <algorithm>
#include <cmath>

namespace aether {

/**
 * @brief Represents a celestial mass body in the simulation.
 */
struct CelestialBody {
    Vector2D position{0.0, 0.0};
    Vector2D velocity{0.0, 0.0};
    Vector2D acceleration{0.0, 0.0};
    double mass{100.0};
    double radius{10.0};
    bool active{true};
    bool isCore{false};

    constexpr CelestialBody() noexcept = default;
    constexpr CelestialBody(Vector2D pos, Vector2D vel, double m, double r, bool core = false) noexcept
        : position(pos), velocity(vel), mass(m), radius(r), active(true), isCore(core) {}
};

/**
 * @brief High-throughput Newtonian Gravity Solver using contiguous arena memory.
 */
class PhysicsSolver {
public:
    explicit PhysicsSolver(double gravityConstant = 0.15) noexcept
        : m_G(gravityConstant) {}

    /**
     * @brief Computes pairwise gravitational forces and resolves inelastic merging.
     */
    void step(CelestialBody* bodies, std::size_t count, double dt) noexcept {
        if (!bodies || count == 0) return;

        // 1. Reset dynamic accelerations
        for (std::size_t i = 0; i < count; ++i) {
            if (!bodies[i].active) continue;
            bodies[i].acceleration = {0.0, 0.0};
        }

        // 2. Pairwise N-Body Gravitational Interaction
        for (std::size_t i = 0; i < count; ++i) {
            if (!bodies[i].active) continue;

            for (std::size_t j = i + 1; j < count; ++j) {
                if (!bodies[j].active) continue;

                Vector2D diff = bodies[j].position - bodies[i].position;
                double distSq = diff.magSq();

                // Collision Detection & Coalescence (Inelastic Merging)
                double minRadius = bodies[i].radius + bodies[j].radius;
                if (distSq <= minRadius * minRadius) {
                    mergeBodies(bodies[i], bodies[j]);
                    continue;
                }

                // Minimum gravitational softening distance to avoid singularity infinities
                double softenedDistSq = std::max(distSq, 100.0);
                double distance = std::sqrt(softenedDistSq);
                double forceMag = (m_G * bodies[i].mass * bodies[j].mass) / softenedDistSq;

                Vector2D forceDir = diff / distance;
                Vector2D force = forceDir * forceMag;

                // F = m * a  ==>  a = F / m
                if (!bodies[i].isCore) {
                    bodies[i].acceleration += force / bodies[i].mass;
                }
                if (!bodies[j].isCore) {
                    bodies[j].acceleration -= force / bodies[j].mass;
                }
            }
        }

        // 3. Symplectic Euler / Verlet integration step
        for (std::size_t i = 0; i < count; ++i) {
            if (!bodies[i].active || bodies[i].isCore) continue;

            bodies[i].velocity += bodies[i].acceleration * dt;
            bodies[i].position += bodies[i].velocity * dt;
        }
    }

    /**
     * @brief Perfectly inelastic merger conserving linear momentum and mass.
     */
    void mergeBodies(CelestialBody& primary, CelestialBody& secondary) noexcept {
        if (!primary.active || !secondary.active) return;

        double totalMass = primary.mass + secondary.mass;
        
        // Momentum conservation: v_new = (m1*v1 + m2*v2) / (m1 + m2)
        Vector2D totalMomentum = (primary.velocity * primary.mass) + (secondary.velocity * secondary.mass);
        primary.velocity = totalMomentum / totalMass;

        // Center of mass position: r_new = (m1*r1 + m2*r2) / (m1 + m2)
        primary.position = ((primary.position * primary.mass) + (secondary.position * secondary.mass)) / totalMass;
        primary.mass = totalMass;

        // Volume-conserving radius expansion: r = cbrt(r1^3 + r2^3)
        primary.radius = std::cbrt(std::pow(primary.radius, 3.0) + std::pow(secondary.radius, 3.0));

        // Mark secondary body as absorbed/inactive
        secondary.active = false;
    }

    void setGravityConstant(double g) noexcept { m_G = g; }
    [[nodiscard]] double gravityConstant() const noexcept { return m_G; }

private:
    double m_G;
};

} // namespace aether
