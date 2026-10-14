#!/usr/bin/env python3
"""
================================================================================
TurfSheet Punters Club — Standalone Automated Script Installer for InfinityFree
Target Website : https://cupdaypunting.xo.je
Account Email  : BobbyDazzler83@gmail.com
================================================================================
HOW TO RUN ON YOUR COMPUTER (Mac / Windows / Linux):
  1. Ensure `cupdaypunting-xo-je-infinityfree-htdocs.zip` is in the same folder
     as this script (or pass its path).
  2. Run:
       python3 install-cupdaypunting.py
  3. Enter your InfinityFree FTP Username (e.g. if0_xxxxxxx) and FTP Password
     from https://dash.infinityfree.com when prompted.
  4. The script automatically extracts the package, connects to ftpupload.net,
     creates `/htdocs/assets`, `/htdocs/api/nsw-tab`, and `/htdocs/data`,
     uploads all website files + `.htaccess` security config, and removes
     InfinityFree's default `index2.html` placeholder!
================================================================================
"""

import ftplib
import getpass
import io
import os
import sys
import zipfile

DEFAULT_ZIP = "cupdaypunting-xo-je-infinityfree-htdocs.zip"
DEFAULT_HOST = "ftpupload.net"
DEFAULT_REMOTE_DIR = "/htdocs"


def ensure_remote_dir(ftp: ftplib.FTP, remote_dir: str) -> None:
    parts = [p for p in remote_dir.replace("\\", "/").split("/") if p]
    curr = ""
    for part in parts:
        curr = f"{curr}/{part}"
        try:
            ftp.cwd(curr)
        except Exception:
            try:
                ftp.mkd(curr)
                ftp.cwd(curr)
            except Exception:
                pass


def main() -> None:
    print("=" * 76)
    print(" TURFSHEET PUNTERS CLUB — INFINITYFREE (cupdaypunting.xo.je) INSTALLER")
    print("=" * 76)

    zip_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ZIP
    if not os.path.isfile(zip_path):
        print(f"\n[!] Could not find '{zip_path}' in the current folder ({os.getcwd()}).")
        custom = input("Enter path to cupdaypunting-xo-je-infinityfree-htdocs.zip: ").strip()
        if custom and os.path.isfile(custom):
            zip_path = custom
        else:
            print("[ERROR] Website ZIP archive not found. Download it first and re-run.")
            sys.exit(1)

    ftp_host = input(f"InfinityFree FTP Host [{DEFAULT_HOST}]: ").strip() or DEFAULT_HOST
    ftp_user = input("InfinityFree FTP Username (e.g. if0_xxxxxxx): ").strip()
    if not ftp_user:
        print("[ERROR] FTP Username is required.")
        sys.exit(1)

    ftp_pass = getpass.getpass("InfinityFree FTP Password: ")
    remote_root = input(f"Remote Directory [{DEFAULT_REMOTE_DIR}]: ").strip() or DEFAULT_REMOTE_DIR

    print(f"\n[*] Connecting to {ftp_host} as {ftp_user}...")
    try:
        try:
            ftp = ftplib.FTP_TLS()
            ftp.connect(ftp_host, 21, timeout=20)
            ftp.login(ftp_user, ftp_pass)
            ftp.prot_p()
            print("[+] Connected securely via FTPS (TLS).")
        except Exception:
            ftp = ftplib.FTP()
            ftp.connect(ftp_host, 21, timeout=20)
            ftp.login(ftp_user, ftp_pass)
            print("[+] Connected via standard FTP.")
    except Exception as exc:
        print(f"[ERROR] FTP login failed: {exc}")
        sys.exit(1)

    ensure_remote_dir(ftp, remote_root)

    # Remove default InfinityFree placeholder index2.html if present
    for placeholder in ("index2.html", "default.php", "welcome.html"):
        try:
            ftp.delete(f"{remote_root.rstrip('/')}/{placeholder}")
            print(f"[+] Removed default placeholder: {placeholder}")
        except Exception:
            pass

    uploaded = 0
    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            rel_path = info.filename.replace("\\", "/")
            sub_dir = os.path.dirname(rel_path)
            target_dir = (
                f"{remote_root.rstrip('/')}/{sub_dir}".rstrip("/")
                if sub_dir
                else remote_root
            )
            ensure_remote_dir(ftp, target_dir)
            filename = os.path.basename(rel_path)
            data = zf.read(info.filename)
            ftp.storbinary(f"STOR {filename}", io.BytesIO(data))
            uploaded += 1
            print(f"  [✓] Uploaded {rel_path} ({len(data):,} bytes)")

    try:
        ftp.quit()
    except Exception:
        pass

    print("\n" + "=" * 76)
    print(f" SUCCESS! Installed {uploaded} files to {remote_root} on {ftp_host}.")
    print(" Live Website: https://cupdaypunting.xo.je")
    print("=" * 76)


if __name__ == "__main__":
    main()
