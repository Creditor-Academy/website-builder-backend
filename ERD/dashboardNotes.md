# Admin Dashboard Implementation Doc

This document provides a detailed overview of the current administrative dashboard functionality, covering various routes, features, and their purposes. It now includes dynamic switching between user and admin modes.

## 1. Dashboard (Main Overview)
*   **File:** `src/pages/Dashboard.tsx`
*   **Purpose:** Serves as the central hub, offering a quick overview of projects and navigation to other management sections. This component now dynamically adapts its content and navigation based on the active `isAdmin` state.
*   **Key Features:**
    *   **Admin Mode Toggle:** A prominent button allows users to switch between "Admin Mode On" and "Switch to Admin Mode". This action updates the `isAdmin` state, which controls the visibility of administrative features and navigation links.
    *   **Dynamic Navigation:** Navigation items within the sidebar are conditionally rendered. In "Admin Mode", specific administrative routes become visible, while in default user mode, a streamlined set of user-focused links is displayed.
    *   **Route Protection/Redirection:** The dashboard implements logic to redirect users if they attempt to access admin-specific routes (defined in `adminRoutes` within `Dashboard.tsx`) while `isAdmin` is false, ensuring that administrative sections are only accessible when the admin mode is active.
    *   **Website Listing:** Displays all created websites with essential information such as name, last edited timestamp, and publication status (Published/Draft).
    *   **Search Functionality:** Users can efficiently find specific websites using a search bar that filters by website name.
    *   **New Project Creation:** Provides a modal dialog for users to create a new website by simply inputting a desired name.
    *   **Website Card Actions:** Each website entry is represented by a card, offering immediate actions:
        *   **Edit:** Navigates to the website builder for modifications.
        *   **Duplicate:** Creates a copy of the existing website.
        *   **Delete:** Removes the website from the system (typically with a confirmation).
        *   **Open Editor:** A direct link to open the website in the visual editor.
    *   **Overview Statistics:** Features summary cards displaying key metrics like total websites, active users, available templates, and daily deployments.
    *   **Responsive Sidebar:** Implements a mobile-friendly sidebar for navigation on smaller screens.
    *   **User Information:** Displays basic user details and current plan usage (e.g., project limits).

## 2. Users Management
*   **File:** `src/pages/DashboardUsers.tsx`
*   **Purpose:** Facilitates the administration of user accounts within the platform.
*   **Key Features:**
    *   **User Table:** Presents a tabular view of all users, detailing their ID, Name, Email, Role (Admin, Editor, User), Status (Active, Inactive, Suspended), Account Creation Date, and Last Login.
    *   **Search Functionality:** Enables filtering of the user list by name or email address.
    *   **Add User:** Includes a button as a placeholder for future functionality to add new user accounts.
    *   **Edit User Modal:** A dialog interface for administrators to update a user's profile information, role, and status.
    *   **Deactivate User:** Allows changing a user's status to "Inactive" with a confirmation prompt.
    *   **Restore User:** Provides functionality to reactivate an "Inactive" or "Suspended" user account.

## 3. Assets Management
*   **File:** `src/pages/DashboardAssets.tsx`
*   **Purpose:** A dedicated section for managing digital assets.
*   **Key Features:** (Currently a placeholder)
    *   Displays a title "Assets Management" and a descriptive paragraph. Full functionality for uploading, organizing, and deleting assets is not yet implemented.

## 4. Deployment Management
*   **File:** `src/pages/DashboardDeployment.tsx`
*   **Purpose:** Oversees and tracks website deployment activities.
*   **Key Features:**
    *   Integrates the `DeploymentMonitoring` component to display deployment statuses and logs.

## 5. Deployment Monitoring
*   **File:** `src/components/dashboard/DeploymentMonitoring.tsx`
*   **Purpose:** Displays real-time and historical deployment information.
*   **Key Features:**
    *   **Deployment Table:** Lists individual deployments with details such as ID, Version, Status (Success, Failed, Pending, Rolled Back), Deployment Timestamp, Deployer, and Associated Website Name.
    *   **View Logs:** Opens the `DeploymentLogViewer` component to show comprehensive logs for a selected deployment (using simulated log data).
    *   **Rollback Functionality:** Allows initiating a rollback to a previous deployment version, including a confirmation dialog. Simulates the creation of a new successful rollback deployment.

## 6. Deployment Log Viewer
*   **File:** `src/components/dashboard/DeploymentLogViewer.tsx`
*   **Purpose:** Provides a detailed view of the logs generated during a deployment process.
*   **Key Features:**
    *   A modal dialog with a scrollable text area that displays logs for a given deployment ID.

## 7. Settings
*   **File:** `src/pages/DashboardSettings.tsx`
*   **Purpose:** Allows users to configure various personal and application-wide settings.
*   **Key Features:**
    *   **Navigation:** A sidebar with links to different settings categories: Profile, Account, Notifications, and Integrations.
    *   **Profile Settings:** Enables updating user's name and email address.
    *   **Account Security:** Contains options to change password and toggle two-factor authentication (2FA).
    *   **Notifications Preferences:** Manages subscriptions for email and SMS notifications.
    *   **API Integrations:** Provides an interface to view existing API keys, copy them to clipboard, and generate new ones (with a security confirmation).
    *   **User Feedback:** Utilizes toast notifications to provide immediate feedback on actions (e.g., successful saves, 2FA changes, API key operations).

## 8. Templates Library
*   **File:** `src/pages/DashboardTemplates.tsx`
*   **Purpose:** A section dedicated to managing website templates.
*   **Key Features:** (Currently a placeholder)
    *   Displays a title "Templates Library" and a descriptive paragraph. Functionality for browsing, selecting, and applying templates is not yet implemented.

## 9. Website Management
*   **File:** `src/pages/DashboardWebsites.tsx`
*   **Purpose:** Offers comprehensive view and management capabilities for websites, adapting based on user role.
*   **Key Features:**
    *   **Admin View Toggle:** A button within this page allows switching between "My Websites" (displaying only the current user's sites) and "All Websites" (displaying all sites, mimicking an administrator's view). This toggle is independent of the global `isAdmin` state but provides similar functionality within this specific section.
    *   **Website Table:** Lists websites with their ID, Name, Domain, Status (Draft, Published, Deleted), and Last Updated date. The displayed websites change based on the "Admin View Toggle".
    *   **Website Actions:** Each website entry includes a dropdown menu for:
        *   **Edit:** Placeholder for navigating to an edit page or modal.
        *   **Duplicate:** Placeholder for creating a copy.
        *   **Preview:** Placeholder for opening the website in a new tab.
        *   **Delete:** Placeholder for initiating a deletion process.
    *   **Status Badges:** Visually distinguishes the status of each website (e.g., Published, Draft, Deleted) using different badge styles and icons for clarity.