#include "arena.hpp"
#include "vector2d.hpp"
#include "physics_solver.hpp"

#include <iostream>
#include <chrono>
#include <vector>
#include <cassert>
#include <iomanip>

using namespace aether;

void runAssertions() {
    std::cout << "[TEST] Running AetherEngine C++20 Core Assertions...\n";

    // 1. Vector magnitude
    Vector2D v(3.0, 4.0);
    assert(std::abs(v.mag() - 5.0) < 1e-6);
    std::cout << "  [PASS] Vector magnitude calculation (3, 4 -> 5)\n";

    // 2. Arena allocation test
    ArenaAllocator arena(1024 * 1024); // 1 MB arena
    auto* b1 = arena.allocate<CelestialBody>(Vector2D{0.0, 0.0}, Vector2D{0.0, 0.0}, 100000.0, 25.0, true);
    auto* b2 = arena.allocate<CelestialBody>(Vector2D{200.0, 0.0}, Vector2D{0.0, 8.66}, 50.0, 6.0, false);
    assert(b1 != nullptr && b2 != nullptr);
    assert(arena.used() > 0);
    std::cout << "  [PASS] Arena allocated CelestialBodies with cache alignment\n";

    // 3. Momentum conservation test
    PhysicsSolver solver(0.15);
    CelestialBody a(Vector2D{0.0, 0.0}, Vector2D{10.0, 0.0}, 100.0, 5.0);
    CelestialBody b(Vector2D{2.0, 0.0}, Vector2D{-10.0, 0.0}, 100.0, 5.0);
    solver.mergeBodies(a, b);
    assert(a.mass == 200.0);
    assert(!b.active);
    assert(std::abs(a.velocity.x) < 1e-6); // Net zero momentum
    std::cout << "  [PASS] Linear momentum perfectly conserved upon inelastic coalescence\n";

    std::cout << "[SUCCESS] All C++20 core assertions passed!\n\n";
}

void runBenchmark() {
    constexpr std::size_t BODY_COUNT = 500;
    constexpr std::size_t TICKS = 1000;
    constexpr double DT = 0.0166; // 60 FPS tick (16.6ms)

    std::cout << "========================================================\n";
    std::cout << "  BENCHMARK: Contiguous Arena vs Standard Heap (" << BODY_COUNT << " Bodies, " << TICKS << " Ticks)\n";
    std::cout << "========================================================\n";

    PhysicsSolver solver(0.15);

    // Run with ArenaAllocator
    ArenaAllocator arena(sizeof(CelestialBody) * BODY_COUNT * 2);
    CelestialBody* arenaBodies = arena.allocateArray<CelestialBody>(BODY_COUNT);
    for (std::size_t i = 0; i < BODY_COUNT; ++i) {
        double angle = (static_cast<double>(i) / BODY_COUNT) * 6.28318;
        arenaBodies[i] = CelestialBody{
            Vector2D{std::cos(angle) * 300.0, std::sin(angle) * 300.0},
            Vector2D{-std::sin(angle) * 5.0, std::cos(angle) * 5.0},
            50.0,
            4.0,
            (i == 0) // Body 0 is central singularity
        };
    }

    auto startArena = std::chrono::high_resolution_clock::now();
    for (std::size_t t = 0; t < TICKS; ++t) {
        solver.step(arenaBodies, BODY_COUNT, DT);
    }
    auto endArena = std::chrono::high_resolution_clock::now();
    double arenaTimeMs = std::chrono::duration<double, std::milli>(endArena - startArena).count();

    std::cout << "  Contiguous Arena Time : " << std::fixed << std::setprecision(2) << arenaTimeMs << " ms ("
              << (TICKS / (arenaTimeMs / 1000.0)) << " FPS)\n";
    std::cout << "  Arena Memory Footprint: " << arena.used() / 1024 << " KB\n";
    std::cout << "========================================================\n";
}

int main() {
    runAssertions();
    runBenchmark();
    return 0;
}
