# Privacy Policy — WaveDrom Visual Editor

_Last updated: 2026-05-23_

This document describes how the WaveDrom Visual Editor app ("the App", published by Lizard-Spock) handles your data. It applies to the Confluence Cloud (Atlassian Forge) app, the VS Code extension, and the standalone web build distributed by the same publisher.

## Summary

The App does not collect, store, or transmit any personal data. The only data the App handles is the WaveJSON timing-diagram text you type into it, and that text is stored inside your own Atlassian site or your own local environment — never on servers operated by Lizard-Spock.

## What data the App processes

| Data | Where it lives | Why |
|---|---|---|
| Your WaveJSON diagram text | **Atlassian Forge app storage** (scoped to your Confluence site, isolated per macro instance via Forge `localId`) for the Confluence app; the local file or your VS Code workspace for the VS Code extension | So the diagram persists between page loads / editor sessions |
| Your renderer preference (`native` vs `official`) | Same Forge app storage entry, keyed alongside the diagram | So your choice survives reloads |
| Confluence site/page identifiers passed in by Atlassian (`localId`, `themeState`) | Only used in-memory at render time, never stored by the App | Required to render the macro and match Confluence's light/dark theme |

That is the complete list. The App does not collect, store, or transmit:

- Names, email addresses, IP addresses, or any other personal identifiers
- Telemetry, analytics, click-streams, or usage events
- Crash reports
- The content of any other Confluence pages, files, or attachments

## Where data is stored

- **Confluence Cloud (Forge app)**: WaveJSON diagram text and renderer preference are stored using the Forge `storage` API. This data lives inside Atlassian's infrastructure within the storage tenancy of your own Confluence site. Lizard-Spock has no access to this storage and operates no servers that hold customer data.
- **VS Code extension**: WaveJSON text lives in the `.wavedrom.json` file inside your own workspace. The extension does not transmit it anywhere.
- **Standalone web build**: WaveJSON text lives only in your browser tab. The standalone build does not transmit it anywhere.

## Data sharing

The App does not share any data with third parties. The App makes no outbound network calls to servers operated by Lizard-Spock or anyone else. It does not embed third-party analytics, advertising, or tracking SDKs.

## Subprocessors

None. The App does not engage any subprocessors.

## Data retention and deletion

Diagram data persists for as long as the corresponding Confluence macro exists. Deleting the macro from the page, deleting the page, or uninstalling the App removes the associated storage entry:

- Deleting a macro instance removes that instance's `localId` and orphans the storage entry. To reclaim storage for orphaned entries, uninstall the App: Atlassian deletes all Forge app storage when an app is uninstalled from a site.
- Uninstalling the App from your Confluence site permanently deletes every diagram stored by the App on that site.

## Your rights

Because Lizard-Spock does not hold any personal data, GDPR / CCPA data subject requests (access, rectification, erasure, portability) are satisfied by managing the data inside your own Confluence site — your Atlassian site admin controls all of it. If you have questions about how Atlassian processes data inside Forge app storage on your behalf, see Atlassian's Privacy Policy and Trust Center.

## Changes to this policy

Changes will be published to this page with an updated "Last updated" date. Material changes affecting the data the App processes will additionally be noted in the project `CHANGELOG.md`.

## Contact

For any privacy-related question or request, open an issue at:
https://github.com/morganp/wavedrom-editor/issues

Or contact the publisher: **Lizard-Spock** — morgan.prior@gmail.com
