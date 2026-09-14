#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <new>
#include <utility>
#include <stdexcept>
#include <type_traits>

namespace aether {

/**
 * @brief High-performance linear contiguous memory arena allocator (C++20).
 * 
 * Pre-allocates a contiguous memory buffer to eliminate heap fragmentation
 * and malloc/free overhead during high-frequency real-time simulation loops.
 */
class ArenaAllocator {
public:
    explicit ArenaAllocator(std::size_t capacityBytes)
        : m_capacity(capacityBytes),
          m_offset(0),
          m_buffer(std::make_unique<std::byte[]>(capacityBytes)) {}

    ~ArenaAllocator() = default;

    // Non-copyable to prevent double-free or aliasing issues
    ArenaAllocator(const ArenaAllocator&) = delete;
    ArenaAllocator& operator=(const ArenaAllocator&) = delete;

    // Movable
    ArenaAllocator(ArenaAllocator&& other) noexcept
        : m_capacity(other.m_capacity),
          m_offset(other.m_offset),
          m_buffer(std::move(other.m_buffer)) {
        other.m_capacity = 0;
        other.m_offset = 0;
    }

    ArenaAllocator& operator=(ArenaAllocator&& other) noexcept {
        if (this != &other) {
            m_capacity = other.m_capacity;
            m_offset = other.m_offset;
            m_buffer = std::move(other.m_buffer);
            other.m_capacity = 0;
            other.m_offset = 0;
        }
        return *this;
    }

    /**
     * @brief Allocates an object of type T within the arena buffer with proper alignment.
     */
    template <typename T, typename... Args>
    T* allocate(Args&&... args) {
        static_assert(!std::is_array_v<T>, "Array types must use allocateArray");
        
        void* rawPtr = allocateRaw(sizeof(T), alignof(T));
        if (!rawPtr) {
            throw std::bad_alloc();
        }
        return ::new (rawPtr) T(std::forward<Args>(args)...);
    }

    /**
     * @brief Allocates a contiguous array of type T.
     */
    template <typename T>
    T* allocateArray(std::size_t count) {
        if (count == 0) return nullptr;
        void* rawPtr = allocateRaw(sizeof(T) * count, alignof(T));
        if (!rawPtr) {
            throw std::bad_alloc();
        }
        T* arrayPtr = static_cast<T*>(rawPtr);
        for (std::size_t i = 0; i < count; ++i) {
            ::new (&arrayPtr[i]) T();
        }
        return arrayPtr;
    }

    /**
     * @brief Low-level aligned raw memory allocation.
     */
    void* allocateRaw(std::size_t bytes, std::size_t alignment = alignof(std::max_align_t)) {
        std::uintptr_t currentAddress = reinterpret_cast<std::uintptr_t>(m_buffer.get() + m_offset);
        std::size_t padding = (alignment - (currentAddress % alignment)) % alignment;

        if (m_offset + padding + bytes > m_capacity) {
            return nullptr; // Out of arena memory
        }

        m_offset += padding;
        void* ptr = m_buffer.get() + m_offset;
        m_offset += bytes;
        return ptr;
    }

    /**
     * @brief Resets the arena pointer to zero, reclaiming all memory instantly in O(1).
     */
    void clear() noexcept {
        m_offset = 0;
    }

    [[nodiscard]] std::size_t capacity() const noexcept { return m_capacity; }
    [[nodiscard]] std::size_t used() const noexcept { return m_offset; }
    [[nodiscard]] std::size_t available() const noexcept { return m_capacity - m_offset; }

private:
    std::size_t m_capacity;
    std::size_t m_offset;
    std::unique_ptr<std::byte[]> m_buffer;
};

} // namespace aether
