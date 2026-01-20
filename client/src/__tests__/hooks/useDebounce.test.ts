import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Value', () => {
    it('returns the initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 500));
      expect(result.current).toBe('initial');
    });

    it('returns the initial value for different types', () => {
      const { result: stringResult } = renderHook(() => useDebounce('string', 500));
      expect(stringResult.current).toBe('string');

      const { result: numberResult } = renderHook(() => useDebounce(42, 500));
      expect(numberResult.current).toBe(42);

      const { result: boolResult } = renderHook(() => useDebounce(true, 500));
      expect(boolResult.current).toBe(true);

      const obj = { key: 'value' };
      const { result: objResult } = renderHook(() => useDebounce(obj, 500));
      expect(objResult.current).toBe(obj);
    });

    it('returns null as initial value', () => {
      const { result } = renderHook(() => useDebounce(null, 500));
      expect(result.current).toBeNull();
    });

    it('returns undefined as initial value', () => {
      const { result } = renderHook(() => useDebounce(undefined, 500));
      expect(result.current).toBeUndefined();
    });
  });

  describe('Debounce Behavior', () => {
    it('debounces value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      expect(result.current).toBe('initial');

      // Change the value
      rerender({ value: 'changed', delay: 500 });

      // Value should not change immediately
      expect(result.current).toBe('initial');

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Now the value should be updated
      expect(result.current).toBe('changed');
    });

    it('debounces with custom delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 1000 } }
      );

      rerender({ value: 'changed', delay: 1000 });

      // After 500ms, should still be initial
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(result.current).toBe('initial');

      // After full 1000ms, should be changed
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(result.current).toBe('changed');
    });

    it('resets timer on rapid value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // Change value multiple times rapidly
      rerender({ value: 'change1', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      rerender({ value: 'change2', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      rerender({ value: 'change3', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Should still be initial because timer keeps resetting
      expect(result.current).toBe('initial');

      // After full delay from last change
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(result.current).toBe('change3');
    });

    it('only updates to the most recent value', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 300 } }
      );

      rerender({ value: 'first', delay: 300 });
      rerender({ value: 'second', delay: 300 });
      rerender({ value: 'third', delay: 300 });
      rerender({ value: 'final', delay: 300 });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should jump directly to final
      expect(result.current).toBe('final');
    });
  });

  describe('Delay Changes', () => {
    it('respects delay changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // Change value with 500ms delay
      rerender({ value: 'changed', delay: 500 });

      act(() => {
        jest.advanceTimersByTime(250);
      });

      // Change delay to 100ms
      rerender({ value: 'changed', delay: 100 });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Value should now be updated with new delay
      expect(result.current).toBe('changed');
    });

    it('handles zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 0 } }
      );

      rerender({ value: 'changed', delay: 0 });

      // With 0 delay, should update immediately (after setTimeout with 0)
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(result.current).toBe('changed');
    });
  });

  describe('Type Safety', () => {
    it('maintains type safety for strings', () => {
      const { result } = renderHook(() => useDebounce<string>('test', 500));
      const value: string = result.current;
      expect(typeof value).toBe('string');
    });

    it('maintains type safety for numbers', () => {
      const { result } = renderHook(() => useDebounce<number>(123, 500));
      const value: number = result.current;
      expect(typeof value).toBe('number');
    });

    it('maintains type safety for objects', () => {
      interface TestObject {
        id: number;
        name: string;
      }
      const testObj: TestObject = { id: 1, name: 'test' };
      const { result } = renderHook(() => useDebounce<TestObject>(testObj, 500));
      expect(result.current).toHaveProperty('id');
      expect(result.current).toHaveProperty('name');
    });

    it('maintains type safety for arrays', () => {
      const testArray = [1, 2, 3];
      const { result } = renderHook(() => useDebounce<number[]>(testArray, 500));
      expect(Array.isArray(result.current)).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('clears timeout on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const { unmount, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'changed', delay: 500 });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('clears previous timeout when value changes', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const { rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'change1', delay: 500 });
      rerender({ value: 'change2', delay: 500 });

      // clearTimeout should be called to cancel previous timer
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Real-world Use Cases', () => {
    it('debounces search input', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: '', delay: 300 } }
      );

      // Simulate typing "card"
      rerender({ value: 'c', delay: 300 });
      act(() => jest.advanceTimersByTime(100));

      rerender({ value: 'ca', delay: 300 });
      act(() => jest.advanceTimersByTime(100));

      rerender({ value: 'car', delay: 300 });
      act(() => jest.advanceTimersByTime(100));

      rerender({ value: 'card', delay: 300 });

      // Should still be empty because typing is fast
      expect(result.current).toBe('');

      // After user stops typing
      act(() => jest.advanceTimersByTime(300));

      // Now should show the full search term
      expect(result.current).toBe('card');
    });

    it('debounces filter changes', () => {
      interface Filters {
        search: string;
        type: string;
      }

      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce<Filters>(value, delay),
        {
          initialProps: {
            value: { search: '', type: '' },
            delay: 500,
          },
        }
      );

      rerender({
        value: { search: 'dragon', type: 'monster' },
        delay: 500,
      });

      expect(result.current.search).toBe('');
      expect(result.current.type).toBe('');

      act(() => jest.advanceTimersByTime(500));

      expect(result.current.search).toBe('dragon');
      expect(result.current.type).toBe('monster');
    });
  });

  describe('Edge Cases', () => {
    it('handles very long delays', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 10000 } }
      );

      rerender({ value: 'changed', delay: 10000 });

      act(() => jest.advanceTimersByTime(5000));
      expect(result.current).toBe('initial');

      act(() => jest.advanceTimersByTime(5000));
      expect(result.current).toBe('changed');
    });

    it('handles same value being set multiple times', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'same', delay: 500 } }
      );

      rerender({ value: 'same', delay: 500 });
      rerender({ value: 'same', delay: 500 });
      rerender({ value: 'same', delay: 500 });

      act(() => jest.advanceTimersByTime(500));

      expect(result.current).toBe('same');
    });

    it('handles empty string', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: '', delay: 500 });

      act(() => jest.advanceTimersByTime(500));

      expect(result.current).toBe('');
    });
  });
});
