# Proguard rules for AegisCall Screener
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.aegiscall.screener.models.** { *; }
