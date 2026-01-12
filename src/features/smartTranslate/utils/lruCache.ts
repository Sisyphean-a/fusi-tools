/**
 * LRU (Least Recently Used) 缓存实现
 * 提供高效的缓存管理，自动淘汰最少使用的项
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存值，如果不存在返回 undefined
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // 将访问的项移到最后（最近使用）
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   */
  set(key: K, value: V): void {
    // 如果键已存在，先删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 添加新项
    this.cache.set(key, value);

    // 如果超过最大容量，删除最旧的项（第一个）
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * 检查缓存中是否存在指定键
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取当前缓存大小
   * @returns 缓存项数量
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 删除指定缓存项
   * @param key 缓存键
   * @returns 是否成功删除
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}
