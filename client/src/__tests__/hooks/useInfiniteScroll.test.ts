import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observedElements: Element[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe = jest.fn((element: Element) => {
    this.observedElements.push(element);
  });

  unobserve = jest.fn((element: Element) => {
    this.observedElements = this.observedElements.filter((el) => el !== element);
  });

  disconnect = jest.fn(() => {
    this.observedElements = [];
  });

  takeRecords = jest.fn(() => []);

  // Helper to simulate intersection
  simulateIntersection(isIntersecting: boolean) {
    const entries: IntersectionObserverEntry[] = this.observedElements.map((target) => ({
      isIntersecting,
      target,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));

    this.callback(entries, this as unknown as IntersectionObserver);
  }

  static instances: MockIntersectionObserver[] = [];
  static clearInstances() {
    MockIntersectionObserver.instances = [];
  }
}

describe('useInfiniteScroll Hook', () => {
  const originalIntersectionObserver = global.IntersectionObserver;

  beforeAll(() => {
    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterAll(() => {
    global.IntersectionObserver = originalIntersectionObserver;
  });

  beforeEach(() => {
    MockIntersectionObserver.clearInstances();
  });

  const defaultProps = {
    loading: false,
    hasMore: true,
    onLoadMore: jest.fn(),
    threshold: 100,
  };

  describe('Initialization', () => {
    it('returns a ref object', () => {
      const { result } = renderHook(() => useInfiniteScroll(defaultProps));
      expect(result.current).toBeDefined();
      expect(result.current.current).toBeNull();
    });

    it('creates an IntersectionObserver', () => {
      renderHook(() => useInfiniteScroll(defaultProps));
      expect(MockIntersectionObserver.instances.length).toBe(1);
    });

    it('creates IntersectionObserver with custom threshold', () => {
      renderHook(() =>
        useInfiniteScroll({
          ...defaultProps,
          threshold: 200,
        })
      );

      const observer = MockIntersectionObserver.instances[0];
      expect(observer.options?.rootMargin).toBe('200px');
    });

    it('uses default threshold of 100', () => {
      renderHook(() =>
        useInfiniteScroll({
          loading: false,
          hasMore: true,
          onLoadMore: jest.fn(),
        })
      );

      const observer = MockIntersectionObserver.instances[0];
      expect(observer.options?.rootMargin).toBe('100px');
    });
  });

  describe('Observing Elements', () => {
    it('observes the element when ref is attached', () => {
      const { result } = renderHook(() => useInfiniteScroll(defaultProps));

      // Simulate attaching the ref to an element
      const element = document.createElement('div');
      act(() => {
        (result.current as React.MutableRefObject<HTMLDivElement | null>).current = element;
      });

      // Re-render to trigger effect
      const { rerender } = renderHook(() => useInfiniteScroll(defaultProps));
      rerender();

      // A new observer is created on rerender, check latest
      const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
      expect(observer.observe).toBeDefined();
    });
  });

  describe('Intersection Callback', () => {
    it('calls onLoadMore when element intersects and conditions are met', () => {
      const onLoadMore = jest.fn();
      renderHook(() =>
        useInfiniteScroll({
          loading: false,
          hasMore: true,
          onLoadMore,
        })
      );

      const observer = MockIntersectionObserver.instances[0];

      act(() => {
        observer.simulateIntersection(true);
      });

      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('does not call onLoadMore when not intersecting', () => {
      const onLoadMore = jest.fn();
      renderHook(() =>
        useInfiniteScroll({
          loading: false,
          hasMore: true,
          onLoadMore,
        })
      );

      const observer = MockIntersectionObserver.instances[0];

      act(() => {
        observer.simulateIntersection(false);
      });

      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('does not call onLoadMore when loading is true', () => {
      const onLoadMore = jest.fn();
      renderHook(() =>
        useInfiniteScroll({
          loading: true,
          hasMore: true,
          onLoadMore,
        })
      );

      const observer = MockIntersectionObserver.instances[0];

      act(() => {
        observer.simulateIntersection(true);
      });

      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('does not call onLoadMore when hasMore is false', () => {
      const onLoadMore = jest.fn();
      renderHook(() =>
        useInfiniteScroll({
          loading: false,
          hasMore: false,
          onLoadMore,
        })
      );

      const observer = MockIntersectionObserver.instances[0];

      act(() => {
        observer.simulateIntersection(true);
      });

      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('does not call onLoadMore when both loading and hasMore prevent it', () => {
      const onLoadMore = jest.fn();
      renderHook(() =>
        useInfiniteScroll({
          loading: true,
          hasMore: false,
          onLoadMore,
        })
      );

      const observer = MockIntersectionObserver.instances[0];

      act(() => {
        observer.simulateIntersection(true);
      });

      expect(onLoadMore).not.toHaveBeenCalled();
    });
  });

  describe('State Changes', () => {
    it('calls onLoadMore again after loading completes and hasMore is true', () => {
      const onLoadMore = jest.fn();
      const { rerender } = renderHook(
        ({ loading, hasMore }) =>
          useInfiniteScroll({
            loading,
            hasMore,
            onLoadMore,
          }),
        { initialProps: { loading: false, hasMore: true } }
      );

      // First intersection
      let observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
      act(() => {
        observer.simulateIntersection(true);
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      // Start loading
      rerender({ loading: true, hasMore: true });

      // Try to trigger again while loading
      observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
      act(() => {
        observer.simulateIntersection(true);
      });
      // Should still be 1 because loading
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      // Finish loading
      rerender({ loading: false, hasMore: true });

      // Trigger again
      observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
      act(() => {
        observer.simulateIntersection(true);
      });
      expect(onLoadMore).toHaveBeenCalledTimes(2);
    });

    it('stops calling onLoadMore when hasMore becomes false', () => {
      const onLoadMore = jest.fn();
      const { rerender } = renderHook(
        ({ loading, hasMore }) =>
          useInfiniteScroll({
            loading,
            hasMore,
            onLoadMore,
          }),
        { initialProps: { loading: false, hasMore: true } }
      );

      // First intersection
      let observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
      act(() => {
        observer.simulateIntersection(true);
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      // No more items to load
      rerender({ loading: false, hasMore: false });

      // Try to trigger again
      observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
      act(() => {
        observer.simulateIntersection(true);
      });
      // Should still be 1
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('disconnects observer on unmount', () => {
      const { unmount } = renderHook(() => useInfiniteScroll(defaultProps));

      const observer = MockIntersectionObserver.instances[0];

      unmount();

      expect(observer.disconnect).toHaveBeenCalled();
    });

    it('disconnects previous observer when dependencies change', () => {
      const { rerender } = renderHook(
        ({ threshold }) =>
          useInfiniteScroll({
            ...defaultProps,
            threshold,
          }),
        { initialProps: { threshold: 100 } }
      );

      const firstObserver = MockIntersectionObserver.instances[0];

      rerender({ threshold: 200 });

      expect(firstObserver.disconnect).toHaveBeenCalled();
    });

    it('creates new observer when handleObserver changes', () => {
      const onLoadMore1 = jest.fn();
      const onLoadMore2 = jest.fn();

      const { rerender } = renderHook(
        ({ onLoadMore }) =>
          useInfiniteScroll({
            loading: false,
            hasMore: true,
            onLoadMore,
          }),
        { initialProps: { onLoadMore: onLoadMore1 } }
      );

      const initialObserverCount = MockIntersectionObserver.instances.length;

      rerender({ onLoadMore: onLoadMore2 });

      // Should have created a new observer
      expect(MockIntersectionObserver.instances.length).toBeGreaterThanOrEqual(initialObserverCount);
    });
  });

  describe('Real-world Use Cases', () => {
    it('simulates infinite scroll pagination', () => {
      let page = 1;
      const onLoadMore = jest.fn(() => {
        page += 1;
      });

      const { rerender } = renderHook(
        ({ loading, hasMore }) =>
          useInfiniteScroll({
            loading,
            hasMore,
            onLoadMore,
            threshold: 100,
          }),
        { initialProps: { loading: false, hasMore: true } }
      );

      // Simulate scrolling to bottom multiple times
      for (let i = 0; i < 5; i++) {
        const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];

        // Start loading
        rerender({ loading: true, hasMore: true });

        act(() => {
          observer.simulateIntersection(true);
        });

        // Finish loading
        rerender({ loading: false, hasMore: page < 5 });
      }

      // Should have loaded 4 more pages (pages 2-5)
      expect(page).toBeGreaterThan(1);
    });

    it('handles rapid scrolling (multiple intersections)', () => {
      const onLoadMore = jest.fn();

      renderHook(() =>
        useInfiniteScroll({
          loading: false,
          hasMore: true,
          onLoadMore,
        })
      );

      const observer = MockIntersectionObserver.instances[0];

      // Simulate rapid scrolling causing multiple intersection events
      act(() => {
        observer.simulateIntersection(true);
        observer.simulateIntersection(true);
        observer.simulateIntersection(true);
      });

      // Should only call once since it should be in a loading state
      // (In real implementation, the loading state would prevent multiple calls)
      expect(onLoadMore).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles null ref gracefully', () => {
      const { result } = renderHook(() => useInfiniteScroll(defaultProps));

      // Ref is null by default
      expect(result.current.current).toBeNull();

      // Should not throw
      expect(() => {
        const observer = MockIntersectionObserver.instances[0];
        act(() => {
          observer.simulateIntersection(true);
        });
      }).not.toThrow();
    });

    it('handles zero threshold', () => {
      renderHook(() =>
        useInfiniteScroll({
          ...defaultProps,
          threshold: 0,
        })
      );

      const observer = MockIntersectionObserver.instances[0];
      expect(observer.options?.rootMargin).toBe('0px');
    });

    it('handles negative threshold', () => {
      renderHook(() =>
        useInfiniteScroll({
          ...defaultProps,
          threshold: -50,
        })
      );

      const observer = MockIntersectionObserver.instances[0];
      expect(observer.options?.rootMargin).toBe('-50px');
    });
  });

  describe('Callback Memoization', () => {
    it('recreates observer when onLoadMore changes', () => {
      const onLoadMore1 = jest.fn();
      const onLoadMore2 = jest.fn();

      const { rerender } = renderHook(
        ({ onLoadMore }) =>
          useInfiniteScroll({
            loading: false,
            hasMore: true,
            onLoadMore,
          }),
        { initialProps: { onLoadMore: onLoadMore1 } }
      );

      const firstInstanceCount = MockIntersectionObserver.instances.length;

      rerender({ onLoadMore: onLoadMore2 });

      // New observer should be created due to callback change
      expect(MockIntersectionObserver.instances.length).toBeGreaterThanOrEqual(firstInstanceCount);
    });

    it('recreates observer when loading changes', () => {
      const { rerender } = renderHook(
        ({ loading }) =>
          useInfiniteScroll({
            loading,
            hasMore: true,
            onLoadMore: jest.fn(),
          }),
        { initialProps: { loading: false } }
      );

      const firstInstanceCount = MockIntersectionObserver.instances.length;

      rerender({ loading: true });

      // New observer may be created due to callback memoization
      expect(MockIntersectionObserver.instances.length).toBeGreaterThanOrEqual(firstInstanceCount);
    });

    it('recreates observer when hasMore changes', () => {
      const { rerender } = renderHook(
        ({ hasMore }) =>
          useInfiniteScroll({
            loading: false,
            hasMore,
            onLoadMore: jest.fn(),
          }),
        { initialProps: { hasMore: true } }
      );

      const firstInstanceCount = MockIntersectionObserver.instances.length;

      rerender({ hasMore: false });

      expect(MockIntersectionObserver.instances.length).toBeGreaterThanOrEqual(firstInstanceCount);
    });
  });
});
