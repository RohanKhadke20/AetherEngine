cmake_minimum_required(VERSION 3.20)
project(AetherEngineCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Include directories
include_directories(include)

# Source files
set(SOURCES
    src/main.cpp
)

add_executable(aether_core ${SOURCES})

# Compiler warnings and optimization flags
if (MSVC)
    target_compile_options(aether_core PRIVATE /W4 /O2 /permissive-)
else()
    target_compile_options(aether_core PRIVATE -Wall -Wextra -Wpedantic -O3)
endif()
