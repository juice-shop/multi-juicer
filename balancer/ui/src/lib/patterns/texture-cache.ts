import { Texture, TextureLoader, RepeatWrapping, LinearFilter } from "three";

export class TextureCache {
  private static instance: TextureCache;
  private cache: Map<string, Promise<Texture>>;
  private loader: TextureLoader;

  private constructor() {
    this.cache = new Map();
    this.loader = new TextureLoader();
  }

  static getInstance(): TextureCache {
    if (!TextureCache.instance) {
      TextureCache.instance = new TextureCache();
    }
    return TextureCache.instance;
  }

  /**
   * Load texture with caching
   * Returns promise that resolves to texture
   */
  async loadTexture(path: string): Promise<Texture> {
    // Check cache
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    // Create promise for loading
    const promise = new Promise<Texture>((resolve, reject) => {
      this.loader.load(
        path,
        (texture) => {
          // Configure texture for pattern repetition
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;

          resolve(texture);
        },
        undefined,
        (error) => {
          console.error(`Failed to load texture: ${path}`, error);
          reject(error);
        }
      );
    });

    this.cache.set(path, promise);
    return promise;
  }

  /**
   * Preload multiple textures
   */
  async preloadTextures(paths: string[]): Promise<Texture[]> {
    return Promise.all(paths.map((path) => this.loadTexture(path)));
  }

  /**
   * Clear cache (for cleanup)
   */
  clear(): void {
    // Dispose textures
    this.cache.forEach((promise) => {
      promise.then((texture) => texture.dispose());
    });
    this.cache.clear();
  }
}
