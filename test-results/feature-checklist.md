Packing repository using Repomix...
Analyzing repository using gemini-2.5-flash-preview-04-17...
Okay, here is a detailed test checklist for the +chorus Nostr groups application, based on the provided codebase.

**Test Checklist for +chorus Nostr Groups App**

**Environment:**

*   A running instance of the +chorus web app.
*   A Nostr browser extension (e.g., Alby, nos2x) with at least one Nostr account configured.
*   Access to test Nostr relays that support NIP-01, NIP-07, NIP-19, NIP-60, NIP-61, NIP-72, and NIP-29 events. The default relays in `src/App.tsx` and `src/components/EnhancedNostrProvider.tsx` should be used.
*   Test accounts: at least one user account, one user account with a configured NIP-05, one user account with a Cashu wallet, one user account without a Cashu wallet.
*   A test NIP-72 group and a test NIP-29 group where the test user is the owner, a moderator/admin, and a regular member.

**Feature Area: Authentication**

1.  **User Onboarding (New Account)**
    *   Navigate to the homepage (`/`).
    *   Verify the "Get Started" button is visible.
    *   Click "Get Started".
    *   Expected: App generates a new key pair, creates a login, and navigates to the Profile setup page (`/settings/profile` with `showSkipLink=true`).
    *   On Profile setup: Verify a temporary name (e.g., "Swift Bear") is pre-filled.
    *   Upload a profile picture and update the name.
    *   Click "Save".
    *   Expected: Profile (kind 0) event published with the new name and picture. Toast "Success" displayed. App navigates to the Groups page (`/groups`).
    *   Go back to the Profile setup page *before* saving. Click "Skip for now".
    *   Expected: App navigates to the Groups page without publishing a profile event.
    *   Go back to the Profile setup page. Click "Back to login".
    *   Expected: App logs out the user and navigates back to the homepage.

2.  **User Login (Existing Account)**
    *   Navigate to the homepage (`/`).
    *   Verify the "Sign in" button is visible.
    *   Click "Sign in".
    *   Expected: Login Dialog (`LoginDialog.tsx`) appears.
    *   **Login with Extension**:
        *   Select "Extension" tab (if not default).
        *   Verify "Login with Extension" button is enabled (if extension detected).
        *   Click "Login with Extension".
        *   Expected: Browser extension prompts for authentication. Upon approval, login is successful. Dialog closes. App navigates to the Groups page (`/groups`).
        *   Verify `useProfileSync` fetches/republishes the user's kind 0 event.
    *   **Login with Nsec**:
        *   Select "Nsec" tab.
        *   Enter a valid `nsec1...` private key string.
        *   Verify "Login with Nsec" button is enabled.
        *   Click "Login with Nsec".
        *   Expected: Login is successful. Dialog closes. App navigates to Groups page.
        *   Enter an invalid string (not starting with `nsec1`). Verify error message "Invalid nsec format".
        *   Upload a `.txt` file containing a valid `nsec1...` key. Verify input field populates. Click Login button. Verify successful login.
        *   Upload a file that is not a valid key. Verify error message.
    *   **Login with Bunker**:
        *   Select "Bunker" tab.
        *   Enter a valid `bunker://...` URI for an active NIP-46 signer.
        *   Click "Login with Bunker".
        *   Expected: Connection attempt is made. Signer prompts for authentication. Upon approval, login is successful. Dialog closes. App navigates to Groups page.
        *   Enter an invalid URI format. Verify error message "URI must start with bunker://".
        *   Enter a URI for an offline or invalid bunker. Verify connection error message.

3.  **Account Management (Logged In)**
    *   After successful login, navigate to any page.
    *   Verify the Account Switcher component (`AccountSwitcher.tsx`) is visible in the header, showing the current user's avatar and name/pubkey.
    *   Click the Account Switcher.
    *   Expected: Dropdown menu appears with options: "Create Group", "View Profile", "Wallet", "Notifications", "Settings", "About +chorus", "Install App" (if not PWA), "Log out".
    *   Log in with a second account (via Login Dialog).
    *   Click Account Switcher.
    *   Expected: Second account appears in the dropdown. Click the second account. Verify the UI updates to reflect the second user's data (profile, groups, etc.).
    *   Click "Log out" from the dropdown.
    *   Expected: User is logged out. App navigates back to the homepage. Verify `cashuStore.clearStore()` is called (except onboarding state).

**Feature Area: Group Creation**

1.  **Access Create Group Page**
    *   Navigate to `/create-group` while logged out.
    *   Expected: Redirect to the homepage or a message indicating login is required.
    *   Navigate to `/create-group` while logged in.
    *   Expected: The Create Group form (`CreateGroupForm.tsx`) is displayed.

2.  **Create NIP-72 Community (Public)**
    *   In the Create Group form, select "Public Community" (NIP-72).
    *   Fill in "Group Name" (required).
    *   Fill in "Group Identifier" (required). Verify validation if left empty.
    *   Optionally fill in "Description" and "Community Guidelines".
    *   Optionally upload a "Group Image" file or provide an Image URL. Verify image preview. Test invalid file types/sizes.
    *   Click "Create Group".
    *   Expected: Form validation passes. A Kind 34550 event is published with the correct tags (`d`, `name`, `description`, `guidelines`, `image`, `p` for self as moderator/owner). Toast "Success" appears. App navigates to the Groups page (`/groups`).
    *   Verify the new NIP-72 group appears in the Groups list, categorized under "Your Groups" (as owner/moderator).

3.  **Create NIP-29 Group (Private)**
    *   In the Create Group form, select "Private Group" (NIP-29).
    *   Fill in "Group Name" (required).
    *   Fill in "Group Relay" (required). Verify validation if left empty or invalid URL format. Check if default NIP-29 relay is pre-filled (`getNip29DefaultRelay`).
    *   Optionally fill in "Description".
    *   Optionally upload a "Group Image" file or provide an Image URL.
    *   Toggle "Open group" and "Public group" checkboxes.
    *   Click "Create Group".
    *   Expected: Form validation passes. A Kind 9007 event is published on the specified NIP-29 relay with the correct tags (`h`, `name`, `about`, `picture`, `private`, `closed`). Toast "Success" appears. App navigates to the Groups page (`/groups`).
    *   Verify the new NIP-29 group appears in the Groups list, categorized under "Your Groups" (as admin). Check if the group URL uses the `/group/nip29/:relay/:groupId` format.

4.  **Cancel Creation**
    *   While on the Create Group page, click the "Cancel" button.
    *   Expected: App navigates back to the Groups page without creating a group.

**Feature Area: Posting**

1.  **Access Create Post Form**
    *   Navigate to a Group Detail page (`/group/:groupId` or `/group/nip29/:relay/:groupId`) while logged in and a member of the group.
    *   Expected: The Create Post form (`CreatePostForm.tsx`) is visible.
    *   Navigate to a Group Detail page while logged out or not a member.
    *   Expected: The Create Post form is not visible.

2.  **Create Post (Text Only)**
    *   In the Create Post form, enter text content.
    *   Click "Post".
    *   Expected:
        *   **NIP-72, User is Owner/Moderator/Approved**: Kind 1 event published with `a` tag referencing the community ID. Post appears immediately in the Post List. Toast "Post published successfully".
        *   **NIP-72, User is NOT Owner/Moderator/Approved**: Kind 1 event published with `a` tag. Post appears in the "Pending Posts" list on the moderation tab. Toast "Post submitted for moderator approval".
        *   **NIP-29**: Kind 9 or 11 event published with `h` tag referencing the group ID on the specific NIP-29 relay. Post appears immediately in the Post List. Toast "Post published successfully".

3.  **Create Post (with Media)**
    *   Enter text content and select an image, video, or audio file using the "Media" button. Verify file preview. Test invalid file types/sizes.
    *   Click "Post".
    *   Expected: File is uploaded (`useUploadFile`). Upload success (toast "Image uploaded successfully!"). Post event published including the media URL appended to content and relevant tags (`image`, `m`). Post appears with media preview/player.

4.  **Create Post (with Link)**
    *   Enter text content including a URL that is not media (e.g., `https://example.com`).
    *   Click "Post".
    *   Expected: Post event published. Post appears with the URL text hidden in the `NoteContent` and a `LinkPreview.tsx` component displayed below.

5.  **Post Interactions (Visible Posts)**
    *   **Reply**: Click the message icon below a post. Verify Reply Form (`ReplyForm.tsx`) appears. Enter text, optionally add media/links. Publish. Verify new event (Kind 1111 for NIP-72, Kind 9 or 11 with `h` and `e` tags for NIP-29) is published, referencing the parent post. Reply appears indented below the post (possibly pending approval if NIP-72 and user not approved).
    *   **Nested Reply**: Click the message icon below a reply. Verify Reply Form appears indented. Enter text, publish. Verify new event references the parent reply and the original post.
    *   **Emoji Reaction**: Click emoji icon. Select emoji. Verify Kind 7 event published referencing the post. Emoji count updates. Click again to unlike/remove.
    *   **Nutzap**: Click dollar/bitcoin icon. Verify Zap Interface/Form appears (`NutzapInterface.tsx`). Enter amount, comment. Send. Verify Kind 9735 event published with proofs and tags (`p`, `e`, `u`). Wallet balance updates. Nutzap count updates. NutzapList shows recent zaps.
    *   **Share Post**: Click More menu -> Share Post. Verify Web Share API or clipboard copy. Check link format (`nevent` for njump.me).
    *   **Report Post**: Click More menu -> Report Post. Verify Report Dialog appears (`ReportDialog.tsx`). Select reason, enter details. Submit. Verify Kind 1984 event published.

**Feature Area: Member Management**

1.  **Access Group Settings**
    *   Navigate to a Group Detail page (`/group/:groupId` or `/group/nip29/:relay/:groupId`).
    *   Verify the "Manage" button is visible if the user is the owner or a moderator/admin.
    *   Click "Manage".
    *   Expected: Navigates to Group Settings page (`/group/:groupId/settings` or `/group/nip29/:relay/:groupId/settings`). Tabs ("General", "Members", "Reports", "Invites" for NIP-29 admin) are visible. URL hash/query reflects the active tab.

2.  **NIP-72 Group Settings (`/group/:groupId/settings`)**
    *   **General Tab (Owner Only)**: