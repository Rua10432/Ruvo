# Security Policy 🔒

The Ruvo team takes the security and integrity of user data very seriously. Because Ruvo is a local-first, privacy-oriented application designed to store your personal knowledge base, protecting your files and local environment is a top priority.

---

## 🛡️ Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported          | Status             |
| ------- | ------------------ | ------------------ |
| `0.1.x` | :white_check_mark: | Currently Supported |
| `< 0.1` | :x:                | End of Life        |

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability or sensitive defect in Ruvo, **please do NOT disclose it publicly through GitHub Issues or Discussions.**

### How to Report
Please report security vulnerabilities by either:
1. **GitHub Security Advisory**: Use the GitHub "Report a vulnerability" tab under the repository's Security tab (preferred).
2. **Direct Disclosure**: Send an email describing the vulnerability to the project maintainers with the subject line `[SECURITY] Ruvo Vulnerability Report`.

### What to Include in Your Report
To help us quickly assess and resolve the issue, please include:
- A clear summary of the vulnerability.
- Proof of Concept (PoC) or reproduction steps.
- The operating system, architecture, and exact Ruvo version tested.
- Any potential impact or attack vector (e.g. arbitrary file write, XSS via malicious note import, IPC bypass).
- Suggestions or possible remediations (if any).

### Response Timeline
- **Initial Acknowledgement**: We aim to acknowledge receipt of your report within 48 hours.
- **Triage & Assessment**: We will assess the severity and reproduce the issue within 5 business days.
- **Fix & Disclosure**: We will prepare a patch, coordinate testing, and release a patched version alongside an advisory. We kindly request that you follow coordinated vulnerability disclosure practices.

---

## 🏰 Security Architecture & Defense in Depth

Ruvo employs multiple layers of defensive security mechanisms:

1. **Strict Path Canonicalization & Traversal Defense (`src-tauri/src/security.rs`)**:
   - All file operations (creation, read, write, rename, deletion) are verified using canonicalized path evaluation.
   - Operations outside the workspace root directory are strictly rejected.
   - Guarded against Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).

2. **Atomic Write Guarantee (`src-tauri/src/notes.rs`)**:
   - File writes enforce atomic staging or `create_new` checks to prevent race conditions or partial file corruption.

3. **Content Security Policy (CSP)**:
   - Configured in `tauri.conf.json` to restrict script execution strictly to local app bundles (`'self'`), preventing unauthorized remote script injection or cross-origin data exfiltration.

4. **DOM Sanitization**:
   - All parsed Markdown HTML content is sanitized using **DOMPurify** before insertion into the DOM to block stored XSS vectors.

5. **Cryptographically Signed Auto-Updates**:
   - Release binaries and updater manifests (`latest.json`) require valid digital signatures verified against the Minisign public key embedded within the application binary.
