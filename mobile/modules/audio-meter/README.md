# Android audio meter

Android-only local Expo module. Native changes require rebuilding/installing the development APK; Metro alone cannot update Kotlin code.

- Captures mono 44.1 kHz, 16-bit PCM and saves a WAV evidence file.
- Prefers supported `UNPROCESSED` input, otherwise `VOICE_RECOGNITION`.
- Applies an A-weighting digital filter and calculates average energy across captured samples. Duration comes from sample count, not wall-clock time.
- Uses an **assumed 96 dB sensitivity offset**, not a calibrated microphone response. Displayed dB(A) values are unvalidated estimates, not proof of compliance or violation.
- The user-selected approximate submission policy requires the estimated average to exceed 55 dB(A) by day or 45 dB(A) by night (IST). Equality requires re-recording. The mobile app and server apply the same policy; it is not a certified legal assessment. A nearby school or hospital is not automatically a notified silence zone.
- The Expo fallback reports dBFS only and does not invent dB(A) values.
- Stops after at most 30 seconds; cancellation/unmount closes the input and discards incomplete evidence.
- Optional camera capture records muted MP4 alongside the measured WAV. Both files are attached to the PDF/email; keeping microphone capture in AudioRecord avoids competing audio recorders.

Signal-processing tests: `gradlew :audio-meter:testDebugUnitTest` from `mobile/android`. No iOS implementation is included.
