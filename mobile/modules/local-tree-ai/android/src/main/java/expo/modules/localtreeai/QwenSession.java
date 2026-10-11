package expo.modules.localtreeai;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Model weights are reusable; conversation state must never cross requests. */
public final class QwenSession {
  public interface Backend {
    long create();
    int reset(long handle);
    void destroy(long handle);
  }
  private Backend backend;
  private long handle;
  private final Map<String, String> results;

  public QwenSession(final int capacity) {
    results = new LinkedHashMap<String, String>(capacity, 0.75f, true) {
      @Override protected boolean removeEldestEntry(Map.Entry<String, String> entry) {
        return size() > capacity;
      }
    };
  }
  public synchronized long load(Backend next) {
    if (handle == 0) {
      long loaded = next.create();
      if (loaded == 0) throw new IllegalStateException("Qwen3.5 model could not be loaded");
      backend = next;
      handle = loaded;
    }
    return handle;
  }
  public synchronized void reset() {
    if (handle == 0) return;
    boolean clean = false;
    try {
      clean = backend.reset(handle) == 0;
      if (!clean) throw new IllegalStateException("Could not clear the local inference context. Please retry.");
    } finally { if (!clean) release(false); }
  }
  public static String fingerprint(String prompt, List<byte[]> images) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      append(digest, prompt.getBytes(StandardCharsets.UTF_8));
      for (byte[] image : images) append(digest, image);
      StringBuilder result = new StringBuilder();
      for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
      return result.toString();
    } catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
  }
  private static void append(MessageDigest digest, byte[] bytes) {
    digest.update(ByteBuffer.allocate(8).putLong(bytes.length).array());
    digest.update(bytes);
  }
  public synchronized void release(boolean clearResults) {
    long previous = handle;
    Backend previousBackend = backend;
    handle = 0;
    backend = null;
    if (clearResults) results.clear();
    if (previous != 0) previousBackend.destroy(previous);
  }
  public synchronized String cached(String key) { return results.get(key); }
  public synchronized void remember(String key, String value) { results.put(key, value); }
  public synchronized void clearResults() { results.clear(); }
}
