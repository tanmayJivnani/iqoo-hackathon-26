package expo.modules.localtreeai;

import java.util.Arrays;

public final class QwenSessionCheck {
  static class Fake implements QwenSession.Backend {
    int creates, resets, destroys, resetCode;
    boolean throwsReset;
    public long create() { return ++creates; }
    public int reset(long handle) {
      resets++;
      if (throwsReset) throw new IllegalStateException("reset failed");
      return resetCode;
    }
    public void destroy(long handle) { destroys++; }
  }
  static void check(boolean condition) { if (!condition) throw new AssertionError(); }
  public static void main(String[] args) {
    Fake backend = new Fake();
    QwenSession session = new QwenSession(2);
    session.load(backend); // Camera preloading.
    session.load(backend); // First inference reuses weights.
    session.reset(); session.reset(); // Before and after inference.
    check(backend.creates == 1 && backend.resets == 2 && backend.destroys == 0);
    session.remember("first", "one"); session.remember("second", "two");
    check(session.cached("first").equals("one"));
    session.remember("third", "three");
    check(session.cached("second") == null);
    session.release(false); // Idle unload keeps retry results.
    check(backend.destroys == 1 && session.cached("first").equals("one"));
    session.load(backend); check(backend.creates == 2);
    backend.resetCode = 1;
    try { session.reset(); throw new AssertionError(); } catch (IllegalStateException expected) {}
    check(backend.destroys == 2);
    backend.resetCode = 0; session.load(backend);
    backend.throwsReset = true;
    try { session.reset(); throw new AssertionError(); } catch (IllegalStateException expected) {}
    check(backend.destroys == 3);
    session.release(true); check(session.cached("first") == null);
    byte[] a = {1, 2}, b = {3, 4};
    String key = QwenSession.fingerprint("report", Arrays.asList(a, b));
    check(key.equals(QwenSession.fingerprint("report", Arrays.asList(a.clone(), b.clone()))));
    check(!key.equals(QwenSession.fingerprint("edited notes", Arrays.asList(a, b))));
    check(!key.equals(QwenSession.fingerprint("report", Arrays.asList(b, a))));
    check(!key.equals(QwenSession.fingerprint("report", Arrays.asList(new byte[]{1, 9}, b))));
    check(!QwenSession.fingerprint("a", Arrays.asList(new byte[]{98})).equals(
      QwenSession.fingerprint("ab", Arrays.asList(new byte[]{}))));
    System.out.println("Model reuse, clean context, failure recovery, bounded cache and evidence fingerprints passed");
  }
}
