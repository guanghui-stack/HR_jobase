# Gmail OAuth Setup for Jobase

## Current diagnostic

Google returned `Error 403: access_denied`. The OAuth client is in **Testing** status and the Google account selected during authorization is not an approved test user. The OAuth client credentials and configured callback URL passed the token-endpoint configuration test.

After the test-user change, Google returned to the account-selection page without the prior `access_denied` block. The subsequent help page is the standard information page for an **unverified application**. This warning is expected while the OAuth consent screen remains in Testing; it is separate from redirect URI or client credential errors. The next interactive screen must be inspected after selecting the approved mailbox to determine whether Google presents an advanced-warning continuation or a new explicit error.

With the replacement OAuth client, the selected account reaches the Google OAuth warning route (`/signin/oauth/warning`). This confirms that the authorization request is accepted and that the user is now at the expected unverified-application continuation step, before Jobase's callback is reached.

## Required Google Cloud Console changes

1. Open the Google Cloud project that owns Jobase's OAuth client.
2. Go to **Google Auth platform → Audience**.
3. Under **Test users**, add the exact Gmail address that will authorize Jobase to send notification mail.
4. Keep the application in **Testing** for this initial setup, then save the change.
5. Confirm the Gmail API remains enabled and that the `https://www.googleapis.com/auth/gmail.send` scope remains declared under **Data Access**.
6. Return to Jobase Admin and choose **Kết nối Gmail** again.

## Production note

Testing is suitable for a small authorized group. Before broad external use, review the Google Auth platform publishing and verification requirements because Gmail send access is a sensitive permission. Google also notes that refresh tokens for an external application in Testing can expire after seven days when the app uses Gmail scope.

## References

[1] Google Workspace, "Configure the OAuth consent screen and choose scopes" — https://developers.google.com/workspace/guides/configure-oauth-consent

[2] Google Identity, "Using OAuth 2.0 to Access Google APIs" — https://developers.google.com/identity/protocols/oauth2
