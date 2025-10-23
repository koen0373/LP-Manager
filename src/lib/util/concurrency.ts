export async function mapWithConcurrency<T, R>(
  items: Iterable<T>,
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<{ index: number; value: R }[]> {
  const arr = Array.from(items);
  const results: { index: number; value: R }[] = [];
  let index = 0;

  async function worker() {
    while (index < arr.length) {
      const currentIndex = index;
      const item = arr[index];
      index += 1;
      try {
        const value = await mapper(item, currentIndex);
        results.push({ index: currentIndex, value });
      } catch (error) {
        console.error(`[concurrency] task ${currentIndex} failed`, error);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, arr.length) }, () => worker());
  await Promise.all(workers);

  return results.sort((a, b) => a.index - b.index);
}
