package expo.modules.localtreeai;

import com.geniex.sdk.bean.*;
import com.geniex.sdk.jni.Vlm;

/** Version-pinned GenieX 0.4.0 JNI adapter; public wrapper omits capability checks. */
public final class QwenRuntime {
  private final Vlm vlm = new Vlm();
  public long create(VlmCreateInput input) { return vlm.create(input); }
  public VlmCapabilities getCapabilities(long handle) { return vlm.getCapabilities(handle); }
  public void generate(long handle, String prompt, GenerationConfig config, LLMTokenCallback callback) {
    vlm.generate(handle, prompt, config, callback);
  }
  public void destroy(long handle) { vlm.destroy(handle); }
}
