package com.aiengineering.offline;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Hardware-accelerated offline WebView settings for tablets and phones
        WebView webView = getBridge().getWebView();
        if (webView != null) {
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

