# Publishing the Android app on the website

1. Build the APK with EAS (`eas build --platform android --profile preview`) and download it.
2. Upload it to your Cloudflare R2 bucket, for example `societyledger-1.0.0.apk`, and make sure the bucket (or a custom domain on it) serves the file publicly.
3. Copy the public link. It must start with `https://`.
4. Admin console, **App Downloads**, **Releases**, **Add release**: enter the version and paste the link.
5. Press **Make current**. The landing page now shows the "Download the Android app" button. Until a release is current, the button is hidden.

To ship a new version, add a new release and make it current. Old releases stay in the history. A release that has been downloaded cannot be deleted, only turned off.

Leads are under **Leads**. Export CSV or Excel there. Every export is recorded in the audit log.

Cloudflare tip: set the object's `Content-Type` to `application/vnd.android.package-archive` so phones treat the file as an app.
