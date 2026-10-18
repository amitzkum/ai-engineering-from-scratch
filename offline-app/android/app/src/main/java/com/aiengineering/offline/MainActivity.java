package com.aiengineering.offline;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    public class AndroidDownloader {
        @JavascriptInterface
        public void downloadBlob(String fileName, String mimeType, String base64Data) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                boolean saved = false;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                                saved = true;
                            }
                        }
                    }
                }

                if (!saved) {
                    File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadDir.exists()) {
                        downloadDir.mkdirs();
                    }
                    File dest = new File(downloadDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(dest)) {
                        fos.write(bytes);
                        fos.flush();
                        saved = true;
                    }
                }

                final boolean finalSaved = saved;
                runOnUiThread(() -> {
                    if (finalSaved) {
                        Toast.makeText(MainActivity.this, "Saved " + fileName + " to Downloads", Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(MainActivity.this, "Could not save " + fileName, Toast.LENGTH_SHORT).show();
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Download error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Hardware-accelerated offline WebView settings for tablets and phones
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new AndroidDownloader(), "AndroidDownloader");

            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);

            // Handle system bars and cutout insets for phones with notches and navigation bars
            ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                float density = getResources().getDisplayMetrics().density;
                if (density <= 0) density = 1.0f;
                int topDp = (int) (insets.top / density);
                int bottomDp = (int) (insets.bottom / density);
                int leftDp = (int) (insets.left / density);
                int rightDp = (int) (insets.right / density);

                String script = String.format(
                    Locale.US,
                    "try {" +
                    "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');" +
                    "} catch(e) {}",
                    topDp, bottomDp, leftDp, rightDp
                );
                webView.evaluateJavascript(script, null);
                return windowInsets;
            });
        }
    }
}

